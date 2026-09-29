/**
 * 2배 버튼 — 문제 풀이와 대전을 잇는 고리.
 *
 * 아이들이 "문제를 잘 풀어도 게임에서 달라지는 게 없다" 고 했다. 맞는 말이었다 —
 * 점수는 팀을 고르게 나누는 데만 쓰였다. 그렇다고 점수로 대전을 유리하게 해 주면
 * 잘하는 아이가 계속 이기는 게임이 된다.
 *
 * 그래서 **승률은 안 건드리고 걸린 점수만 키우는 권한**을 준다.
 * 누르면 그 판은 누가 이기든 2배다. 상대가 이겨도 2배라서 공짜가 아니다 —
 * 유리해 보일 때 눌러야 하고, 그 판단이 곧 재미다.
 */

import { grade } from './grade'
import type { MatchRecord, Session, StudentId } from './types'

/**
 * 만점이면 이만큼 받고, **하나 틀릴 때마다 하나씩 준다.** 만점 5 · 1개 틀림 4 · … · 5개 이상 틀리면 0.
 *
 * 처음에는 점수 비율(90%·75%·60%)로 끊었는데, 아이들 점수가 고만고만해서
 * 거의 다 같은 칸에 들어갔다. 한 문제 차이가 버튼 하나 차이로 보여야
 * "저 문제만 맞혔으면" 이 생긴다. 안 푼 문제도 틀린 것으로 센다.
 */
export const DOUBLE_MAX = 5

/**
 * 턴 시간이 이만큼 안 남았으면 못 누른다.
 * 이 게임에서 끝나는 시각이 정해진 것은 턴 제한시간(화면 아래 막대)뿐이다.
 * 막판에 누르는 것을 막아야 상대가 "2배" 를 보고 뽑을지 멈출지 다시 생각할 틈이 생긴다.
 */
export const DOUBLE_LOCK_MS = 5_000

export function doubleAllowance(correctCount: number, count: number): number {
  // 하나도 못 맞혔으면 없다. 4문항짜리 시험에서 0점인데 하나 받는 일을 막는다
  if (count <= 0 || correctCount <= 0) return 0
  return Math.max(0, DOUBLE_MAX - (count - correctCount))
}

/** 이 학생이 이번 시험으로 받은 횟수. 교사 채점이 아직 안 왔으면 직접 채점해 본다 */
export function allowanceOf(session: Session | null, me: StudentId): number {
  if (!session) return 0
  const entry = session.quiz?.[me]
  const correct = entry?.correctCount ?? grade(session.problems, entry?.answers ?? {}).correctCount
  return doubleAllowance(correct, session.problems.length)
}

/** 지금까지 쓴 횟수. "한 판 더" 를 하면 매치가 지워지므로 저절로 0 이 된다 */
export function doublesUsed(matches: MatchRecord[], me: StudentId): number {
  return matches.filter((m) => m.doubles?.[me] != null).length
}

export const isDoubled = (m: MatchRecord | null | undefined): boolean =>
  Object.keys(m?.doubles ?? {}).length > 0
