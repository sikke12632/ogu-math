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
import {
  fmtClock, nameOf, quizTimeLeft, readableError, teamList, useSession, useTeamScores, useTick,
} from '../../session/useSession'

const CHEER = ['좋아, 침착하게', '천천히 읽어도 돼', '거의 다 왔어', '끝까지 해 보자']

export function BoardView() {
  const { code = '' } = useParams()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const { session, error } = useSession(sessionId ?? undefined)
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
      </div>
    )
  }

  // result
  const ranked = [...teams].sort(
    (a, b) => (scores.find((s) => s.teamId === b.id)?.wins ?? 0) - (scores.find((s) => s.teamId === a.id)?.wins ?? 0),
  )
  return (
    <div className="board">
      <p className="board-eyebrow board-pad">오늘 결과</p>
      <ol className="board-rank">
        {ranked.map((t, i) => {
          const mvp = mvpOf(t, session.game?.mvp ?? {})
          return (
            <li key={t.id}>
              <span className="board-rank-no">{i + 1}</span>
              <span className="board-rank-name">{t.name}팀</span>
              <span className="board-rank-wins">{scores.find((s) => s.teamId === t.id)?.wins ?? 0}승</span>
              <span className="board-rank-mvp">{mvp ? `MVP ${nameOf(session, mvp)}` : ''}</span>
            </li>
          )
        })}
      </ol>
      <p className="board-sub board-pad">틀린 문제는 각자 기기에서 확인하세요</p>
    </div>
  )
}
