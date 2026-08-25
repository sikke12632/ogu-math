/**
 * 번호 뽑기 대전 — 게임 모듈 등록.
 * 계약은 하나뿐이다: **입력은 팀 배정, 출력은 팀별 점수.**
 */

import type { GameBoardProps, GameModule, MatchResult, TeamScore } from '../_types'
import type { Team } from '../_types'

/**
 * 점수 계산.
 *   이김 = 1점
 *   이겼는데 응원단장이 그 친구한테 걸었으면 = 2점
 *   지거나 비기면 = 0점 (배팅했다가 져도 잃는 건 없다)
 *
 * 두 응원단장이 같은 친구한테 걸어도 2점이다. 3점이 되지 않는다.
 */
export const BET_MULTIPLIER = 2

export function resolveTeamScores(results: MatchResult[], teams: Team[]): TeamScore[] {
  const teamOf = new Map<string, string>()
  for (const t of teams) for (const m of t.members) teamOf.set(m, t.id)

  const points = new Map<string, number>()
  for (const t of teams) points.set(t.id, 0)
  for (const r of results) {
    if (!r.winner) continue
    const tid = teamOf.get(r.winner)
    if (!tid) continue
    const backed = (r.bettedOn ?? []).includes(r.winner)
    points.set(tid, (points.get(tid) ?? 0) + (backed ? BET_MULTIPLIER : 1))
  }
  return teams.map((t) => ({ teamId: t.id, points: points.get(t.id) ?? 0 }))
}

/** 보드 뷰에 뜨는 팀 점수. **개인 전적은 절대 그리지 않는다** */
function DrawDuelBoard({ teams, scores, round }: GameBoardProps) {
  const max = Math.max(1, ...scores.map((s) => s.points))
  return (
    <div className="board-game">
      <p className="board-eyebrow">{round}번째 판 진행 중</p>
      <ul className="board-teams">
        {teams.map((t) => {
          const s = scores.find((x) => x.teamId === t.id)
          const pts = s?.points ?? 0
          return (
            <li key={t.id}>
              <span className="board-team-name">{t.name}팀</span>
              <span className="board-bar">
                <span className="board-bar-fill" style={{ width: `${(pts / max) * 100}%` }} />
              </span>
              <span className="board-team-wins">{pts}점</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/** 실제 대전 화면은 세션 레이어가 직접 붙인다(매칭 정보가 필요해서). 여기는 계약용 */
function DrawDuelPlaceholder() {
  return null
}

export const drawDuel: GameModule = {
  id: 'draw-duel',
  name: '번호 뽑기 대전',
  tagline: '통을 흔들어 번호 공을 뽑는다. 꽝을 뽑으면 그 자리에서 패배. 응원단장은 팀원 한 명에게 건다.',
  grouping: 'duel',
  matchSize: 2,
  rounds: 3,
  Component: DrawDuelPlaceholder,
  BoardComponent: DrawDuelBoard,
  resolve: resolveTeamScores,
}

export default drawDuel
