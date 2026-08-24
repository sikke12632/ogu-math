/**
 * 학생 뷰 — 자기 것만 본다.
 * 코드 진입 → 이름 선택 → 대기 → 풀이 → 결과 → 우리 팀 → 대전 → 오답 확인
 *
 * phase 는 읽기만 한다. 여기서 절대 바꾸지 않는다.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { DrawDuel } from '../../games/draw-duel/DrawDuel'
import {
  claimSeat, codeToSessionId, heartbeat, mirroredAnswers, rememberedName, rememberedSeat,
  rememberName, saveAnswers, sendCheer, submitQuiz, voteMvp, writeForfeit, writeMatchResult, writeTurn,
} from '../../session/api'
import { grade, shuffleChoices, type Answer } from '../../session/grade'
import { mvpOf } from '../../session/teams'
import type { StudentId } from '../../session/types'
import {
  fmtClock, isCheerleader, myMatch, nameOf, quizTimeLeft, readableError, realNameOf, roundMatches,
  teamList, useSession, useTeamScores, useTick,
} from '../../session/useSession'
import { NicknamePicker } from './NicknamePicker'
import { QuestionCard } from './QuestionCard'

export function PlayView() {
  const { code = '' } = useParams()
  const nav = useNavigate()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [me, setMe] = useState<StudentId | null>(null)
  const [seatError, setSeatError] = useState<string | null>(null)
  const { session, error: sessionError } = useSession(sessionId ?? undefined)
  const [enterError, setEnterError] = useState<string | null>(null)
  const now = useTick(400)

  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [cursor, setCursor] = useState(0)
  const [submitted, setSubmitted] = useState(false)
  const [showWrong, setShowWrong] = useState(false)
  // 자리를 잡은 뒤 딱 한 번, 그날 쓸 별명을 고르는 화면을 띄운다
  const [nickDone, setNickDone] = useState(false)
  const [editNick, setEditNick] = useState(false)

  /* ── 코드 → 세션 ─────────────────────────────────── */
  useEffect(() => {
    codeToSessionId(code)
      .then((id) => {
        if (id) setSessionId(id)
        else setNotFound(true)
      })
      // 조용히 멈추면 원인을 못 찾는다. 왜 못 들어갔는지 화면에 띄운다
      .catch((e) => setEnterError(readableError(e)))
  }, [code])

  /* ── 다른 수업으로 옮기면 앉았던 자리를 놓는다 ────────
     이걸 안 하면 앞 세션의 자리 번호를 그대로 들고 들어가서,
     이름을 고르지도 않았는데 남의 자리로 접속한 것처럼 보인다 */
  useEffect(() => {
    setMe(null)
    setAnswers({})
    setSubmitted(false)
    setCursor(0)
    setShowWrong(false)
    setNickDone(false)
    setEditNick(false)
  }, [sessionId])

  /* ── 지난번에 앉았던 자리로 바로 복귀 ───────────────── */
  useEffect(() => {
    if (!sessionId || me) return
    const remembered = rememberedSeat(sessionId)
    if (!remembered) return
    // 이 기기가 잡았던 자리다. 새로고침·화면 덮기로 튕겼어도 그대로 돌려준다
    void claimSeat(sessionId, remembered, true).then((ok) => {
      if (ok) setMe(remembered)
    })
  }, [sessionId, me])

  /* ── 접속 유지 ───────────────────────────────────── */
  useEffect(() => {
    if (!sessionId || !me) return
    void heartbeat(sessionId, me)
    const t = setInterval(() => void heartbeat(sessionId, me), 4000)
    return () => clearInterval(t)
  }, [sessionId, me])

  /* ── 답안 복구 — 서버와 로컬 중 최신 것 ─────────────── */
  useEffect(() => {
    if (!sessionId || !me || !session) return
    const server = session.quiz?.[me]?.answers ?? {}
    const local = mirroredAnswers(sessionId, me)
    const serverCount = Object.values(server).filter((v) => v != null).length
    const localCount = Object.values(local).filter((v) => v != null).length
    setAnswers((cur) => (Object.keys(cur).length > 0 ? cur : localCount > serverCount ? local : server))
    if (session.quiz?.[me]?.submittedAt) setSubmitted(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, me, Boolean(session)])

  const problems = useMemo(() => {
    if (!session || !me) return []
    return session.problems.map((p) => shuffleChoices(p, `${session.meta.code}|${me}`))
  }, [session, me])

  const setAnswer = useCallback(
    (qid: string, a: Answer) => {
      setAnswers((prev) => {
        const next = { ...prev, [qid]: a }
        if (sessionId && me) saveAnswers(sessionId, me, next)
        return next
      })
    },
    [sessionId, me],
  )

  const doSubmit = useCallback(() => {
    if (!sessionId || !me) return
    setSubmitted(true)
    void submitQuiz(sessionId, me, answers)
  }, [sessionId, me, answers])

  const left = quizTimeLeft(session, now)

  /* 시간이 끝나면 지금까지 쓴 답으로 자동 제출된다 */
  useEffect(() => {
    if (!session || session.meta.phase !== 'quiz' || submitted) return
    if (left > 0) return
    doSubmit()
  }, [session, left, submitted, doSubmit])

  /* ── 화면 ────────────────────────────────────────── */

  if (notFound) {
    return (
      <div className="wrap play-center">
        <h1>코드를 찾을 수 없어요</h1>
        <p className="sub">칠판의 6자리 코드를 다시 확인해 주세요.</p>
        <button className="ghost" onClick={() => nav('/join')}>코드 다시 넣기</button>
      </div>
    )
  }
  if (enterError ?? sessionError) {
    return (
      <div className="wrap play-center">
        <h1>못 들어갔어요</h1>
        <p className="notice error">{enterError ?? sessionError}</p>
        <div className="row">
          <button className="ghost" onClick={() => location.reload()}>다시 해보기</button>
          <button className="ghost" onClick={() => nav('/check')}>무엇이 막혔는지 확인</button>
        </div>
      </div>
    )
  }
  if (!session) return <div className="wrap play-center"><p>들어가는 중…</p></div>

  /* 이름 고르기 */
  if (!me) {
    const remembered = rememberedName()
    const seats = Object.entries(session.roster ?? {})
    return (
      <div className="wrap">
        <header className="site-head">
          <p className="eyebrow">코드 {session.meta.code}</p>
          <h1>이름을 고르세요</h1>
        </header>
        {seatError && <p className="notice error">{seatError}</p>}
        <ul className="seatgrid">
          {seats.map(([sid, r]) => {
            const taken = r.joinedAt > 0 && r.connected
            return (
              <li key={sid}>
                <button
                  className={`seat${r.name === remembered ? ' mine' : ''}`}
                  disabled={taken}
                  onClick={() => {
                    void claimSeat(sessionId!, sid).then((ok) => {
                      if (ok) {
                        setMe(sid)
                        rememberName(r.name)
                        setSeatError(null)
                      } else {
                        setSeatError('그 이름은 다른 기기가 쓰고 있어요. 선생님께 말해 주세요.')
                      }
                    })
                  }}
                >
                  {r.name}
                  {taken && <span className="seat-taken">들어옴</span>}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    )
  }

  const phase = session.meta.phase
  const myName = nameOf(session, me)
  const myRealName = realNameOf(session, me)

  /* 별명 정하기 — 대기실에서 한 번, 그리고 원할 때 다시 */
  const nickSet = Boolean(session.roster?.[me]?.nickname)
  if (editNick || (phase === 'lobby' && !nickDone && !nickSet)) {
    return (
      <NicknamePicker
        sessionId={sessionId!}
        me={me}
        realName={myRealName}
        current={session.roster?.[me]?.nickname}
        onDone={() => {
          setNickDone(true)
          setEditNick(false)
        }}
      />
    )
  }
  const result = grade(problems, answers)
  const teams = teamList(session)
  const myTeam = teams.find((t) => t.members.includes(me)) ?? null

  if (phase === 'lobby') {
    return (
      <div className="wrap play-center">
        <p className="eyebrow">{myName}</p>
        <h1>들어왔어요</h1>
        <p className="sub">선생님이 시작할 때까지 기다려 주세요.</p>
        <div className="waitdots"><span /><span /><span /></div>
        <button className="ghost" onClick={() => setEditNick(true)}>별명 바꾸기</button>
      </div>
    )
  }

  if (phase === 'quiz') {
    if (submitted) {
      return (
        <div className="wrap play-center">
          <p className="eyebrow">{myName}</p>
          <h1>제출했어요</h1>
          <p className="sub">남은 시간 {fmtClock(left)} · 다른 친구를 기다리는 중</p>
          <button className="ghost" onClick={() => setSubmitted(false)}>답 고치기</button>
        </div>
      )
    }
    const p = problems[cursor]
    if (!p) return <div className="wrap"><p>문제를 불러오는 중…</p></div>
    const answered = problems.filter((q) => answers[q.id] != null).length
    const warn = left <= 30_000
    return (
      <div className="wrap">
        <div className="topbar">
          <span className={warn ? 'timer warn' : 'timer'}>{fmtClock(left)}</span>
          <span className="progresstext">{answered} / {problems.length} 답함</span>
        </div>
        <div className="progress">
          <div className="progress-fill" style={{ width: `${(answered / problems.length) * 100}%` }} />
        </div>
        {warn && <p className="notice">마감까지 30초. 지금까지 쓴 답으로 채점됩니다.</p>}
        {session.meta.paused && <p className="notice">잠시 멈췄어요. 선생님을 봐 주세요.</p>}

        <QuestionCard
          problem={p}
          index={cursor}
          total={problems.length}
          given={answers[p.id] ?? null}
          onChange={(a) => setAnswer(p.id, a)}
        />

        <nav className="pager">
          <button className="ghost" onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0}>이전</button>
          <ul className="dots">
            {problems.map((q, i) => (
              <li key={q.id}>
                <button
                  className={[i === cursor ? 'here' : '', answers[q.id] != null ? 'done' : ''].filter(Boolean).join(' ')}
                  onClick={() => setCursor(i)}
                  aria-label={`${i + 1}번으로`}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
          <button className="ghost" onClick={() => setCursor((c) => Math.min(problems.length - 1, c + 1))} disabled={cursor === problems.length - 1}>다음</button>
        </nav>

        <button className="primary big" onClick={doSubmit}>다 풀었어요 · 제출하기</button>
      </div>
    )
  }

  if (phase === 'grading') {
    return (
      <div className="wrap play-center">
        <h1>채점 중</h1>
        <div className="waitdots"><span /><span /><span /></div>
      </div>
    )
  }

  if (phase === 'teaming') {
    return (
      <div className="wrap play-center">
        <div className="scorebox">
          <p className="eyebrow">{myName}</p>
          <p className="score"><strong>{result.score}</strong> / {result.total}점</p>
          <p className="sub">{result.count}문항 중 {result.correctCount}문항 맞았어요.</p>
        </div>
        {myTeam ? (
          <>
            <p className="eyebrow">우리 팀</p>
            <h1 className="teamname">{myTeam.name}팀</h1>
            <p className="sub">{myTeam.members.map((m) => nameOf(session, m)).join(' · ')}</p>
          </>
        ) : (
          <p className="sub">팀을 정하는 중…</p>
        )}
      </div>
    )
  }

  if (phase === 'game') {
    return <GamePhase sessionId={sessionId!} me={me} />
  }

  // result
  const wrong = result.items.filter((i) => !i.correct)
  return (
    <div className="wrap">
      {showWrong ? (
        <>
          <header className="site-head">
            <p className="eyebrow">틀린 문제</p>
            <h1>다시 보기</h1>
          </header>
          {wrong.map((item) => (
            <section key={item.problem.id} className="reviewitem">
              <QuestionCard
                problem={item.problem}
                index={problems.indexOf(item.problem)}
                total={problems.length}
                given={item.given}
                onChange={() => {}}
                readOnly
              />
              <div className="explain">
                <p className="mine">내가 쓴 답: {item.given === null ? '(안 씀)' : Array.isArray(item.given) ? item.given.join(', ') : item.given}</p>
                <p className="right">정답: {Array.isArray(item.problem.answer) ? item.problem.answer.join(', ') : item.problem.answer}</p>
                {item.problem.explanation.split('\n').map((line, i) => <p key={i}>{line}</p>)}
              </div>
            </section>
          ))}
          <button className="ghost" onClick={() => setShowWrong(false)}>결과로 돌아가기</button>
        </>
      ) : (
        <ResultPhase
          sessionId={sessionId!}
          me={me}
          myTeamName={myTeam?.name ?? null}
          score={result.score}
          total={result.total}
          wrongCount={wrong.length}
          onShowWrong={() => setShowWrong(true)}
        />
      )}
    </div>
  )
}

/* ── 게임 단계 ─────────────────────────────────────── */

function GamePhase({ sessionId, me }: { sessionId: string; me: StudentId }) {
  const { session } = useSession(sessionId)
  const round = session?.game?.round ?? 1
  const match = myMatch(session, round, me)
  const cheerleader = isCheerleader(session, round, me)
  const teams = teamList(session)
  const myTeam = teams.find((t) => t.members.includes(me)) ?? null

  if (!session) return <div className="wrap play-center"><p>불러오는 중…</p></div>

  if (cheerleader && myTeam) {
    return <Cheerleader sessionId={sessionId} me={me} round={round} />
  }

  if (!match) {
    return (
      <div className="wrap play-center">
        <p className="eyebrow">{round} / {session.meta.rounds}판</p>
        <h1>상대를 정하는 중</h1>
        <div className="waitdots"><span /><span /><span /></div>
      </div>
    )
  }

  const opp = match.players.find((p) => p !== me)!
  return (
    // 게임 화면은 넓게 쓴다. 통과 점수를 좌우로 놓아야 글씨를 키울 수 있다
    <div className="wrap wide">
      <DrawDuel
        match={match}
        me={me}
        nameOf={(id) => nameOf(session, id)}
        opponentConnected={session.roster?.[opp]?.connected ?? false}
        roundLabel={`${round} / ${session.meta.rounds}판`}
        cheerAt={session.game?.cheers?.[me]}
        onChoose={(turn, choice) => void writeTurn(sessionId, round, match.id, turn, me, choice)}
        onResult={(winner) => void writeMatchResult(sessionId, round, match.id, winner)}
        onForfeit={(loser, winner) => void writeForfeit(sessionId, round, match.id, loser, winner)}
      />
    </div>
  )
}

/**
 * 응원단장 — 인원이 홀수면 매 판 한 명이 상대 없이 남는다.
 * 부전승 처리보다 낫다. 쉬는 게 아니라 역할이 생기기 때문이다.
 *
 * **카드는 보이지 않는다. 점수만 본다** — 훈수를 막기 위해서다.
 */
function Cheerleader({ sessionId, me, round }: { sessionId: string; me: StudentId; round: number }) {
  const { session } = useSession(sessionId)
  const teams = teamList(session)
  const myTeam = teams.find((t) => t.members.includes(me))
  const matches = roundMatches(session, round)
  const [sent, setSent] = useState<StudentId | null>(null)
  const [voted, setVoted] = useState<StudentId | null>(null)

  if (!session || !myTeam) return <div className="wrap play-center"><p>불러오는 중…</p></div>

  const teammates = myTeam.members.filter((m) => m !== me)
  const mine = matches.filter((m) => m.players.some((p) => myTeam.members.includes(p)))

  return (
    <div className="wrap">
      <header className="site-head">
        <p className="eyebrow">{round}판 · {myTeam.name}팀 응원단장</p>
        <h1>우리 팀을 응원해 주세요</h1>
        <p className="sub">이번 판은 쉬는 대신 응원단장이에요. 다음 판에는 다시 대결합니다.</p>
      </header>

      <section className="panel">
        <h2>우리 팀 대결 현황</h2>
        <ul className="matchlist">
          {mine.map((m) => {
            const ours = m.players.find((p) => myTeam.members.includes(p))!
            const theirs = m.players.find((p) => p !== ours)!
            return (
              <li key={m.id}>
                <span>{nameOf(session, ours)} vs {nameOf(session, theirs)}</span>
                <span className={m.winner ? 'done' : 'playing'}>
                  {m.winner === 'draw' ? '무승부' : m.winner ? (myTeam.members.includes(m.winner) ? '이김' : '짐') : '진행 중'}
                </span>
              </li>
            )
          })}
        </ul>
      </section>

      <section className="panel">
        <h2>응원 보내기</h2>
        <div className="cheergrid">
          {teammates.map((t) => (
            <button
              key={t}
              className={`cheerbtn${sent === t ? ' sent' : ''}`}
              onClick={() => {
                void sendCheer(sessionId, t)
                setSent(t)
                setTimeout(() => setSent(null), 1200)
              }}
            >
              {nameOf(session, t)}
              <span>응원!</span>
            </button>
          ))}
        </div>
      </section>

      <section className="panel">
        <h2>이번 판 우리 팀 MVP</h2>
        <div className="cheergrid">
          {teammates.map((t) => (
            <button
              key={t}
              className={`cheerbtn${voted === t ? ' sent' : ''}`}
              onClick={() => {
                void voteMvp(sessionId, me, t)
                setVoted(t)
              }}
            >
              {nameOf(session, t)}
              <span>MVP</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

/* ── 결과 단계 ─────────────────────────────────────── */

function ResultPhase(p: {
  sessionId: string
  me: StudentId
  myTeamName: string | null
  score: number
  total: number
  wrongCount: number
  onShowWrong: () => void
}) {
  const { session } = useSession(p.sessionId)
  const teams = teamList(session)
  const scores = useTeamScores(session)
  const myTeam = teams.find((t) => t.members.includes(p.me)) ?? null
  const myWins = myTeam ? scores.find((s) => s.teamId === myTeam.id)?.wins ?? 0 : 0
  const mvp = myTeam ? mvpOf(myTeam, session?.game?.mvp ?? {}) : null

  // 내 전적은 작게. 팀 결과가 크게 (설계보고서 3.7)
  const mine = session
    ? Object.values(session.game?.rounds ?? {})
        .flatMap((r) => Object.values(r.matches ?? {}))
        .filter((m) => m.players.includes(p.me) && m.winner)
    : []
  const w = mine.filter((m) => m.winner === p.me).length
  const d = mine.filter((m) => m.winner === 'draw').length
  const l = mine.length - w - d

  return (
    <div className="play-center">
      <p className="eyebrow">오늘 결과</p>
      <h1 className="teamname">{p.myTeamName ?? '우리'}팀 {myWins}승</h1>
      {mvp && <p className="sub">우리 팀 MVP · {nameOf(session, mvp)}</p>}
      <p className="myrecord">내 전적 {w}승 {l}패 {d}무 · 문제 {p.score} / {p.total}점</p>
      {p.wrongCount > 0 && (
        <button className="primary big" onClick={p.onShowWrong}>
          내가 틀린 문제 {p.wrongCount}개 보기
        </button>
      )}
    </div>
  )
}
