/**
 * 세션 읽기·쓰기. 화면 컴포넌트는 여기만 부르고 Firebase 를 직접 만지지 않는다.
 *
 * **Firestore 를 쓴다.** 예전에는 Realtime Database 였는데, 학교 필터(웹키퍼)가
 * `*.firebasedatabase.app` 을 막는 일이 있어 옮겼다. 자세한 사정은
 * `docs/현재_상태.md` 와 `docs/웹키퍼_허용요청.md` 에 있다.
 *
 * ── 문서를 왜 이렇게 쪼갰나 ──────────────────────────
 * Firestore 는 **한 문서에 초당 한 번쯤만 쓸 수 있다.** 25명이 한 덩어리에
 * 동시에 쓰면 그 한계에 걸린다. 그래서 "누가 쓰는가" 를 기준으로 나눴다.
 *
 *   sessions/{sid}                   교사만 씀 (meta, teams, game.round)
 *   sessions/{sid}/parts/problems    만들 때 한 번 (문항은 크고 안 바뀐다)
 *   sessions/{sid}/roster/{학생}      그 학생만 씀
 *   sessions/{sid}/quiz/{학생}        그 학생만 씀
 *   sessions/{sid}/rounds/{판}        교사만 씀 (응원단장 명단)
 *   sessions/{sid}/matches/{매치}     그 두 명만 씀
 *   sessions/{sid}/bets/{판}          응원단장들
 *   sessions/{sid}/mvp/{지목한사람}    그 사람만 씀
 *
 * 화면에는 **예전과 똑같은 모양의 `Session` 하나로 합쳐서** 넘긴다.
 * 그래서 화면 코드는 이 파일이 바뀐 것을 모른다.
 *
 * ── 접속 여부 ────────────────────────────────────────
 * Realtime Database 에는 "연결이 끊기면 서버가 알아서 표시해 주는" 기능이 있었는데
 * Firestore 에는 없다. 그래서 **마지막 신호 시각(lastSeen)이 오래됐으면 끊긴 것으로 본다.**
 *
 * 답안 유실 방지 (설계보고서 2.4):
 *   - 답 선택 즉시 화면 반영 → 500ms 디바운스 후 서버 write
 *   - 동시에 localStorage 미러링, 재접속 시 최신 것 채택
 */

import {
  collection, deleteDoc, doc, getDoc, getDocs, increment, onSnapshot, runTransaction,
  setDoc, updateDoc, writeBatch, type DocumentData, type Firestore,
} from 'firebase/firestore'
import { ensureSignedIn, getFs } from '../lib/firebase'
import { load, save } from '../lib/storage'
import type { Problem } from '../units/_types'
import type { Answer } from './grade'
import type {
  ArchiveEntry, MatchRecord, Phase, QuizEntry, RosterEntry, RoundRecord, Session, SessionMeta,
  StudentId, TeamRecord,
} from './types'

const SESSIONS = 'sessions'
const CODES = 'codes'
const ARCHIVE = 'archive'

/* ── 접속 여부 판정 ─────────────────────────────────── */

/**
 * 마지막 신호가 이보다 오래됐으면 끊긴 것으로 본다.
 *
 * 대전 중에는 짧아야 한다 — 상대가 튕겼는데 한참 기다리면 판이 멈춘다.
 * 그 밖에는 길어도 된다. 신호를 자주 보낼수록 Firestore 사용량이 늘기 때문이다.
 */
const STALE_MS_GAME = 9_000
const STALE_MS_IDLE = 60_000

/** 지금 이 세션이 어느 단계인지. heartbeat 가 얼마나 자주 쓸지 정하는 데 쓴다 */
const phaseOf = new Map<string, Phase>()

const staleLimit = (sessionId: string): number =>
  phaseOf.get(sessionId) === 'game' ? STALE_MS_GAME : STALE_MS_IDLE

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
 * **읽기 전에 반드시 익명 로그인을 먼저 한다.** 규칙이 로그인한 사람만 읽게
 * 되어 있어서, 로그인 없이 읽으면 조용히 막힌다. 학생 화면은 이게 첫 동작이라
 * 빠뜨리면 '들어가는 중…' 에서 멈춘다.
 */
export async function codeToSessionId(code: string): Promise<string | null> {
  await ensureSignedIn()
  const snap = await getDoc(doc(getFs(), CODES, code.toUpperCase()))
  return snap.exists() ? ((snap.data() as { sessionId: string }).sessionId ?? null) : null
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
  const db = getFs()

  // 코드가 겹치지 않을 때까지. 실제로는 거의 한 번에 잡힌다
  let code = randomCode()
  for (let i = 0; i < 12; i++) {
    const taken = await getDoc(doc(db, CODES, code))
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

  // 한 번에 쓴다. 중간에 끊겨서 반쪽짜리 세션이 남는 일을 막는다
  const batch = writeBatch(db)
  batch.set(doc(db, SESSIONS, sessionId), { meta, teams: {}, game: null })
  batch.set(doc(db, SESSIONS, sessionId, 'parts', 'problems'), { problems: o.problems })

  // 명단은 이름을 그대로 키로 쓰지 않는다. 동명이인과 특수문자 때문에 번호를 붙인다
  o.names.forEach((name, i) => {
    const sid = `p${String(i + 1).padStart(3, '0')}`
    const entry: RosterEntry = { name, joinedAt: 0, connected: false, lastSeen: 0 }
    batch.set(doc(db, SESSIONS, sessionId, 'roster', sid), entry)
  })

  batch.set(doc(db, CODES, code), { sessionId, createdAt: Date.now() })
  await batch.commit()
  return { sessionId, code }
}

/* ── 구독 ──────────────────────────────────────────── */

type Parts = {
  main: { meta: SessionMeta; teams: Record<string, TeamRecord>; game: { round: number } | null } | null
  problems: Problem[]
  roster: Record<StudentId, RosterEntry>
  quiz: Record<StudentId, QuizEntry>
  rounds: Record<string, { round: number; cheerleaders: StudentId[] }>
  matches: Record<string, MatchRecord>
  bets: Record<string, Record<StudentId, StudentId>>
  mvp: Record<StudentId, StudentId>
}

/** 흩어진 문서들을 화면이 아는 모양 하나로 합친다 */
function assemble(sessionId: string, p: Parts): Session | null {
  if (!p.main) return null

  // 판별로 매치를 모아 준다. 예전 Realtime Database 모양과 똑같이 맞춘다
  const rounds: Record<string, RoundRecord> = {}
  for (const [key, r] of Object.entries(p.rounds)) {
    rounds[key] = { round: r.round, matches: {}, cheerleaders: r.cheerleaders ?? [] }
  }
  for (const m of Object.values(p.matches)) {
    const key = String(m.round)
    if (!rounds[key]) rounds[key] = { round: m.round, matches: {}, cheerleaders: [] }
    rounds[key]!.matches[m.id] = m
  }

  // 접속 여부는 저장된 값만 믿지 않는다. 마지막 신호가 오래됐으면 끊긴 것으로 본다
  const limit = staleLimit(sessionId)
  const now = Date.now()
  const roster: Record<StudentId, RosterEntry> = {}
  for (const [id, r] of Object.entries(p.roster)) {
    roster[id] = { ...r, connected: Boolean(r.connected) && now - (r.lastSeen ?? 0) < limit }
  }

  return {
    meta: p.main.meta,
    problems: p.problems,
    roster,
    quiz: p.quiz,
    teams: p.main.teams ?? {},
    game: p.main.game
      ? { round: p.main.game.round ?? 1, rounds, bets: p.bets, mvp: p.mvp }
      : null,
  }
}

const byId = <T,>(docs: { id: string; data: () => DocumentData }[]): Record<string, T> => {
  const out: Record<string, T> = {}
  for (const d of docs) out[d.id] = d.data() as T
  return out
}

/**
 * 세션 구독. 여기도 **로그인이 먼저다.**
 * 규칙에 막히면 조용히 아무것도 안 오므로, 막힌 것을 onError 로 알려 준다.
 *
 * 여러 곳을 동시에 듣고 하나로 합쳐서 넘긴다.
 * 그리고 **3초마다 한 번씩 다시 넘긴다** — 서버가 조용해도 시간이 흐르면
 * "끊긴 지 오래됨" 판정이 바뀌어야 하기 때문이다. 이건 서버를 읽지 않는다.
 */
export function watchSession(
  sessionId: string,
  cb: (s: Session | null) => void,
  onError?: (e: Error) => void,
): () => void {
  const parts: Parts = {
    main: null, problems: [], roster: {}, quiz: {}, rounds: {}, matches: {}, bets: {}, mvp: {},
  }
  const stops: (() => void)[] = []
  let cancelled = false
  let ticker: ReturnType<typeof setInterval> | null = null

  const emit = (): void => {
    if (cancelled) return
    cb(assemble(sessionId, parts))
  }
  const fail = (e: unknown): void =>
    onError?.(e instanceof Error ? e : new Error(String(e)))

  void ensureSignedIn()
    .then(() => {
      if (cancelled) return
      const db = getFs()
      const s = doc(db, SESSIONS, sessionId)

      stops.push(
        onSnapshot(s, (d) => {
          parts.main = d.exists() ? (d.data() as Parts['main']) : null
          // heartbeat 가 이 값을 본다. **키는 반드시 sessionId 로 맞춘다** —
          // 코드로 넣으면 heartbeat 가 못 찾아서 대전 중에도 신호를 느리게 보낸다
          if (parts.main) phaseOf.set(sessionId, parts.main.meta.phase)
          emit()
        }, fail),
      )
      stops.push(
        onSnapshot(doc(db, SESSIONS, sessionId, 'parts', 'problems'), (d) => {
          parts.problems = d.exists() ? ((d.data() as { problems: Problem[] }).problems ?? []) : []
          emit()
        }, fail),
      )

      const sub = (name: string, put: (v: Record<string, unknown>) => void): void => {
        stops.push(
          onSnapshot(collection(db, SESSIONS, sessionId, name), (q) => {
            put(byId(q.docs))
            emit()
          }, fail),
        )
      }
      sub('roster', (v) => { parts.roster = v as Record<StudentId, RosterEntry> })
      sub('quiz', (v) => { parts.quiz = v as Record<StudentId, QuizEntry> })
      sub('rounds', (v) => { parts.rounds = v as Parts['rounds'] })
      sub('matches', (v) => { parts.matches = v as Record<string, MatchRecord> })
      sub('bets', (v) => { parts.bets = v as Record<string, Record<StudentId, StudentId>> })
      sub('mvp', (v) => {
        const out: Record<StudentId, StudentId> = {}
        for (const [voter, rec] of Object.entries(v)) out[voter] = (rec as { target: StudentId }).target
        parts.mvp = out
      })

      // 시간이 흘러 "끊김" 판정이 바뀌는 것만 반영한다. 서버는 안 읽는다
      ticker = setInterval(emit, 3000)
    })
    .catch(fail)

  return () => {
    cancelled = true
    if (ticker) clearInterval(ticker)
    for (const s of stops) s()
  }
}

/* ── 교사만 하는 일 ─────────────────────────────────── */

export async function setPhase(sessionId: string, phase: Phase): Promise<void> {
  const ref = doc(getFs(), SESSIONS, sessionId)
  // 풀이를 시작할 때만 타이머 기준을 새로 찍는다
  if (phase === 'quiz') {
    await updateDoc(ref, {
      'meta.phase': phase,
      'meta.quizStartedAt': Date.now(),
      'meta.paused': false,
      'meta.pausedAt': null,
    })
    return
  }
  await updateDoc(ref, { 'meta.phase': phase })
}

export async function addTime(sessionId: string, seconds: number): Promise<void> {
  await updateDoc(doc(getFs(), SESSIONS, sessionId), { 'meta.extraSeconds': increment(seconds) })
}

export async function setPaused(sessionId: string, paused: boolean, meta: SessionMeta): Promise<void> {
  const ref = doc(getFs(), SESSIONS, sessionId)
  if (paused) {
    await updateDoc(ref, { 'meta.paused': true, 'meta.pausedAt': Date.now() })
  } else {
    const held = meta.pausedAt ? Math.round((Date.now() - meta.pausedAt) / 1000) : 0
    await updateDoc(ref, {
      'meta.paused': false,
      'meta.pausedAt': null,
      'meta.extraSeconds': (meta.extraSeconds ?? 0) + held,
    })
  }
}

export async function saveTeams(sessionId: string, teams: Record<string, TeamRecord>): Promise<void> {
  await updateDoc(doc(getFs(), SESSIONS, sessionId), { teams })
}

export async function saveScores(
  sessionId: string,
  scores: Record<StudentId, { score: number; correctCount: number }>,
): Promise<void> {
  const db = getFs()
  const batch = writeBatch(db)
  for (const [id, v] of Object.entries(scores)) {
    batch.set(
      doc(db, SESSIONS, sessionId, 'quiz', id),
      { score: v.score, correctCount: v.correctCount },
      { merge: true },
    )
  }
  await batch.commit()
}

export async function saveRound(
  sessionId: string,
  round: number,
  matches: Record<string, MatchRecord>,
  cheerleaders: StudentId[],
): Promise<void> {
  const db = getFs()
  const batch = writeBatch(db)
  // update 가 아니라 set+merge 를 쓴다. 첫 판에는 game 이 아직 null 이라
  // update 로는 안전하게 만들 수 없다
  batch.set(doc(db, SESSIONS, sessionId), { game: { round } }, { merge: true })
  batch.set(doc(db, SESSIONS, sessionId, 'rounds', String(round)), { round, cheerleaders })
  // 매치는 두 학생이 각자 쓰므로 문서를 따로 둔다. 한 덩어리면 서로 덮어쓴다
  for (const m of Object.values(matches)) {
    batch.set(doc(db, SESSIONS, sessionId, 'matches', m.id), m)
  }
  await batch.commit()
}

export async function endSession(sessionId: string): Promise<void> {
  await setPhase(sessionId, 'result')
}

/** 하위 묶음까지 지운다. Firestore 는 상위 문서를 지워도 하위가 남는다 */
async function deleteSub(db: Firestore, sessionId: string, name: string): Promise<void> {
  const q = await getDocs(collection(db, SESSIONS, sessionId, name))
  if (q.empty) return
  const batch = writeBatch(db)
  for (const d of q.docs) batch.delete(d.ref)
  await batch.commit()
}

/** 학년말 일괄 삭제 — 세션과 코드, 기록을 지운다 */
export async function deleteSession(sessionId: string, code: string): Promise<void> {
  const db = getFs()
  for (const name of ['roster', 'quiz', 'rounds', 'matches', 'bets', 'mvp', 'parts']) {
    await deleteSub(db, sessionId, name)
  }
  await deleteDoc(doc(db, SESSIONS, sessionId))
  await deleteDoc(doc(db, CODES, code))
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
  const db = getFs()
  const seat = doc(db, SESSIONS, sessionId, 'roster', studentId)

  const ok = await runTransaction(db, async (tx) => {
    const snap = await tx.get(seat)
    if (!snap.exists()) return false
    const cur = snap.data() as RosterEntry
    // 아직 살아 있는 다른 기기가 쓰는 중이면 비켜 준다
    const alive = cur.connected && Date.now() - (cur.lastSeen ?? 0) < STALE_MS_IDLE
    if (!force && cur.joinedAt > 0 && alive) return false
    const now = Date.now()
    tx.update(seat, {
      joinedAt: cur.joinedAt > 0 ? cur.joinedAt : now,
      connected: true,
      lastSeen: now,
    })
    return true
  })

  if (ok) save(`seat:${sessionId}`, studentId)
  return ok
}

/** 이름 비교용 정리. 공백과 대소문자 차이는 같은 이름으로 본다 */
const normalizeName = (s: string): string => s.trim().replace(/\s+/g, ' ').toLowerCase()

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
  const db = getFs()
  const nickname = raw.trim().replace(/\s+/g, ' ')
  if (nickname.length > 14) return { ok: false, reason: '너무 길어요. 14글자 안으로 해 주세요.' }

  const q = await getDocs(collection(db, SESSIONS, sessionId, 'roster'))
  const clash = q.docs.some((d) => {
    if (d.id === studentId) return false
    const r = d.data() as RosterEntry
    return Boolean(r.nickname) && normalizeName(r.nickname!) === normalizeName(nickname)
  })
  if (nickname && clash) return { ok: false, reason: '친구가 벌써 쓰고 있어요. 다른 걸로 해 주세요.' }

  await updateDoc(doc(db, SESSIONS, sessionId, 'roster', studentId), { nickname: nickname || null })
  save(`nickname:${sessionId}`, nickname)
  return { ok: true }
}

/** 교사가 부적절한 별명을 지운다. 그 학생은 다시 실명으로 보인다 */
export async function clearNickname(sessionId: string, studentId: StudentId): Promise<void> {
  await updateDoc(doc(getFs(), SESSIONS, sessionId, 'roster', studentId), { nickname: null })
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

/**
 * "나 아직 있어요" 신호.
 *
 * 화면은 4초마다 부르지만 **여기서 걸러 낸다.** Firestore 는 쓴 횟수만큼
 * 값을 매기므로, 대전 중이 아닐 때까지 4초마다 쓰면 한 시간 수업 한 번에
 * 하루치 무료 한도를 다 쓴다. 대전 중에만 촘촘히 보낸다.
 */
const lastBeat = new Map<string, number>()

export async function heartbeat(sessionId: string, studentId: StudentId): Promise<void> {
  const key = `${sessionId}/${studentId}`
  const gap = phaseOf.get(sessionId) === 'game' ? 4_000 : 20_000
  const prev = lastBeat.get(key) ?? 0
  const now = Date.now()
  if (now - prev < gap) return
  lastBeat.set(key, now)
  await updateDoc(doc(getFs(), SESSIONS, sessionId, 'roster', studentId), {
    connected: true,
    lastSeen: now,
  }).catch(() => {
    // 잠깐 끊겨도 풀이는 계속되어야 한다. 다음 신호 때 다시 올라간다
    lastBeat.delete(key)
  })
}

/** 교사가 "이 학생 재접속 처리" 를 눌렀을 때 자리를 비워 준다 */
export async function releaseSeat(sessionId: string, studentId: StudentId): Promise<void> {
  await updateDoc(doc(getFs(), SESSIONS, sessionId, 'roster', studentId), {
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
      void setDoc(
        doc(getFs(), SESSIONS, sessionId, 'quiz', studentId),
        { answers },
        { merge: true },
      ).catch(() => {
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
  await setDoc(doc(getFs(), SESSIONS, sessionId, 'quiz', studentId), {
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
  await setDoc(
    doc(getFs(), SESSIONS, sessionId, 'matches', matchId),
    { round, turns: { [String(turn)]: { [studentId]: choice } } },
    { merge: true },
  )
}

export async function writeMatchResult(
  sessionId: string,
  round: number,
  matchId: string,
  winner: StudentId | 'draw',
): Promise<void> {
  await setDoc(
    doc(getFs(), SESSIONS, sessionId, 'matches', matchId),
    { round, winner, endedAt: Date.now() },
    { merge: true },
  )
}

export async function writeForfeit(
  sessionId: string,
  round: number,
  matchId: string,
  loser: StudentId,
  winner: StudentId,
): Promise<void> {
  await setDoc(
    doc(getFs(), SESSIONS, sessionId, 'matches', matchId),
    { round, forfeit: loser, winner, endedAt: Date.now() },
    { merge: true },
  )
}

/**
 * 배팅 — 응원단장이 이번 판에 팀원 한 명을 고른다.
 * 그 친구가 이기면 그 승리가 팀 점수 2점이 된다.
 *
 * 판마다 따로 저장한다. 한 번 고르면 못 바꾸는 규칙은 화면에서 막는다.
 */
export async function placeBet(
  sessionId: string,
  round: number,
  cheerleader: StudentId,
  target: StudentId,
): Promise<void> {
  await setDoc(
    doc(getFs(), SESSIONS, sessionId, 'bets', String(round)),
    { [cheerleader]: target },
    { merge: true },
  )
}

export async function voteMvp(sessionId: string, voter: StudentId, target: StudentId): Promise<void> {
  await setDoc(doc(getFs(), SESSIONS, sessionId, 'mvp', voter), { target })
}

/* ── 기록 보관 (/review) ────────────────────────────── */

export async function archive(entries: Record<string, ArchiveEntry>): Promise<void> {
  const db = getFs()
  const batch = writeBatch(db)
  for (const [key, v] of Object.entries(entries)) batch.set(doc(db, ARCHIVE, key), v)
  await batch.commit()
}

export async function loadArchive(): Promise<Record<string, ArchiveEntry>> {
  await ensureSignedIn()
  const q = await getDocs(collection(getFs(), ARCHIVE))
  return byId<ArchiveEntry>(q.docs)
}

export async function clearArchive(): Promise<void> {
  const db = getFs()
  const q = await getDocs(collection(db, ARCHIVE))
  if (q.empty) return
  const batch = writeBatch(db)
  for (const d of q.docs) batch.delete(d.ref)
  await batch.commit()
}
