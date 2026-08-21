/**
 * 번호 뽑기 대전 — 판 진행 규칙. Firebase 도 React 도 모르는 순수 함수다.
 *
 * **덱을 서버에 저장하지 않는다.** matchId 를 시드로 양쪽이 같은 덱을 계산하고,
 * 서버에는 "몇 턴에 누가 뽑기/스탑을 골랐는지"만 남긴다.
 * 그래서 두 학생 화면이 어긋날 수가 없고, 판당 쓰기도 몇 건뿐이다.
 *
 * 규칙 (설계보고서 3.2 — 바꾸지 말 것)
 *   카드 풀      숫자 1~12 각 1장 + 꽝 2장
 *   히든         각자 1장 비공개. 히든에는 꽝이 들어가지 않는다
 *   첫 턴        꽝 없음. 꽝 2장은 1턴이 끝난 뒤 풀에 들어간다
 *   스탑         영구. 한 번 접으면 그 판에서 다시 못 뽑는다
 *   꽝           뽑는 즉시 패배. 동시에 뽑으면 무승부
 *   종료         양쪽 스탑 → 히든 공개 후 합산, 높은 쪽 승. 동점 무승부
 */

import { makeRng } from '../../lib/rng'

export type Card = number | 'X'
export type Choice = 'draw' | 'stop'
export type PlayerId = string

export const MAX_NUMBER = 12
export const BLANKS = 2
/** 턴 제한시간. 고정이 아니라 상한이다 — 빨리 고르면 바로 넘어간다 */
export const TURN_LIMIT_SEC = 10

export type Side = {
  id: PlayerId
  hidden: number
  cards: Card[]
  sum: number
  stopped: boolean
  dead: boolean
}

export type Step = {
  turn: number
  /** 이 턴에 각자 뽑은 카드. 스탑했으면 null */
  drew: Record<PlayerId, Card | null>
  /** 이 턴이 끝난 뒤 꽝이 풀에 들어갔는지 */
  blanksAdded: boolean
}

export type GameState = {
  players: [PlayerId, PlayerId]
  sides: Record<PlayerId, Side>
  /** 통 안에 남은 카드 */
  pool: Card[]
  turn: number
  blanksIn: boolean
  over: boolean
  winner: PlayerId | 'draw' | null
  /** 사람에게 보여줄 결말 한 줄 */
  reason: string
  /** 아직 고르지 않은 사람 */
  waitingFor: PlayerId[]
  /** 턴별 진행 기록 — 화면 애니메이션이 이걸 따라간다 */
  steps: Step[]
  /** 히든을 공개해도 되는 시점인지 */
  revealed: boolean
}

export type TurnLog = Record<string, Record<PlayerId, Choice>>

/**
 * Firebase 는 키가 "1","2","3" 처럼 연속된 숫자면 객체가 아니라 **배열로** 돌려준다.
 * 그러면 앞자리가 null 로 채워진다. 어느 쪽으로 와도 같게 읽히도록 한 번 정리한다.
 */
function turnAt(turns: TurnLog | undefined, t: number): Record<PlayerId, Choice> {
  if (!turns) return {}
  const v = (turns as Record<string, unknown>)[String(t)]
  return (v as Record<PlayerId, Choice>) ?? {}
}

/** 판 시작 상태. players 는 오름차순으로 들어와야 한다 */
function initial(matchId: string, players: [PlayerId, PlayerId]): {
  state: GameState
  shuffleBlanks: (pool: Card[]) => Card[]
} {
  const rng = makeRng(`duel|${matchId}`)
  const deck = rng.shuffle(Array.from({ length: MAX_NUMBER }, (_, i) => i + 1))
  // 히든 먼저 — 그래서 히든에는 꽝이 들어갈 수 없다
  const h0 = deck.pop()!
  const h1 = deck.pop()!

  const mk = (id: PlayerId, hidden: number): Side => ({
    id, hidden, cards: [], sum: 0, stopped: false, dead: false,
  })

  return {
    state: {
      players,
      sides: { [players[0]]: mk(players[0], h0), [players[1]]: mk(players[1], h1) },
      pool: deck,
      turn: 1,
      blanksIn: false,
      over: false,
      winner: null,
      reason: '',
      waitingFor: [...players],
      steps: [],
      revealed: false,
    },
    shuffleBlanks: (pool) => rng.shuffle(pool),
  }
}

const totalOf = (s: Side): number => s.sum + s.hidden

/**
 * 턴 기록을 처음부터 되짚어 현재 상태를 만든다.
 * 같은 기록이면 어느 기기에서 계산해도 같은 결과가 나온다.
 */
export function computeState(
  matchId: string,
  players: [PlayerId, PlayerId],
  turns: TurnLog | undefined,
  forfeit?: { loser: PlayerId; winner: PlayerId },
): GameState {
  const { state, shuffleBlanks } = initial(matchId, players)
  const s = state

  if (forfeit) {
    s.over = true
    s.winner = forfeit.winner
    s.reason = '상대의 연결이 끊겼어'
    s.revealed = true
    s.waitingFor = []
    return s
  }

  for (let t = 1; t <= 40; t++) {
    const active = players.filter((p) => !s.sides[p]!.stopped && !s.sides[p]!.dead)
    const rec = turnAt(turns, t)
    const missing = active.filter((p) => !rec[p])
    if (missing.length > 0) {
      s.turn = t
      s.waitingFor = missing
      return s
    }

    // 이 턴의 선택을 적용한다. 뽑는 순서는 players 순서로 고정 — 그래야 재현된다
    const step: Step = { turn: t, drew: {}, blanksAdded: false }
    for (const p of players) {
      const side = s.sides[p]!
      if (side.stopped || side.dead) {
        step.drew[p] = null
        continue
      }
      if (rec[p] === 'stop') {
        side.stopped = true
        step.drew[p] = null
        continue
      }
      const c = s.pool.pop()
      if (c === undefined) {
        side.stopped = true
        step.drew[p] = null
        continue
      }
      side.cards.push(c)
      if (c === 'X') side.dead = true
      else side.sum += c
      step.drew[p] = c
    }

    const [a, b] = players
    const A = s.sides[a]!
    const B = s.sides[b]!

    if (A.dead && B.dead) return finish(s, step, 'draw', '둘 다 꽝을 뽑았어')
    if (A.dead) return finish(s, step, b, '꽝이 나왔어')
    if (B.dead) return finish(s, step, a, '꽝이 나왔어')
    if (A.stopped && B.stopped) return final(s, step)

    // 1턴이 끝나면 꽝 2장이 들어간다. 첫 턴은 안전하다
    if (!s.blanksIn) {
      s.pool.push('X', 'X')
      s.pool = shuffleBlanks(s.pool)
      s.blanksIn = true
      step.blanksAdded = true
    }
    s.steps.push(step)

    if (s.pool.length === 0) {
      const last: Step = { turn: t + 1, drew: {}, blanksAdded: false }
      return final(s, last)
    }
  }

  s.waitingFor = []
  return s
}

function finish(s: GameState, step: Step, winner: PlayerId | 'draw', reason: string): GameState {
  s.steps.push(step)
  s.over = true
  s.winner = winner
  s.reason = reason
  s.revealed = true
  s.waitingFor = []
  return s
}

function final(s: GameState, step: Step): GameState {
  const [a, b] = s.players
  const ta = totalOf(s.sides[a]!)
  const tb = totalOf(s.sides[b]!)
  const winner = ta > tb ? a : tb > ta ? b : 'draw'
  return finish(s, step, winner, `${ta} 대 ${tb}`)
}

/* ── 화면이 쓰는 값들 ───────────────────────────────── */

export const blanksLeft = (s: GameState): number => s.pool.filter((c) => c === 'X').length

/** 지금 뽑으면 꽝이 나올 확률 */
export const riskOf = (s: GameState): number =>
  s.pool.length === 0 ? 0 : blanksLeft(s) / s.pool.length

export function opponentOf(s: GameState, me: PlayerId): PlayerId {
  return s.players[0] === me ? s.players[1] : s.players[0]
}

/** 상대 히든은 판이 끝나기 전엔 알 수 없다 */
export function visibleHidden(s: GameState, viewer: PlayerId, of: PlayerId): number | null {
  if (viewer === of || s.revealed) return s.sides[of]!.hidden
  return null
}
