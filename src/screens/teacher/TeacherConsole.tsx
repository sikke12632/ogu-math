/**
 * 교사 콘솔 — 제어. 학생에게 보이지 않는 화면이다.
 *
 * 수동 제어 버튼이 핵심이다. 자동 전이가 실패해도 수업이 멈추면 안 된다.
 * `다음 단계로` 는 어떤 phase 에서도 눌린다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { getGame } from '../../games'
import { josaRo } from '../../units/_helpers'
import {
  addTime, archive, clearNickname, releaseSeat, saveRound, saveScores, saveTeams, setPaused, setPhase,
} from '../../session/api'
import { grade } from '../../session/grade'
import { assignTeams, makeMatches, moveMember, mvpOf, suggestTeamCount } from '../../session/teams'
import { PHASE_LABEL, PHASE_ORDER, type ArchiveEntry, type Phase, type StudentId, type TeamRecord } from '../../session/types'
import {
  fmtClock, quizTimeLeft, realNameOf, roundMatches, teamList, useSession, useTeamScores, useTick,
} from '../../session/useSession'

export function TeacherConsole() {
  const { id = '' } = useParams()
  const { session, loading, error } = useSession(id)
  const now = useTick(400)
  const [busy, setBusy] = useState(false)
  // 서버 쓰기가 실패하면 조용히 넘어가면 안 된다. 수업 중에 원인을 못 찾는다
  const [opError, setOpError] = useState<string | null>(null)
  const gradedRef = useRef(false)
  const teamedRef = useRef(false)
  const builtRef = useRef<Set<number>>(new Set())
  const advancedRef = useRef<Set<number>>(new Set())

  const boardUrl = session ? `${location.origin}${location.pathname}#/board/${session.meta.code}` : ''
  const playUrl = session ? `${location.origin}${location.pathname}?c=${session.meta.code}` : ''

  const roster = useMemo(() => Object.entries(session?.roster ?? {}), [session?.roster])
  // 자리를 잡았거나 지금 붙어 있으면 '들어온 학생' 으로 본다.
  // 둘 중 하나만 봐서 한 명이라도 빠지면 팀이 어그러진다
  const joined = roster.filter(([, r]) => r.joinedAt > 0 || r.connected)
  const connected = roster.filter(([, r]) => r.connected)
  const submitted = Object.entries(session?.quiz ?? {}).filter(([, q]) => q.submittedAt)
  const left = quizTimeLeft(session, now)
  const teams = teamList(session)
  const scores = useTeamScores(session)

  /* ── 채점 — grading 에 들어오면. 아직 저장 안 됐으면 다시 시도한다 ── */
  useEffect(() => {
    if (!session || session.meta.phase !== 'grading') return
    if (joined.length === 0 || gradedRef.current) return
    if (joined.every(([sid]) => session.quiz?.[sid]?.score != null)) return
    gradedRef.current = true
    const out: Record<StudentId, { score: number; correctCount: number }> = {}
    for (const [sid] of joined) {
      const answers = session.quiz?.[sid]?.answers ?? {}
      const r = grade(session.problems, answers)
      out[sid] = { score: r.score, correctCount: r.correctCount }
    }
    saveScores(id, out).catch((e) => setOpError('채점 저장 실패: ' + (e instanceof Error ? e.message : String(e))))
  }, [session, id, joined])

  /* ── 팀 배분 — teaming 에 들어오면.
     한 번 실패했다고 영영 포기하면 안 된다. 팀이 생길 때까지 다시 시도한다 ── */
  useEffect(() => {
    if (!session || session.meta.phase !== 'teaming') return
    if (Object.keys(session.teams ?? {}).length > 0) return
    if (teamedRef.current) return
    const students = joined.map(([sid]) => ({ id: sid, score: session.quiz?.[sid]?.score ?? 0 }))
    if (students.length < 2) return // 아직 아무도 안 들어옴 — 다음 스냅샷에서 다시
    teamedRef.current = true
    const built = assignTeams(students, suggestTeamCount(students.length), session.meta.code)
    const rec: Record<string, TeamRecord> = {}
    for (const t of built) rec[t.id] = t
    saveTeams(id, rec).catch((e) => {
      teamedRef.current = false
      setOpError('팀 배분 저장 실패: ' + (e instanceof Error ? e.message : String(e)))
    })
  }, [session, id, joined])

  /* ── 매 판 매칭 — 판이 바뀌면 새로 짠다 ─────────────── */
  const buildRound = useCallback(
    (round: number, force = false) => {
      if (!session || teams.length < 2) return
      // 같은 판을 두 번 짜면 진행 중인 대전이 지워진다
      if (!force && builtRef.current.has(round)) return
      builtRef.current.add(round)
      const conn = new Set(connected.map(([sid]) => sid))
      // 앞선 판에 쉰 횟수를 세어 넘긴다. 같은 학생이 계속 쉬면 안 된다
      const rest: Record<StudentId, number> = {}
      for (const r of Object.values(session.game?.rounds ?? {})) {
        for (const c of r.cheerleaders ?? []) rest[c] = (rest[c] ?? 0) + 1
      }
      const { matches, cheerleaders } = makeMatches(teams, round, session.meta.code, (sid) => conn.has(sid), rest)
      const rec: Record<string, typeof matches[number]> = {}
      for (const m of matches) rec[m.id] = m
      saveRound(id, round, rec, cheerleaders).catch((e) => setOpError('매칭 저장 실패: ' + (e instanceof Error ? e.message : String(e))))
    },
    [session, teams, connected, id],
  )

  /* 지금 판의 매칭이 없으면 짠다 */
  useEffect(() => {
    if (!session || session.meta.phase !== 'game') return
    const round = session.game?.round ?? 0
    if (round === 0) return buildRound(1)
    if (!session.game?.rounds?.[String(round)]) buildRound(round)
  }, [session, buildRound])

  /* ── 판이 다 끝나면 자동으로 다음 판 ──────────────────
     결과를 잠깐 보여 준 뒤 넘어간다. 바로 넘기면 누가 이겼는지 못 본다 */
  useEffect(() => {
    if (!session || session.meta.phase !== 'game') return
    const round = session.game?.round ?? 1
    const ms = roundMatches(session, round)
    if (ms.length === 0 || !ms.every((m) => m.winner)) return
    if (advancedRef.current.has(round)) return
    advancedRef.current.add(round)
    const t = setTimeout(() => {
      if (round >= session.meta.rounds) void setPhase(id, 'result')
      else buildRound(round + 1)
    }, 4000)
    return () => clearTimeout(t)
  }, [session, id, buildRound])

  /* ── 풀이 시간이 다 되면 자동 마감 ──────────────────── */
  useEffect(() => {
    if (!session || session.meta.phase !== 'quiz' || session.meta.paused) return
    if (left > 0) return
    void setPhase(id, 'grading')
  }, [session, left, id])

  const next = async (): Promise<void> => {
    if (!session) return
    setBusy(true)
    const i = PHASE_ORDER.indexOf(session.meta.phase)
    const to = PHASE_ORDER[Math.min(i + 1, PHASE_ORDER.length - 1)]!
    await setPhase(id, to)
    setBusy(false)
  }

  const goto = async (p: Phase): Promise<void> => {
    setBusy(true)
    await setPhase(id, p)
    setBusy(false)
  }

  const saveArchive = async (): Promise<void> => {
    if (!session) return
    setBusy(true)
    const entries: Record<string, ArchiveEntry> = {}
    for (const [sid, r] of joined) {
      const answers = session.quiz?.[sid]?.answers ?? {}
      const g = grade(session.problems, answers)
      entries[`${id}_${sid}`] = {
        sessionId: id,
        code: session.meta.code,
        unitId: session.meta.unitId,
        date: session.meta.createdAt,
        name: r.name,
        score: g.score,
        total: g.total,
        items: g.items.map((it) => ({
          prompt: it.problem.prompt,
          given: it.given === null ? '' : Array.isArray(it.given) ? it.given.join(', ') : it.given,
          answer: Array.isArray(it.problem.answer) ? it.problem.answer.join(', ') : it.problem.answer,
          explanation: it.problem.explanation,
          correct: it.correct,
          // 그림과 보기를 함께 남긴다. 수직선 문항은 발문만으로는 다시 볼 수 없다
          ...(it.problem.visual ? { visual: it.problem.visual } : {}),
          ...(it.problem.choices ? { choices: it.problem.choices } : {}),
          ...(it.problem.choiceVisuals ? { choiceVisuals: it.problem.choiceVisuals } : {}),
        })),
      }
    }
    await archive(entries)
    setBusy(false)
  }

  if (loading) return <div className="wrap"><p>불러오는 중…</p></div>
  if (error) return <div className="wrap"><p className="notice error">{error}</p></div>
  if (!session) return <div className="wrap"><p className="notice error">세션을 찾을 수 없습니다.</p></div>

  const phase = session.meta.phase

  return (
    <div className="console">
      <header className="console-head">
        <div>
          <p className="eyebrow">교사 콘솔 · 학생에게 보이지 않는 화면</p>
          <h1>
            {PHASE_LABEL[phase]}
            {phase === 'quiz' && <span className="console-clock">{fmtClock(left)}</span>}
          </h1>
        </div>
        <div className="console-code">
          <span className="code">{session.meta.code}</span>
          <a href={boardUrl} target="_blank" rel="noreferrer" className="ghost small">
            전자칠판 화면 열기
          </a>
        </div>
      </header>

      {opError && <p className="notice error">{opError}</p>}

      <div className="console-ctrl">
        <button className="primary" onClick={() => void next()} disabled={busy}>
          다음 단계로 →
        </button>
        <button className="ghost" onClick={() => void setPaused(id, !session.meta.paused, session.meta)} disabled={phase !== 'quiz'}>
          {session.meta.paused ? '다시 시작' : '일시정지'}
        </button>
        <button className="ghost" onClick={() => void addTime(id, 120)} disabled={phase !== 'quiz'}>
          타이머 +2분
        </button>
        <select value={phase} onChange={(e) => void goto(e.target.value as Phase)} disabled={busy}>
          {PHASE_ORDER.map((p) => (
            <option key={p} value={p}>
              {PHASE_LABEL[p]}{josaRo(PHASE_LABEL[p])} 이동
            </option>
          ))}
        </select>
      </div>

      <div className="console-grid">
        <section className="panel">
          <h2>접속 현황 <span className="count">{connected.length} / {roster.length}</span></h2>
          <ul className="namelist">
            {roster.map(([sid, r]) => (
              <li key={sid} className={r.connected ? 'on' : r.joinedAt ? 'dropped' : ''}>
                <span>
                  {r.name}
                  {r.nickname && <em className="nick">{r.nickname}</em>}
                </span>
                {r.nickname && (
                  <button
                    className="tiny"
                    title="별명을 지웁니다. 이상한 별명을 썼을 때 쓰세요. 그 학생은 다시 실제 이름으로 보입니다."
                    onClick={() => void clearNickname(id, sid)}
                  >
                    별명 지우기
                  </button>
                )}
                {r.joinedAt > 0 && (
                  <button
                    className="tiny"
                    title="이 이름을 다시 고를 수 있게 자리를 비웁니다. 기기가 멈춰서 다른 크롬북으로 옮길 때 쓰세요."
                    onClick={() => void releaseSeat(id, sid)}
                  >
                    자리 비우기
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="hint">학생 주소: <code>{playUrl}</code></p>
        </section>

        {phase === 'quiz' && (
          <section className="panel">
            <h2>제출 현황 <span className="count">{submitted.length} / {joined.length}</span></h2>
            <ul className="namelist">
              {joined
                .filter(([sid]) => !session.quiz?.[sid]?.submittedAt)
                .map(([sid, r]) => (
                  <li key={sid}>{r.name} <span className="dim">아직</span></li>
                ))}
            </ul>
          </section>
        )}

        {(phase === 'grading' || phase === 'teaming' || phase === 'result') && (
          <section className="panel">
            <h2>문항별 정답률 <span className="dim">교사만 봅니다</span></h2>
            <ul className="ratelist">
              {session.problems.map((p, i) => {
                const rows = joined.map(([sid]) => grade([p], session.quiz?.[sid]?.answers ?? {}))
                const ok = rows.filter((r) => r.correctCount === 1).length
                const pct = rows.length ? Math.round((ok / rows.length) * 100) : 0
                return (
                  <li key={p.id}>
                    <span className="qn">{i + 1}</span>
                    <span className="bar"><span className="fill" style={{ width: `${pct}%` }} /></span>
                    <span className="pct">{pct}%</span>
                    <span className="tid">{p.templateId}</span>
                  </li>
                )
              })}
            </ul>
            <p className="hint">정답률이 낮은 문항을 다시 설명하세요.</p>
          </section>
        )}

        {(phase === 'teaming' || phase === 'game' || phase === 'result') && teams.length > 0 && (
          <section className="panel">
            <h2>팀 구성 <span className="dim">드롭다운으로 옮길 수 있습니다</span></h2>
            <div className="teamgrid">
              {teams.map((t) => (
                <div key={t.id} className="teamcol">
                  <h3>{t.name}팀</h3>
                  <ul>
                    {t.members.map((m) => (
                      <li key={m}>
                        <span>{realNameOf(session, m)}</span>
                        <select
                          value={t.id}
                          onChange={(e) => {
                            const moved = moveMember(teams, m, e.target.value)
                            const rec: Record<string, TeamRecord> = {}
                            for (const x of moved) rec[x.id] = x
                            void saveTeams(id, rec)
                          }}
                        >
                          {teams.map((x) => (
                            <option key={x.id} value={x.id}>{x.name}</option>
                          ))}
                        </select>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </section>
        )}

        {phase === 'game' && (
          <section className="panel">
            <h2>
              대전 현황
              <span className="count">
                {session.game?.round ?? 1} / {session.meta.rounds}판
              </span>
            </h2>
            <ul className="matchlist">
              {roundMatches(session, session.game?.round ?? 1).map((m) => (
                <li key={m.id}>
                  <span>{realNameOf(session, m.players[0])} vs {realNameOf(session, m.players[1])}</span>
                  <span className={m.winner ? 'done' : 'playing'}>
                    {m.forfeit
                      ? `${realNameOf(session, m.forfeit)} 끊김`
                      : m.winner === 'draw'
                        ? '무승부'
                        : m.winner
                          ? `${realNameOf(session, m.winner)} 승`
                          : '진행 중'}
                  </span>
                </li>
              ))}
            </ul>
            {(session.game?.rounds?.[String(session.game?.round ?? 1)]?.cheerleaders ?? []).length > 0 && (
              <p className="hint">
                응원단장:{' '}
                {(session.game?.rounds?.[String(session.game?.round ?? 1)]?.cheerleaders ?? [])
                  .map((c) => realNameOf(session, c))
                  .join(', ')}
              </p>
            )}
            <button className="ghost small" onClick={() => buildRound((session.game?.round ?? 1) + 1, true)}>
              다음 판 강제로 시작
            </button>
          </section>
        )}

        {phase === 'result' && (
          <section className="panel">
            <h2>세션 요약</h2>
            <ul className="scorelist">
              {teams.map((t) => (
                <li key={t.id}>
                  <b>{t.name}팀</b> {scores.find((s) => s.teamId === t.id)?.wins ?? 0}승
                  <span className="dim"> · MVP {mvpOf(t, session.game?.mvp ?? {}) ? realNameOf(session, mvpOf(t, session.game?.mvp ?? {})!) : '없음'}</span>
                </li>
              ))}
            </ul>
            <div className="row">
              <button className="primary" onClick={() => void saveArchive()} disabled={busy}>
                오답 기록 저장하기
              </button>
              <Link className="ghost" to="/review">기록 보기</Link>
            </div>
            <p className="hint">
              저장하면 학생이 <code>/review</code> 에서 자기 오답을 볼 수 있습니다. 이름과 점수·답안만 저장됩니다.
            </p>
          </section>
        )}
      </div>

      <p className="foot">
        게임: {(() => { try { return getGame(session.meta.gameId).name } catch { return session.meta.gameId } })()}
        {' · '}코드 {session.meta.code}
      </p>
    </div>
  )
}
