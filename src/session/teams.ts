/**
 * 팀 배분과 매칭. Firebase 를 모르는 순수 함수라 단독으로 검사할 수 있다.
 *
 * 팀 배분 (설계보고서 3.6)
 *   1. 점수 내림차순 정렬
 *   2. 상·중·하 3구간으로 나눈 뒤 **구간 내에서 셔플**
 *   3. 셔플된 순서로 스네이크 드래프트 (1-2-3-4 / 4-3-2-1 / …)
 *
 * 2단계가 핵심이다. 순수 점수순 스네이크를 몇 주 돌리면 학생들이
 * 팀 구성만 보고 서열을 역산한다. 구간 내 셔플이면 팀 균형은 유지되면서
 * 개인 순위는 흐려진다.
 */

import { makeRng, type Rng } from '../lib/rng'
import type { MatchRecord, StudentId, TeamRecord } from './types'

export const TEAM_NAMES = ['빨강', '파랑', '노랑', '초록', '보라', '주황'] as const

export type Scored = { id: StudentId; score: number }

/** 인원에 맞는 팀 수. 한 팀이 3명 밑으로 떨어지지 않게 */
export function suggestTeamCount(n: number): number {
  if (n < 6) return 2
  if (n <= 12) return 2
  if (n <= 20) return 3
  return 4
}

export function assignTeams(students: Scored[], teamCount: number, seed: string): TeamRecord[] {
  const rng = makeRng(`teams|${seed}`)
  const sorted = [...students].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id))

  // 상·중·하 3구간으로 자른 뒤 구간 안에서만 섞는다
  const bandSize = Math.ceil(sorted.length / 3)
  const shuffled: Scored[] = []
  for (let i = 0; i < sorted.length; i += bandSize) {
    shuffled.push(...rng.shuffle(sorted.slice(i, i + bandSize)))
  }

  const teams: TeamRecord[] = Array.from({ length: teamCount }, (_, i) => ({
    id: `t${i + 1}`,
    name: TEAM_NAMES[i] ?? `${i + 1}팀`,
    members: [],
  }))

  // 스네이크 드래프트 — 홀수 바퀴는 정방향, 짝수 바퀴는 역방향
  shuffled.forEach((s, i) => {
    const lap = Math.floor(i / teamCount)
    const pos = i % teamCount
    const idx = lap % 2 === 0 ? pos : teamCount - 1 - pos
    teams[idx]!.members.push(s.id)
  })

  return teams
}

/**
 * 매 판 새로 매칭한다 (설계보고서 3.7).
 * 상대 팀 구성원 중 랜덤. 매칭이 고정되면 홀수 인원일 때 한 명이 세션 내내 논다.
 * 매 판 교체하면 쉬는 사람이 판마다 바뀌어 부담이 1/3로 준다.
 */
export function makeMatches(
  teams: TeamRecord[],
  round: number,
  seed: string,
  /** 이번 판에 접속해 있는 사람만 */
  available: (id: StudentId) => boolean,
  /**
   * 앞선 판에 응원단장을 몇 번 했는지. 많이 쉰 사람을 먼저 짝지어
   * 같은 학생이 세션 내내 쉬는 일을 막는다.
   * 인원이 홀수인 반에서는 이게 없으면 한 명이 세 판을 다 쉴 수 있다.
   */
  restCounts: Record<StudentId, number> = {},
): { matches: MatchRecord[]; cheerleaders: StudentId[] } {
  const rng = makeRng(`match|${seed}|${round}`)
  // pop() 은 배열 끝에서 꺼낸다 → 많이 쉰 사람을 뒤로 보내면 먼저 짝이 잡힌다
  const pools = teams.map((t) =>
    rng
      .shuffle(t.members.filter(available))
      .sort((a, b) => (restCounts[a] ?? 0) - (restCounts[b] ?? 0)),
  )

  const matches: MatchRecord[] = []
  const cheerleaders: StudentId[] = []
  let n = 0

  // 인원이 많은 팀부터 뽑아 서로 다른 팀끼리 붙인다
  for (;;) {
    const order = pools
      .map((p, i) => ({ i, len: p.length }))
      .filter((x) => x.len > 0)
      .sort((a, b) => b.len - a.len || a.i - b.i)
    if (order.length < 2) break
    const a = pools[order[0]!.i]!.pop()!
    const b = pools[order[1]!.i]!.pop()!
    const players = [a, b].sort() as [StudentId, StudentId]
    matches.push({ id: `m${round}_${++n}`, round, players })
  }

  // 남은 사람은 응원단장. 부전승보다 낫다 — 쉬는 게 아니라 역할이 생긴다
  for (const p of pools) cheerleaders.push(...p)

  return { matches, cheerleaders: cheerleaders.sort() }
}

/** 팀별 승수. 게임 모듈의 resolve() 가 이걸 쓴다 */
export function tallyTeamWins(
  teams: TeamRecord[],
  matches: MatchRecord[],
): { teamId: string; wins: number; draws: number }[] {
  const teamOf = new Map<StudentId, string>()
  for (const t of teams) for (const m of t.members) teamOf.set(m, t.id)

  const tally = new Map<string, { wins: number; draws: number }>()
  for (const t of teams) tally.set(t.id, { wins: 0, draws: 0 })

  for (const m of matches) {
    if (!m.winner) continue
    if (m.winner === 'draw') {
      for (const p of m.players) {
        const t = teamOf.get(p)
        if (t) tally.get(t)!.draws++
      }
      continue
    }
    const t = teamOf.get(m.winner)
    if (t) tally.get(t)!.wins++
  }

  return teams.map((t) => ({ teamId: t.id, ...tally.get(t.id)! }))
}

/** 팀 안에서 표를 가장 많이 받은 사람 */
export function mvpOf(team: TeamRecord, votes: Record<StudentId, StudentId>): StudentId | null {
  const count = new Map<StudentId, number>()
  for (const target of Object.values(votes)) {
    if (!team.members.includes(target)) continue
    count.set(target, (count.get(target) ?? 0) + 1)
  }
  let best: StudentId | null = null
  let bestN = 0
  for (const [id, n] of count) {
    if (n > bestN) {
      best = id
      bestN = n
    }
  }
  return best
}

/** 교사가 수동으로 팀을 옮길 때 */
export function moveMember(
  teams: TeamRecord[],
  studentId: StudentId,
  toTeamId: string,
): TeamRecord[] {
  return teams.map((t) => ({
    ...t,
    members:
      t.id === toTeamId
        ? [...t.members.filter((m) => m !== studentId), studentId]
        : t.members.filter((m) => m !== studentId),
  }))
}

export type { Rng }
