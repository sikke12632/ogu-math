/**
 * 번호 뽑기 대전 — 학생 화면.
 *
 * 화면에 보이는 것 (설계보고서 3.5)
 *   내 점수 / 상대 점수 + `?`  — 상대 히든이 불확실하다는 표시
 *   내가 뽑은 공 이력
 *   남은 공 수, 꽝 수, 위험도 게이지
 *
 * **"아직 안 나온 숫자" 목록은 그리지 않는다.** 카운팅을 대신 해주면
 * 세는 것이 실력이 되지 못한다.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MatchRecord, StudentId } from '../../session/types'
import {
  blanksLeft, computeState, opponentOf, riskOf, TURN_LIMIT_SEC,
  type Card, type GameState,
} from './engine'
import { DuelStage, type SlotKey } from './stage'

type Props = {
  match: MatchRecord
  me: StudentId
  nameOf: (id: StudentId) => string
  /** 상대가 접속해 있는지 */
  opponentConnected: boolean
  onChoose: (turn: number, choice: 'draw' | 'stop') => void
  onResult: (winner: StudentId | 'draw') => void
  onForfeit: (loser: StudentId, winner: StudentId) => void
  /** 응원단장이 보낸 응원 */
  cheerAt?: number
  roundLabel: string
}

const HUE = [0, 6, 28, 44, 58, 96, 148, 172, 194, 214, 244, 276, 320]
const chipColor = (v: Card): string =>
  v === 'X' ? '#e0503f' : `hsl(${HUE[v as number] ?? 200} 78% 50%)`

export function DrawDuel(props: Props) {
  const { match, me, nameOf, opponentConnected, onChoose, onResult, onForfeit } = props
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<DuelStage | null>(null)
  const playedRef = useRef(0)
  const reportedRef = useRef(false)
  const [deadline, setDeadline] = useState<{ key: string; at: number } | null>(null)
  const [now, setNow] = useState(Date.now())
  const [cheer, setCheer] = useState(false)

  const opp = useMemo(() => opponentOf({ players: match.players } as GameState, me), [match.players, me])
  const state = useMemo(
    () =>
      computeState(
        match.id,
        match.players,
        match.turns,
        match.forfeit
          ? { loser: match.forfeit, winner: match.players.find((p) => p !== match.forfeit)! }
          : undefined,
      ),
    [match.id, match.players, match.turns, match.forfeit],
  )

  const mine = state.sides[me]!
  const theirs = state.sides[opp]!
  const myTurn = !state.over && state.waitingFor.includes(me)

  /* ── 무대 ─────────────────────────────────────── */

  useEffect(() => {
    if (!canvasRef.current) return
    const stage = new DuelStage(canvasRef.current)
    stageRef.current = stage
    stage.start()
    const onResize = (): void => stage.fit()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      stage.stop()
      stageRef.current = null
    }
  }, [])

  // 판이 바뀌면 통을 새로 채우고 히든을 나눠 준다
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const fresh = computeState(match.id, match.players, undefined)
    stage.fill(fresh.pool as Card[])
    stage.shake(48)
    playedRef.current = 0
    reportedRef.current = false
    const t1 = setTimeout(() => stage.fly(fresh.sides[me]!.hidden, 'meHidden'), 700)
    const t2 = setTimeout(() => stage.fly('?', 'oppHidden'), 1000)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [match.id])

  // 새로 확정된 턴만큼 공을 꺼내 보여 준다
  useEffect(() => {
    const stage = stageRef.current
    if (!stage) return
    const timers: ReturnType<typeof setTimeout>[] = []
    while (playedRef.current < state.steps.length) {
      const step = state.steps[playedRef.current]!
      playedRef.current++
      const slotOf = (p: StudentId): SlotKey => (p === me ? 'meDraw' : 'oppDraw')
      stage.clearSlots('meDraw', 'oppDraw')
      stage.shake(40)
      for (const p of match.players) {
        const c = step.drew[p]
        if (c == null) {
          timers.push(setTimeout(() => stage.fold(slotOf(p)), 600))
        } else {
          timers.push(setTimeout(() => stage.drawOut(c, slotOf(p)), 800))
        }
      }
      if (step.blanksAdded) timers.push(setTimeout(() => stage.add(['X', 'X']), 1500))
    }
    if (state.revealed) timers.push(setTimeout(() => stage.revealSlot('oppHidden', theirs.hidden), 400))
    return () => timers.forEach(clearTimeout)
  }, [state.steps.length, state.revealed, match.players, me, theirs.hidden])

  /* ── 턴 제한시간 — 상한이지 고정이 아니다 ───────────
     마감 시각은 **이 판의 이 턴**에 묶어 둔다. 판이 바뀔 때
     앞 판의 마감 시각이 남아 있으면 새 판이 시작하자마자 자동 스탑이 된다. */

  const turnKey = `${match.id}:${state.turn}`

  useEffect(() => {
    if (!myTurn) {
      setDeadline(null)
      return
    }
    setDeadline({ key: turnKey, at: Date.now() + TURN_LIMIT_SEC * 1000 })
  }, [myTurn, turnKey])

  useEffect(() => {
    if (deadline === null) return
    const t = setInterval(() => setNow(Date.now()), 100)
    return () => clearInterval(t)
  }, [deadline])

  const choose = useCallback(
    (c: 'draw' | 'stop') => {
      if (!myTurn || state.over) return
      setDeadline(null)
      onChoose(state.turn, c)
    },
    [myTurn, state.over, onChoose, state.turn],
  )

  // 시간이 다 되면 **자동 스탑**이다. 자동 뽑기가 아니다 —
  // 멍하니 있던 학생이 꽝을 뽑고 즉사하면 안 된다.
  // 시각은 now 가 아니라 Date.now() 로 본다. 배경 탭에서는 now 가 늦게 갱신된다
  useEffect(() => {
    if (deadline === null || !myTurn) return
    if (deadline.key !== turnKey) return
    if (Date.now() < deadline.at) return
    choose('stop')
  }, [now, deadline, turnKey, myTurn, choose])

  /* ── 상대 연결 끊김 — 10초 뒤 그 판 패배 ──────────── */

  const disconnectSince = useRef<number | null>(null)
  useEffect(() => {
    if (state.over) return
    if (opponentConnected) {
      disconnectSince.current = null
      return
    }
    if (disconnectSince.current === null) disconnectSince.current = Date.now()
    const t = setInterval(() => {
      if (disconnectSince.current && Date.now() - disconnectSince.current > 10_000) {
        clearInterval(t)
        onForfeit(opp, me)
      }
    }, 1000)
    return () => clearInterval(t)
  }, [opponentConnected, state.over, opp, me, onForfeit])

  /* ── 결과 보고 — 두 사람 중 앞선 id 만 쓴다 ───────── */

  useEffect(() => {
    if (!state.over || state.winner === null || reportedRef.current) return
    if (match.winner) return
    if (match.players[0] !== me) return
    reportedRef.current = true
    onResult(state.winner)
  }, [state.over, state.winner, match.winner, match.players, me, onResult])

  /* ── 응원 ─────────────────────────────────────── */

  useEffect(() => {
    if (!props.cheerAt) return
    setCheer(true)
    const t = setTimeout(() => setCheer(false), 1800)
    return () => clearTimeout(t)
  }, [props.cheerAt])

  /* ── 그리기 ───────────────────────────────────── */

  const risk = riskOf(state)
  const left = deadline && deadline.key === turnKey ? Math.max(0, deadline.at - now) : 0
  const timePct = deadline ? (left / (TURN_LIMIT_SEC * 1000)) * 100 : 0
  // 지금 뭘 해야 하는지 한 줄로. 5학년이 화면만 보고 알 수 있어야 한다
  const message = state.over
    ? state.winner === 'draw'
      ? `비겼다 — ${state.reason}`
      : state.winner === me
        ? `이겼다! ${state.reason}`
        : `졌다 — ${state.reason}`
    : state.turn === 1
      ? '첫 판에는 꽝이 없어. 마음 놓고 뽑아!'
      : myTurn
        ? '뽑을까, 그만할까?'
        : mine.stopped
          ? '그만했어. 상대가 끝낼 때까지 기다리자'
          : '상대가 고르는 중…'

  const outcome = state.over
    ? state.winner === 'draw' ? 'tie' : state.winner === me ? 'win' : 'lose'
    : null

  return (
    <div className={`duel${cheer ? ' cheered' : ''}`}>
      {/* 왼쪽은 통, 오른쪽은 점수와 버튼.
          크롬북은 가로가 넓고 세로가 짧다. 위아래로 쌓으면 글씨를 키울 수가 없다 */}
      <div className="duel-grid">
        <div className="duel-stage">
          <canvas ref={canvasRef} />
          {cheer && <div className="cheer-pop">응원이 왔어! 힘내!</div>}
        </div>

        <div className="duel-side">
          <p className="duel-round">
            {props.roundLabel}
            {!opponentConnected && !state.over && <span className="duel-warn">상대 연결 확인 중</span>}
          </p>

          <Score
            label={nameOf(opp)}
            sum={theirs.sum}
            hidden={state.revealed ? theirs.hidden : null}
            cards={theirs.cards}
            stopped={theirs.stopped}
            dead={theirs.dead}
          />

          <p className="duel-vs">vs</p>

          <Score
            me
            label="나"
            sum={mine.sum}
            hidden={mine.hidden}
            cards={mine.cards}
            stopped={mine.stopped}
            dead={mine.dead}
          />

          <div className="duel-risk">
            <div className="duel-risk-top">
              <span>
                남은 공 <b>{state.pool.length}</b>개 · 꽝 <b className="bad">{blanksLeft(state)}</b>개
              </span>
              <span className={`duel-pct${risk >= 0.4 ? ' hot' : ''}`}>{Math.round(risk * 100)}%</span>
            </div>
            <div className="duel-gauge" aria-hidden>
              {Array.from({ length: state.pool.length }, (_, i) => (
                <span key={i} className={i < state.pool.length - blanksLeft(state) ? 'g ok' : 'g bad'} />
              ))}
            </div>
          </div>
        </div>
      </div>

      <p className={`duel-msg${outcome ? ' ' + outcome : ''}`}>{message}</p>

      {!state.over && (
        <div className="duel-timer">
          <div
            className={`duel-timer-fill${timePct < 25 ? ' hot' : timePct < 50 ? ' warm' : ''}`}
            style={{ width: `${timePct}%` }}
          />
        </div>
      )}

      <div className="duel-ctrl">
        <button className="pick" onClick={() => choose('draw')} disabled={!myTurn}>
          뽑기
          <em>{myTurn ? `꽝 ${Math.round(risk * 100)}%` : '기다리는 중'}</em>
        </button>
        <button className="hold" onClick={() => choose('stop')} disabled={!myTurn}>
          스탑
          <em>여기서 그만</em>
        </button>
      </div>
    </div>
  )
}

/** 한 사람의 점수 한 덩어리. 이름·점수·뽑은 공을 크게 */
function Score(p: {
  label: string
  sum: number
  hidden: number | null
  cards: Card[]
  stopped: boolean
  dead: boolean
  me?: boolean
}) {
  return (
    <div className={`duel-score${p.me ? ' me' : ''}`}>
      <div className="duel-score-head">
        <span className="duel-name">{p.label}</span>
        {p.dead && <span className="duel-flag dead">꽝! 졌어</span>}
        {!p.dead && p.stopped && <span className="duel-flag stop">스탑</span>}
      </div>
      <div className="duel-num">
        <b>{p.hidden === null ? p.sum : p.sum + p.hidden}</b>
        <span className="duel-num-note">
          {p.hidden === null ? (
            <>보이는 점수 · 숨은 공 <i>?</i></>
          ) : (
            <>보이는 점수 {p.sum} · 숨은 공 {p.hidden}</>
          )}
        </span>
      </div>
      <div className="duel-chips">
        <span className={`chip hid${p.hidden === null ? ' unknown' : ''}`}>
          {p.hidden === null ? '?' : p.hidden}
        </span>
        {p.cards.map((c, i) => (
          <span
            key={i}
            className={`chip${c === 'X' ? ' x' : ''}`}
            style={c === 'X' ? undefined : { background: chipColor(c) }}
          >
            {c === 'X' ? '꽝' : c}
          </span>
        ))}
      </div>
    </div>
  )
}

