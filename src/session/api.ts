/**
 * 세션 읽기·쓰기. 화면 컴포넌트는 여기만 부르고 Firebase 를 직접 만지지 않는다.
 *
 * 답안 유실 방지 (설계보고서 2.4):
 *   - 답 선택 즉시 화면 반영 → 500ms 디바운스 후 서버 write
 *   - 동시에 localStorage 미러링, 재접속 시 최신 것 채택
 *   - onDisconnect() 는 **접속 상태만** 관리한다. 답안 노드에 절대 걸지 않는다
 */

import {
  get, onDisconnect, onValue, ref, remove, runTransaction, serverTimestamp, set, update,
} from 'firebase/database'
import { ensureSignedIn, getDb } from '../lib/firebase'
import { load, save } from '../lib/storage'
import type { Problem } from '../units/_types'
import type { Answer } from './grade'
import type {
  ArchiveEntry, MatchRecord, Phase, RosterEntry, Session, SessionMeta, StudentId, TeamRecord,
} from './types'

const SESSIONS = 'sessions'
const CODES = 'codes'

/* ── 코드 ──────────────────────────────────────────── */

/** 헷갈리는 글자(0/O, 1/I)를 뺀 6자리. 크롬북에서 손으로 칠 수도 있어야 한다 */
const ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'

function randomCode(): string {
  let s = ''
  const buf = new Uint32Array(6)
  crypto.getRandomValues(buf)
  for (let i = 0; i < 6; i++) s += ALPHABET[buf[i]! % ALPHABET.length]
  return s
}

/**
 * 코드로 세션을 찾는다.
 *
 * **읽기 전에 반드시 익명 로그인을 먼저 한다.** 데이터베이스 규칙이
 * 로그인한 사람만 읽게 되어 있어서, 로그인 없이 읽으면 조용히 막힌다.
 * 학생 화면은 이게 첫 동작이라 빠뜨리면 '들어가는 중…' 에서 멈춘다.
 */
export async function codeToSessionId(code: string): Promise<string | null> {
  await ensureSignedIn()
  const snap = await get(ref(getDb(), `${CODES}/${code.toUpperCase()}`))
  return snap.exists() ? (snap.val() as string) : null
}

/* ── 세션 만들기 ───────────────────────────────────── */

export type CreateOptions = {
  unitId: string
  gameId: string
  quizSeconds: number
  rounds: number
  problems: Problem[]
  names: string[]
}

export async function createSession(o: CreateOptions): Promise<{ sessionId: string; code: string }> {
  await ensureSignedIn()
  const db = getDb()

  // 코드가 겹치지 않을 때까지. 실제로는 거의 한 번에 잡힌다
  let code = randomCode()
  for (let i = 0; i < 12; i++) {
    const taken = await get(ref(db, `${CODES}/${code}`))
    if (!taken.exists()) break
    code = randomCode()
  }

  const sessionId = `s${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`
  const meta: SessionMeta = {
    code,
    unitId: o.unitId,
    gameId: o.gameId,
    phase: 'lobby',
    createdAt: Date.now(),
    quizStartedAt: null,
    quizSeconds: o.quizSeconds,
    rounds: o.rounds,
    extraSeconds: 0,
    paused: false,
    pausedAt: null,
  }

  // 명단은 이름을 그대로 키로 쓰지 않는다. 동명이인과 특수문자 때문에 번호를 붙인다
  const roster: Record<string, RosterEntry> = {}
  o.names.forEach((name, i) => {
    roster[`p${String(i + 1).padStart(3, '0')}`] = { name, joinedAt: 0, connected: false, lastSeen: 0 }
  })

  await set(ref(db, `${SESSIONS}/${sessionId}`), {
    meta,
    problems: o.problems,
    roster,
    quiz: {},
    teams: {},
    game: null,
  })
  await set(ref(db, `${CODES}/${code}`), sessionId)
  return { sessionId, code }
}

/* ── 구독 ──────────────────────────────────────────── */

/**
 * 세션 구독. 여기도 **로그인이 먼저다.**
 * 규칙에 막히면 조용히 아무것도 안 오므로, 막힌 것을 onError 로 알려 준다.
 */
export function watchSession(
  sessionId: string,
  cb: (s: Session | null) => void,
  onError?: (e: Error) => void,
): () => void {
  let stop: (() => void) | null = null
  let cancelled = false

  void ensureSignedIn()
    .then(() => {
      if (cancelled) return
      stop = onValue(
        ref(getDb(), `${SESSIONS}/${sessionId}`),
        (snap) => {
          if (!snap.exists()) return cb(null)
          const v = snap.val() as Session
          // RTDB 는 빈 객체를 지운다. 화면에서 매번 ?? 를 붙이지 않게 여기서 채워 준다
          cb({
            ...v,
            problems: v.problems ?? [],
            roster: v.roster ?? {},
            quiz: v.quiz ?? {},
            teams: v.teams ?? {},
            game: v.game ?? null,
          })
        },
        (e) => onError?.(e),
      )
    })
    .catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))))

  return () => {
    cancelled = true
    stop?.()
  }
}

export function watchPath<T>(path: string, cb: (v: T | null) => void): () => void {
  return onValue(ref(getDb(), path), (snap) => cb(snap.exists() ? (snap.val() as T) : null))
}

export const sessionPath = (sessionId: string, rest = ''): string =>
  `${SESSIONS}/${sessionId}${rest ? '/' + rest : ''}`

/* ── 교사만 하는 일 ─────────────────────────────────── */

export async function setPhase(sessionId: string, phase: Phase): Promise<void> {
  const patch: Record<string, unknown> = { 'meta/phase': phase }
  if (phase === 'quiz') {
    patch['meta/quizStartedAt'] = Date.now()
    patch['meta/paused'] = false
    patch['meta/pausedAt'] = null
  }
  await update(ref(getDb(), sessionPath(sessionId)), patch)
}

export async function addTime(sessionId: string, seconds: number): Promise<void> {
  await runTransaction(ref(getDb(), sessionPath(sessionId, 'meta/extraSeconds')), (v) => (v ?? 0) + seconds)
}

export async function setPaused(sessionId: string, paused: boolean, meta: SessionMeta): Promise<void> {
  if (paused) {
    await update(ref(getDb(), sessionPath(sessionId, 'meta')), { paused: true, pausedAt: Date.now() })
  } else {
    const held = meta.pausedAt ? Math.round((Date.now() - meta.pausedAt) / 1000) : 0
    await update(ref(getDb(), sessionPath(sessionId, 'meta')), {
      paused: false,
      pausedAt: null,
      extraSeconds: (meta.extraSeconds ?? 0) + held,
    })
  }
}

export async function saveTeams(sessionId: string, teams: Record<string, TeamRecord>): Promise<void> {
  await set(ref(getDb(), sessionPath(sessionId, 'teams')), teams)
}

export async function saveScores(
  sessionId: string,
  scores: Record<StudentId, { score: number; correctCount: number }>,
): Promise<void> {
  const patch: Record<string, unknown> = {}
  for (const [id, v] of Object.entries(scores)) {
    patch[`${id}/score`] = v.score
    patch[`${id}/correctCount`] = v.correctCount
  }
  await update(ref(getDb(), sessionPath(sessionId, 'quiz')), patch)
}

export async function saveRound(
  sessionId: string,
  round: number,
  matches: Record<string, MatchRecord>,
  cheerleaders: StudentId[],
): Promise<void> {
  await update(ref(getDb(), sessionPath(sessionId, 'game')), {
    round,
    [`rounds/${round}`]: { round, matches, cheerleaders },
  })
}

export async function endSession(sessionId: string): Promise<void> {
  await setPhase(sessionId, 'result')
}

/** 학년말 일괄 삭제 — 세션과 코드, 기록을 지운다 */
export async function deleteSession(sessionId: string, code: string): Promise<void> {
  await remove(ref(getDb(), `${SESSIONS}/${sessionId}`))
  await remove(ref(getDb(), `${CODES}/${code}`))
}

/* ── 학생이 하는 일 ─────────────────────────────────── */

/**
 * 이름을 고르면 그 자리를 잡는다. 이미 다른 사람이 잡았으면 실패한다.
 *
 * `force` 는 **이 기기가 예전에 잡았던 자리로 돌아올 때만** 쓴다.
 * 새로고침하거나 크롬북을 덮었다 열면 connected 가 아직 true 로 남아 있어서,
 * force 가 없으면 학생이 자기 자리에서 튕긴 채 다시 못 들어온다.
 * 자리 번호는 그 기기의 localStorage 에만 있으므로 남의 자리를 뺏을 수는 없다.
 */
export async function claimSeat(
  sessionId: string,
  studentId: StudentId,
  force = false,
): Promise<boolean> {
  await ensureSignedIn()
  const db = getDb()
  const seat = ref(db, sessionPath(sessionId, `roster/${studentId}`))
  const res = await runTransaction(seat, (cur: RosterEntry | null) => {
    if (cur === null) return cur
    if (!force && cur.joinedAt > 0 && cur.connected) return undefined // 이미 다른 기기가 쓰는 중
    return { ...cur, joinedAt: cur.joinedAt > 0 ? cur.joinedAt : Date.now(), connected: true, lastSeen: Date.now() }
  })
  if (!res.committed) return false

  // 트랜잭션이 로컬 캐시 상태에서 먼저 돌면 joinedAt 이 붙지 않고 끝나는 경우가 있다.
  // 자리를 잡은 기록이 없으면 그 학생이 팀 배분에서 통째로 빠진다. 여기서 못 박는다.
  const after = res.snapshot.val() as RosterEntry | null
  if (!after || !after.joinedAt) {
    const now = Date.now()
    await update(seat, { joinedAt: now, connected: true, lastSeen: now })
  }

  // 접속 상태만 onDisconnect 로 관리한다. 답안 노드에는 절대 걸지 않는다
  await onDisconnect(ref(db, sessionPath(sessionId, `roster/${studentId}/connected`))).set(false)
  await onDisconnect(ref(db, sessionPath(sessionId, `roster/${studentId}/lastSeen`))).set(serverTimestamp())
  save(`seat:${sessionId}`, studentId)
  return true
}

/** 이름 비교용 정리. 공백과 대소문자 차이는 같은 이름으로 본다 */
const normalizeName = (s: string): string => s.trim().replace(/s+/g, ' ').toLowerCase()

/**
 * 학생이 그날 쓸 별명을 정한다.
 * **실제 이름은 그대로 남는다.** 교사 화면과 오답 기록은 실명을 쓰고,
 * 칠판과 친구들 화면에만 별명이 보인다.
 */
export async function setNickname(
  sessionId: string,
  studentId: StudentId,
  raw: string,
): Promise<{ ok: true } | { ok: false; reason: string }> {
  await ensureSignedIn()
  const nickname = raw.trim().replace(/s+/g, ' ')
  if (nickname.length > 14) return { ok: false, reason: '너무 길어요. 14글자 안으로 해 주세요.' }

  const snap = await get(ref(getDb(), sessionPath(sessionId, 'roster')))
  const roster = (snap.val() ?? {}) as Record<StudentId, RosterEntry>
  const clash = Object.entries(roster).some(
    ([id, r]) => id !== studentId && r.nickname && normalizeName(r.nickname) === normalizeName(nickname),
  )
  if (nickname && clash) return { ok: false, reason: '친구가 벌써 쓰고 있어요. 다른 걸로 해 주세요.' }

  await update(ref(getDb(), sessionPath(sessionId, `roster/${studentId}`)), {
    nickname: nickname || null,
  })
  save(`nickname:${sessionId}`, nickname)
  return { ok: true }
}

/** 교사가 부적절한 별명을 지운다. 그 학생은 다시 실명으로 보인다 */
export async function clearNickname(sessionId: string, studentId: StudentId): Promise<void> {
  await update(ref(getDb(), sessionPath(sessionId, `roster/${studentId}`)), { nickname: null })
}

export function rememberedSeat(sessionId: string): StudentId | null {
  return load<StudentId | null>(`seat:${sessionId}`, null)
}

/** 두 번째 접속부터 이름 선택을 건너뛰기 위해 기억해 둔다 */
export function rememberName(name: string): void {
  save('name', name)
}
export function rememberedName(): string {
  return load<string>('name', '')
}

export async function heartbeat(sessionId: string, studentId: StudentId): Promise<void> {
  await update(ref(getDb(), sessionPath(sessionId, `roster/${studentId}`)), {
    connected: true,
    lastSeen: Date.now(),
  })
}

/** 교사가 "이 학생 재접속 처리" 를 눌렀을 때 자리를 비워 준다 */
export async function releaseSeat(sessionId: string, studentId: StudentId): Promise<void> {
  await update(ref(getDb(), sessionPath(sessionId, `roster/${studentId}`)), {
    connected: false,
    joinedAt: 0,
  })
}

/* ── 답안 ───────────────────────────────────────────── */

const pending = new Map<string, ReturnType<typeof setTimeout>>()

/** 500ms 디바운스 후 서버에 쓴다. localStorage 미러는 즉시 */
export function saveAnswers(
  sessionId: string,
  studentId: StudentId,
  answers: Record<string, Answer>,
): void {
  save(`answers:${sessionId}:${studentId}`, answers)
  const key = `${sessionId}/${studentId}`
  const t = pending.get(key)
  if (t) clearTimeout(t)
  pending.set(
    key,
    setTimeout(() => {
      pending.delete(key)
      void set(ref(getDb(), sessionPath(sessionId, `quiz/${studentId}/answers`)), answers).catch(() => {
        // 네트워크가 죽어도 풀이는 계속되어야 한다. 다음 저장 때 다시 올라간다
      })
    }, 500),
  )
}

export function mirroredAnswers(sessionId: string, studentId: StudentId): Record<string, Answer> {
  return load<Record<string, Answer>>(`answers:${sessionId}:${studentId}`, {})
}

export async function submitQuiz(
  sessionId: string,
  studentId: StudentId,
  answers: Record<string, Answer>,
): Promise<void> {
  await set(ref(getDb(), sessionPath(sessionId, `quiz/${studentId}`)), {
    answers,
    submittedAt: Date.now(),
    score: null,
    correctCount: null,
  })
}

/* ── 게임 ───────────────────────────────────────────── */

export async function writeTurn(
  sessionId: string,
  round: number,
  matchId: string,
  turn: number,
  studentId: StudentId,
  choice: 'draw' | 'stop',
): Promise<void> {
  await set(
    ref(getDb(), sessionPath(sessionId, `game/rounds/${round}/matches/${matchId}/turns/${turn}/${studentId}`)),
    choice,
  )
}

export async function writeMatchResult(
  sessionId: string,
  round: number,
  matchId: string,
  winner: StudentId | 'draw',
): Promise<void> {
  await update(ref(getDb(), sessionPath(sessionId, `game/rounds/${round}/matches/${matchId}`)), {
    winner,
    endedAt: Date.now(),
  })
}

export async function writeForfeit(
  sessionId: string,
  round: number,
  matchId: string,
  loser: StudentId,
  winner: StudentId,
): Promise<void> {
  await update(ref(getDb(), sessionPath(sessionId, `game/rounds/${round}/matches/${matchId}`)), {
    forfeit: loser,
    winner,
    endedAt: Date.now(),
  })
}

/**
 * 배팅 — 응원단장이 이번 판에 팀원 한 명을 고른다.
 * 그 친구가 이기면 그 승리가 팀 점수 2점이 된다.
 *
 * 판마다 따로 저장한다. 한 번 고르면 못 바꾸는 규칙은 화면에서 막는다
 * (Firebase 규칙은 이미 굳어 있어 건드리지 않았다).
 */
export async function placeBet(
  sessionId: string,
  round: number,
  cheerleader: StudentId,
  target: StudentId,
): Promise<void> {
  await set(ref(getDb(), sessionPath(sessionId, `game/bets/${round}/${cheerleader}`)), target)
}

export async function voteMvp(sessionId: string, voter: StudentId, target: StudentId): Promise<void> {
  await set(ref(getDb(), sessionPath(sessionId, `game/mvp/${voter}`)), target)
}

/* ── 기록 보관 (/review) ────────────────────────────── */

export async function archive(entries: Record<string, ArchiveEntry>): Promise<void> {
  const patch: Record<string, unknown> = {}
  for (const [key, v] of Object.entries(entries)) patch[key] = v
  await update(ref(getDb(), 'archive'), patch)
}

export async function loadArchive(): Promise<Record<string, ArchiveEntry>> {
  await ensureSignedIn()
  const snap = await get(ref(getDb(), 'archive'))
  return snap.exists() ? (snap.val() as Record<string, ArchiveEntry>) : {}
}

export async function clearArchive(): Promise<void> {
  await remove(ref(getDb(), 'archive'))
}
