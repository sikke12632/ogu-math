/**
 * 보드 뷰 — 전자칠판. 로그인 없이 URL 만으로 열리는 읽기 전용 화면.
 *
 * **개인 점수 · 개인 등수 · 개인 정답률은 절대 띄우지 않는다.**
 * 팀 단위 집계, 진행 상황, 참여 현황만 그린다.
 * 풀이 중에는 "누가 몇 개 맞았는지"가 아니라 **제출 인원수만** 보여 준다.
 *
 * 글자는 교실 뒤에서 읽히는 크기로.
 */

import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Qr } from '../../components/Qr'
import { getGame } from '../../games'
import { codeToSessionId } from '../../session/api'
import { mvpOf } from '../../session/teams'
import { Confetti } from './Confetti'

/** 칠판 팀 색. styles-session.css 의 .board-team.t1~ 과 같은 순서여야 한다 */
const TEAM_COLORS = ['#ef5350', '#42a5f5', '#ffca28', '#66bb6a', '#ab47bc', '#ffa726']
import {
  fmtClock, nameOf, quizTimeLeft, readableError, teamList, useSession, useTeamScores, useTick,
} from '../../session/useSession'

const CHEER = ['좋아, 침착하게', '천천히 읽어도 돼', '거의 다 왔어', '끝까지 해 보자']

/**
 * 게임 중에 늘 띄워 두는 팀 명단.
 *
 * 팀 배정 화면에서 한 번 보여 주고 넘어가면 아이들이 자기 팀을 잊는다.
 * 판이 시작되면 "저 어느 팀이에요?" 하고 손을 든다 — 그때마다 진행이 멈춘다.
 * 점수 밑에 계속 붙여 두면 고개만 들면 확인된다.
 *
 * 별명으로 보인다 (칠판 규칙). 개인 점수는 여기 없다.
 */
function TeamRoster({
  teams, label,
}: {
  teams: { id: string; name: string; members: string[] }[]
  label: (id: string) => string
}) {
  return (
    <div className="board-roster">
      {teams.map((t, ti) => (
        <div key={t.id} className="board-roster-team">
          <h3 style={{ color: TEAM_COLORS[ti % TEAM_COLORS.length] }}>{t.name}팀</h3>
          <ul>
            {t.members.map((m) => (
              <li key={m}>{label(m)}</li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  )
}

/**
 * 칠판 구석에 늘 붙어 있는 방 코드.
 *
 * 대기실에는 QR 과 함께 코드가 크게 뜨지만 문제를 풀기 시작하면 사라졌다.
 * 그런데 **튕기거나 실수로 창을 닫는 일은 풀이 중에 제일 많이 생긴다.**
 * 그때 학생이 스스로 돌아올 방법이 없어 매번 선생님을 불러야 했다.
 * 고개만 들면 보이도록 끝까지 띄워 둔다.
 */
function CodeCorner({ code }: { code: string }) {
  return (
    <p className="board-corner">
      다시 들어오려면 <b>{code}</b>
    </p>
  )
}

export function BoardView() {
  const { code = '' } = useParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  // 칠판은 누가 붙어 있는지 보여 줘야 하므로 신호를 받는다.
  // 학생 화면은 안 받는다 — 그래야 사용량이 안 터진다
  const { session, error } = useSession(sessionId ?? undefined, { withPresence: true })
  const [enterError, setEnterError] = useState<string | null>(null)
  const now = useTick(300)

  useEffect(() => {
    codeToSessionId(code)
      .then((id) => {
        if (id) setSessionId(id)
        else setNotFound(true)
      })
      .catch((e) => setEnterError(readableError(e)))
  }, [code])

  // QR 에는 '#' 을 넣지 않는다. 크롬북 QR 앱 중에 '#' 이 있으면 못 여는 것들이 있다.
  // 앱이 시작할 때 ?c= 를 보고 알아서 학생 화면으로 보낸다 (App.tsx)
  const joinUrl = `${location.origin}${location.pathname}?c=${code.toUpperCase()}`
  const roster = useMemo(() => Object.values(session?.roster ?? {}), [session?.roster])
  const joined = roster.filter((r) => r.joinedAt > 0)
  const submitted = Object.values(session?.quiz ?? {}).filter((q) => q.submittedAt).length
  const teams = teamList(session)
  const scores = useTeamScores(session)

  if (notFound) {
    return (
      <div className="board board-center">
        <h1 className="board-huge">코드를 찾을 수 없어요</h1>
        <p className="board-sub">선생님 화면의 6자리 코드를 다시 확인해 주세요.</p>
      </div>
    )
  }
  if (enterError ?? error) {
    return (
      <div className="board board-center">
        <h1 className="board-huge">열 수 없어요</h1>
        <p className="board-sub">{enterError ?? error}</p>
      </div>
    )
  }
  if (!session) {
    return (
      <div className="board board-center">
        <p className="board-sub">불러오는 중…</p>
      </div>
    )
  }

  const phase = session.meta.phase
  const left = quizTimeLeft(session, now)

  if (phase === 'lobby') {
    return (
      <div className="board board-lobby">
        <div className="board-join">
          <p className="board-eyebrow">크롬북으로 들어오세요</p>
          <Qr value={joinUrl} size={380} />
          <p className="board-code">{session.meta.code}</p>
          <p className="board-sub">카메라로 QR을 찍거나, 주소창에 코드를 넣으세요</p>
        </div>
        <div className="board-arrivals">
          <p className="board-eyebrow">
            들어온 사람 <b>{joined.length}</b> / {roster.length}
          </p>
          <ul className="board-names">
            {joined
              .slice()
              .sort((a, b) => b.joinedAt - a.joinedAt)
              .map((r) => (
                // 칠판에는 그날 정한 별명이 보인다. 실명은 교사 화면에만
                <li key={r.name} className="pop">
                  {r.nickname && r.nickname.trim() ? r.nickname : r.name}
                </li>
              ))}
          </ul>
        </div>
      </div>
    )
  }

  if (phase === 'quiz') {
    const pct = joined.length ? (submitted / joined.length) * 100 : 0
    return (
      <div className="board board-center">
        <p className="board-eyebrow">문제 푸는 중</p>
        <p className={`board-timer${left < 60_000 ? ' hot' : ''}`}>{fmtClock(left)}</p>
        <p className="board-submit">
          <b>{submitted}</b> / {joined.length} 제출
        </p>
        <div className="board-progress">
          <div className="board-progress-fill" style={{ width: `${pct}%` }} />
        </div>
        <p className="board-sub">{CHEER[Math.floor(now / 8000) % CHEER.length]}</p>
        {session.meta.paused && <p className="board-paused">잠시 멈춤</p>}
        <CodeCorner code={session.meta.code} />
      </div>
    )
  }

  if (phase === 'grading') {
    return (
      <div className="board board-center">
        <p className="board-eyebrow">채점 중</p>
        <div className="board-dots">
          <span /><span /><span />
        </div>
        <p className="board-sub">잠깐만 기다려 주세요</p>
        <CodeCorner code={session.meta.code} />
      </div>
    )
  }

  if (phase === 'teaming') {
    return (
      <div className="board">
        <p className="board-eyebrow board-pad">팀이 정해졌습니다</p>
        <div className="board-teamreveal">
          {teams.map((t, ti) => (
            <div key={t.id} className={`board-team t${ti + 1}`}>
              <h2>{t.name}팀</h2>
              <ul>
                {t.members.map((m, mi) => (
                  <li key={m} style={{ animationDelay: `${ti * 0.12 + mi * 0.22}s` }}>
                    {nameOf(session, m)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <CodeCorner code={session.meta.code} />
      </div>
    )
  }

  if (phase === 'game') {
    const round = session.game?.round ?? 1
    const cheerleaders = session.game?.rounds?.[String(round)]?.cheerleaders ?? []
    let Board = null
    try {
      Board = getGame(session.meta.gameId).BoardComponent
    } catch {
      Board = null
    }
    return (
      <div className="board board-center">
        {Board ? (
          <Board
            teams={teams.map((t) => ({ id: t.id, name: t.name, members: t.members }))}
            scores={scores}
            round={round}
          />
        ) : null}
        <p className="board-sub">
          {round} / {session.meta.rounds}판
          {cheerleaders.length > 0 && ` · 응원단장 ${cheerleaders.map((c) => nameOf(session, c)).join(', ')}`}
        </p>
        <TeamRoster
          teams={teams.map((t) => ({ id: t.id, name: t.name, members: t.members }))}
          label={(m) => nameOf(session, m)}
        />
        <CodeCorner code={session.meta.code} />
      </div>
    )
  }

  // result
  const ranked = [...teams].sort(
    (a, b) => (scores.find((s) => s.teamId === b.id)?.points ?? 0) - (scores.find((s) => s.teamId === a.id)?.points ?? 0),
  )
  /*
   * 우승 팀을 크게 세운다. 등수만 죽 늘어놓으면 아이들이 아무 반응을 안 한다.
   *
   * **개인 점수와 등수는 여기에 절대 안 띄운다** (설계 원칙).
   * 팀 이름·팀 점수·팀원 명단·MVP 까지만 나온다. 명단은 별명으로 보인다.
   */
  const top = scores.find((s) => s.teamId === ranked[0]?.id)?.points ?? 0
  // 공동 우승이면 모두 세운다
  const champs = ranked.filter((t) => (scores.find((s) => s.teamId === t.id)?.points ?? 0) === top)
  const rest = ranked.filter((t) => !champs.includes(t))
  const champColor = TEAM_COLORS[teams.findIndex((t) => t.id === champs[0]?.id) % TEAM_COLORS.length]

  return (
    <div className="board board-result">
      <Confetti accent={champColor} />

      <div className="win">
        <p className="win-eyebrow">오늘의 우승</p>
        <p className="win-trophy" aria-hidden="true">🏆</p>
        <h1 className="win-name" style={{ color: champColor }}>
          {champs.map((t) => `${t.name}팀`).join(' · ')}
        </h1>
        <p className="win-score">{top}점</p>

        <ul className="win-members">
          {champs
            .flatMap((t) => t.members)
            .map((m, i) => (
              // 이름이 하나씩 튀어나온다. 아이들이 자기 이름을 찾는다
              <li key={m} style={{ animationDelay: `${0.35 + i * 0.12}s` }}>
                {nameOf(session, m)}
              </li>
            ))}
        </ul>

        {champs.map((t) => {
          const mvp = mvpOf(t, session.game?.mvp ?? {})
          return mvp ? (
            <p key={t.id} className="win-mvp">
              <b>MVP</b> {nameOf(session, mvp)}
            </p>
          ) : null
        })}
      </div>

      {rest.length > 0 && (
        <ol className="board-rank rest" start={champs.length + 1}>
          {rest.map((t) => {
            const mvp = mvpOf(t, session.game?.mvp ?? {})
            return (
              <li key={t.id}>
                <span className="board-rank-name">{t.name}팀</span>
                <span className="board-rank-wins">{scores.find((s) => s.teamId === t.id)?.points ?? 0}점</span>
                <span className="board-rank-mvp">{mvp ? `MVP ${nameOf(session, mvp)}` : ''}</span>
              </li>
            )
          })}
        </ol>
      )}

      <p className="board-sub board-pad">틀린 문제는 각자 기기에서 확인하세요</p>
      <CodeCorner code={session.meta.code} />
    </div>
  )
}
