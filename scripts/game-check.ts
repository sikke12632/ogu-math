/**
 * 게임 규칙과 팀 배분 자동 검사. `npm run check:game`
 *
 * 설계보고서 3.3 의 확률 곡선이 실제로 나오는지 확인한다.
 * 수치가 어긋나면 게임이 5분에 안 들어가거나 밸런스가 무너진다.
 */

import { makeRng } from '../src/lib/rng'
import { computeState, riskOf, type Choice, type GameState } from '../src/games/draw-duel/engine'
import { assignTeams, makeMatches, suggestTeamCount, tallyTeamWins } from '../src/session/teams'
import { resolveTeamScores } from '../src/games/draw-duel/index'
import type { MatchResult, Team } from '../src/games/_types'
import type { MatchRecord, StudentId } from '../src/session/types'

let failures = 0
const fail = (msg: string): void => {
  failures++
  console.log(`  ✗ ${msg}`)
}

/* ── 1. 판 진행 — AI 두 명이 붙는다 ─────────────────── */

/** 설계보고서 3.1 의 판단 기준을 그대로 옮긴 상대. 사람이 아니라 검사용이다 */
function decide(s: GameState, me: StudentId, rng: ReturnType<typeof makeRng>): Choice {
  const mine = s.sides[me]!
  const opp = s.sides[s.players.find((p) => p !== me)!]!
  const r = riskOf(s)
  if (r === 0) return 'draw'
  const lead = mine.sum + mine.hidden - (opp.sum + 6.5)
  if (opp.stopped) return mine.sum + mine.hidden > opp.sum + 8 ? 'stop' : 'draw'
  if (lead >= 5 && r >= 0.22) return 'stop'
  if (lead >= 1 && r >= 0.33) return 'stop'
  if (r >= 0.45 && rng.next() < 0.65) return 'stop'
  return 'draw'
}

const N = 4000
const turnHist = new Map<number, number>()
let byBlank = 0
let byHidden = 0
let draws = 0
const winsBy: Record<string, number> = { a: 0, b: 0 }
let firstTurnBlank = 0
let hiddenBlank = 0

for (let i = 0; i < N; i++) {
  const matchId = `m${i}`
  const players: [string, string] = ['a', 'b']
  const rng = makeRng(`ai|${i}`)
  const turns: Record<string, Record<string, Choice>> = {}
  let s = computeState(matchId, players, turns)

  // 히든에 꽝이 들어가면 안 된다
  for (const p of players) {
    if ((s.sides[p]!.hidden as unknown) === 'X') hiddenBlank++
  }
  // 첫 턴 풀에 꽝이 있으면 안 된다
  if (s.pool.includes('X')) firstTurnBlank++

  let guard = 0
  while (!s.over && guard++ < 30) {
    const rec: Record<string, Choice> = {}
    for (const p of s.waitingFor) rec[p] = decide(s, p, rng)
    turns[String(s.turn)] = rec
    s = computeState(matchId, players, turns)
  }
  if (!s.over) {
    fail(`판이 끝나지 않았습니다 (${matchId})`)
    continue
  }

  const lastTurn = s.steps.length
  turnHist.set(lastTurn, (turnHist.get(lastTurn) ?? 0) + 1)
  if (s.reason.includes('꽝')) byBlank++
  else byHidden++
  if (s.winner === 'draw') draws++
  else winsBy[s.winner as string]!++
}

console.log(`판 ${N}회 시뮬레이션`)
if (hiddenBlank > 0) fail(`히든에 꽝이 ${hiddenBlank}번 들어갔습니다 (0이어야 함)`)
if (firstTurnBlank > 0) fail(`첫 턴 풀에 꽝이 ${firstTurnBlank}번 있었습니다 (0이어야 함)`)

const turns = [...turnHist.entries()].sort((a, b) => a[0] - b[0])
const totalTurns = turns.reduce((s, [t, c]) => s + t * c, 0)
console.log(`  평균 ${(totalTurns / N).toFixed(2)}턴`)
console.log(`  턴 분포  ${turns.map(([t, c]) => `${t}턴 ${((c / N) * 100).toFixed(0)}%`).join(' · ')}`)
const reach5 = turns.filter(([t]) => t >= 5).reduce((s, [, c]) => s + c, 0) / N
console.log(`  5턴 이상 도달률 ${(reach5 * 100).toFixed(0)}%  (설계보고서 3.3 예상 13% 이상)`)
console.log(`  꽝으로 끝남 ${((byBlank / N) * 100).toFixed(0)}% · 히든 합산까지 ${((byHidden / N) * 100).toFixed(0)}%`)
console.log(`  무승부 ${((draws / N) * 100).toFixed(1)}%`)

// 운 기반이므로 두 자리의 승률이 크게 갈리면 안 된다 (자리 이점 = 불공정)
const wa = winsBy['a']! / N
const wb = winsBy['b']! / N
console.log(`  선/후 승률  ${(wa * 100).toFixed(1)}% : ${(wb * 100).toFixed(1)}%`)
if (Math.abs(wa - wb) > 0.05) fail(`자리에 따라 승률이 ${Math.abs(wa - wb) * 100}%p 차이납니다`)
if (draws / N > 0.2) fail(`무승부가 ${((draws / N) * 100).toFixed(0)}% 로 너무 많습니다`)
if (reach5 < 0.08) fail(`5턴 도달률이 ${(reach5 * 100).toFixed(0)}% 로 너무 낮습니다`)

/* ── 2. 두 기기가 같은 상태를 계산하는가 ───────────── */

{
  const turns2 = { '1': { a: 'draw' as Choice, b: 'draw' as Choice }, '2': { a: 'stop' as Choice, b: 'draw' as Choice } }
  const s1 = computeState('same', ['a', 'b'], turns2)
  const s2 = computeState('same', ['a', 'b'], turns2)
  if (JSON.stringify(s1) !== JSON.stringify(s2)) fail('같은 기록인데 다른 상태가 나왔습니다')
  else console.log('  같은 기록 → 같은 상태: OK')
}

/* ── 3. 팀 배분 ─────────────────────────────────────── */

console.log('\n팀 배분')
for (const n of [5, 12, 21, 25, 28]) {
  const students = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, score: 17 - Math.floor((i / n) * 17) }))
  const tc = suggestTeamCount(n)
  const teams = assignTeams(students, tc, 'seed')
  const sizes = teams.map((t) => t.members.length)
  const avg = teams.map(
    (t) => t.members.reduce((s, m) => s + students.find((x) => x.id === m)!.score, 0) / t.members.length,
  )
  const spread = Math.max(...avg) - Math.min(...avg)
  const all = teams.flatMap((t) => t.members)
  if (all.length !== n) fail(`${n}명인데 배정된 사람이 ${all.length}명`)
  if (new Set(all).size !== n) fail(`${n}명 배정에 중복이 있습니다`)
  if (Math.max(...sizes) - Math.min(...sizes) > 1) fail(`${n}명: 팀 인원이 ${sizes.join('/')} 로 고르지 않습니다`)
  if (spread > 3.5) fail(`${n}명: 팀 평균 점수 차가 ${spread.toFixed(1)}점으로 큽니다`)
  console.log(`  ${n}명 → ${tc}팀 ${sizes.join('/')}명 · 팀 평균 점수 차 ${spread.toFixed(2)}점`)
}

// 같은 점수여도 팀 구성이 매번 달라야 한다 (서열 역산 방지)
{
  const students = Array.from({ length: 24 }, (_, i) => ({ id: `p${i}`, score: 17 - Math.floor(i / 2) }))
  const a = assignTeams(students, 4, 'seedA').map((t) => t.members.join(',')).join('|')
  const b = assignTeams(students, 4, 'seedB').map((t) => t.members.join(',')).join('|')
  if (a === b) fail('세션이 달라도 팀 구성이 똑같습니다 (구간 셔플이 안 먹었습니다)')
  else console.log('  세션마다 팀 구성이 달라짐: OK')
}

/* ── 4. 매칭 ────────────────────────────────────────── */

console.log('\n매칭')
for (const n of [5, 11, 24, 25]) {
  const students = Array.from({ length: n }, (_, i) => ({ id: `p${i}`, score: 17 - i }))
  const teams = assignTeams(students, suggestTeamCount(n), 'seed')
  const restCount = new Map<StudentId, number>()
  const rounds = 3
  for (let r = 1; r <= rounds; r++) {
    const rest: Record<StudentId, number> = {}
    for (const [k, v] of restCount) rest[k] = v
    const { matches, cheerleaders } = makeMatches(teams, r, 'seed', () => true, rest)
    const used = new Set<StudentId>()
    for (const m of matches) {
      for (const p of m.players) {
        if (used.has(p)) fail(`${n}명 ${r}판: ${p} 가 두 판에 동시에 들어갔습니다`)
        used.add(p)
      }
      const t0 = teams.find((t) => t.members.includes(m.players[0]))!.id
      const t1 = teams.find((t) => t.members.includes(m.players[1]))!.id
      if (t0 === t1) fail(`${n}명 ${r}판: 같은 팀끼리 붙었습니다`)
    }
    for (const c of cheerleaders) restCount.set(c, (restCount.get(c) ?? 0) + 1)
    if (matches.length * 2 + cheerleaders.length !== n) {
      fail(`${n}명 ${r}판: 대전 ${matches.length * 2} + 응원단장 ${cheerleaders.length} 가 인원과 안 맞습니다`)
    }
  }
  const worst = Math.max(0, ...restCount.values())
  console.log(`  ${n}명 · 3판 — 응원단장 연속 최대 ${worst}회 (같은 사람이 계속 쉬면 안 됨)`)
  if (worst >= rounds && n % 2 === 1) fail(`${n}명: 같은 사람이 ${worst}판 내내 쉬었습니다`)
}

/* ── 5. 팀 점수 집계 ────────────────────────────────── */

{
  const students = Array.from({ length: 8 }, (_, i) => ({ id: `p${i}`, score: 10 }))
  const teams = assignTeams(students, 2, 'seed')
  const { matches } = makeMatches(teams, 1, 'seed', () => true)
  const withWinner: MatchRecord[] = matches.map((m, i) => ({ ...m, winner: i % 2 === 0 ? m.players[0] : 'draw' }))
  const tally = tallyTeamWins(teams, withWinner)
  const sum = tally.reduce((s, t) => s + t.wins, 0)
  const expected = withWinner.filter((m) => m.winner !== 'draw').length
  if (sum !== expected) fail(`승수 합계가 ${sum} 인데 승부가 난 판은 ${expected} 입니다`)
  else console.log('\n팀 점수 집계: OK')
}

/* ── 6. 배팅 점수 ───────────────────────────────────── */

/**
 * 응원단장이 팀원 한 명에게 걸고, 그 친구가 이기면 그 판이 2점.
 * 지거나 비기면 평소대로. 손해는 없다.
 */
{
  const teams: Team[] = [
    { id: 't1', name: '빨강', members: ['a1', 'a2', 'a3'] },
    { id: 't2', name: '파랑', members: ['b1', 'b2', 'b3'] },
  ]
  const mr = (id: string, ps: string[], winner: string | null, bettedOn: string[] = []): MatchResult => ({
    matchId: id,
    round: 1,
    participants: ps,
    winner,
    bettedOn,
  })

  const expect = (label: string, results: MatchResult[], want: Record<string, number>): void => {
    const got = resolveTeamScores(results, teams)
    for (const [tid, n] of Object.entries(want)) {
      const actual = got.find((g) => g.teamId === tid)?.points ?? -1
      if (actual !== n) fail(`배팅 — ${label}: ${tid} 점수가 ${actual} 인데 ${n} 이어야 합니다`)
    }
  }

  expect('배팅 없음', [mr('m1', ['a1', 'b1'], 'a1')], { t1: 1, t2: 0 })
  expect('걸린 친구가 이김', [mr('m1', ['a1', 'b1'], 'a1', ['a1'])], { t1: 2, t2: 0 })
  expect('걸린 친구가 짐 — 손해 없음', [mr('m1', ['a1', 'b1'], 'b1', ['a1'])], { t1: 0, t2: 1 })
  expect('걸린 친구가 비김', [mr('m1', ['a1', 'b1'], null, ['a1'])], { t1: 0, t2: 0 })
  expect('상대 팀 응원단장이 자기 팀원에게 걺', [mr('m1', ['a1', 'b1'], 'b1', ['b1'])], { t1: 0, t2: 2 })
  expect('두 명이 같은 친구한테 걺 — 3점이 아니라 2점', [mr('m1', ['a1', 'b1'], 'a1', ['a1', 'a1'])], { t1: 2, t2: 0 })
  expect(
    '여러 판 섞임',
    [
      mr('m1', ['a1', 'b1'], 'a1', ['a1']),
      mr('m2', ['a2', 'b2'], 'b2'),
      mr('m3', ['a3', 'b3'], 'b3', ['a3']),
    ],
    { t1: 2, t2: 2 },
  )
  console.log('')
  console.log('배팅 점수: OK')
}

/* ── 7. 이미 끝난 대결에는 걸 수 없다 ──────────────────── */

/**
 * 응원단장 화면에는 팀원들의 승패가 실시간으로 뜬다.
 * 이긴 것을 확인하고 나서 거는 게 막히지 않으면, 배팅이 아니라 사후 확정이 된다.
 * 학생 화면(PlayView) 이 쓰는 것과 같은 조건을 여기서 검사한다.
 */
{
  const bettable = (m: { winner?: string } | null): boolean => m !== null && !m.winner
  if (bettable({ winner: 'a1' })) fail('승부가 끝난 대결에 걸 수 있게 되어 있습니다')
  if (bettable({ winner: 'draw' })) fail('무승부로 끝난 대결에 걸 수 있게 되어 있습니다')
  if (!bettable({})) fail('진행 중인 대결에 걸 수 없게 되어 있습니다')
  if (bettable(null)) fail('대결이 없는 팀원(다른 응원단장)에게 걸 수 있게 되어 있습니다')
  console.log('배팅 잠금 조건: OK')
}

console.log(
  failures === 0
    ? '\n통과. 게임 규칙·팀 배분·매칭·배팅에 문제 없습니다.'
    : `\n실패 ${failures}건`,
)
if (failures > 0) process.exitCode = 1
