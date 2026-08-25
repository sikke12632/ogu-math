/**
 * 게임 설명 화면 (`#/rules`). **전자칠판에 띄우고 선생님이 넘긴다.**
 *
 * 아이들이 규칙을 잘 이해하지 못해서 만들었다. 두 가지를 지킨다.
 *
 *   1. **진짜 게임 화면을 그대로 띄운다.** 캡처 그림을 쓰면 나중에 화면을 고칠 때
 *      설명만 옛날 것으로 남는다. 실제 대전 컴포넌트에 정해진 판을 먹여
 *      세워 두면(`frozen`), 게임이 바뀌어도 설명이 저절로 따라온다.
 *   2. **한 판의 이야기로 이어 간다.** 규칙을 따로따로 늘어놓으면 안 외워진다.
 *      `demo3` 한 판이 처음부터 끝까지 흘러가고, 마지막에 길이 두 갈래로 갈린다.
 *
 * Firebase 를 쓰지 않는다. 학교에서 뭐가 막혀도 이 화면은 열린다.
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { chipColor, DrawDuel } from '../../games/draw-duel/DrawDuel'
import { BLANKS, MAX_NUMBER, TURN_LIMIT_SEC, type TurnLog } from '../../games/draw-duel/engine'
import type { MatchRecord, StudentId } from '../../session/types'

/* ── 설명에 쓸 판 ───────────────────────────────────── */

const ME: StudentId = 'a'
const OPP: StudentId = 'b'
const NAMES: Record<StudentId, string> = { a: '나', b: '🐻 곰' }

/**
 * 이 판 하나로 설명이 다 된다. 숫자는 `demo3` 에서 실제로 나오는 값이다.
 *   1턴  나 9 · 곰 7
 *   3턴  나 21 · 곰 20   (꽝 확률 33%)
 *   둘 다 그만하면  히든 12·10 이 열려 33 대 30
 *   계속 뽑으면     곰이 꽝
 */
const MATCH_ID = 'demo3'

const draws = (n: number): TurnLog => {
  const t: TurnLog = {}
  for (let i = 1; i <= n; i++) t[String(i)] = { [ME]: 'draw', [OPP]: 'draw' }
  return t
}

const match = (turns: TurnLog, done?: Partial<MatchRecord>): MatchRecord => ({
  id: MATCH_ID,
  round: 1,
  players: [ME, OPP],
  turns,
  ...done,
})

const START = match({})
const AFTER_1 = match(draws(1))
const AFTER_3 = match(draws(3))
const BOTH_STOP = match({ ...draws(3), '4': { [ME]: 'stop', [OPP]: 'stop' } }, { winner: ME })
const HIT_BLANK = match(draws(4), { winner: ME })

/** 세워 둔 진짜 대전 화면 */
function Screen({ m }: { m: MatchRecord }) {
  return (
    <div className="rules-screen">
      <DrawDuel
        frozen
        match={m}
        me={ME}
        nameOf={(id) => NAMES[id] ?? '친구'}
        opponentConnected
        roundLabel="1 / 3판"
        onChoose={() => {}}
        onResult={() => {}}
        onForfeit={() => {}}
      />
    </div>
  )
}

/* ── 통 안에 든 것 그림 ─────────────────────────────── */

function Chip({ v, big }: { v: number | 'X'; big?: boolean }) {
  return (
    <span
      className={`rules-chip${big ? ' big' : ''}`}
      style={{ background: chipColor(v), color: v === 'X' ? '#fff' : '#10161f' }}
    >
      {v === 'X' ? '꽝' : v}
    </span>
  )
}

function Pool() {
  return (
    <div className="rules-pool">
      <div className="rules-chiprow">
        {Array.from({ length: MAX_NUMBER }, (_, i) => (
          <Chip key={i} v={i + 1} big />
        ))}
      </div>
      <div className="rules-chiprow">
        {Array.from({ length: BLANKS }, (_, i) => (
          <Chip key={i} v="X" big />
        ))}
      </div>
    </div>
  )
}

/* ── 슬라이드 ───────────────────────────────────────── */

type Slide = {
  /** 큰 제목 — 이 한 줄만 읽어도 뜻이 통해야 한다 */
  title: string
  /** 아래 한 줄 설명. 없어도 된다 */
  sub?: string
  body: ReactNode
}

const SLIDES: Slide[] = [
  {
    title: '번호 뽑기 대전',
    sub: '통에서 번호 공을 뽑아 합이 큰 사람이 이긴다. 단, 꽝을 뽑으면 그 자리에서 진다.',
    body: (
      <div className="rules-cover">
        <Pool />
        <p className="rules-note">
          통에는 <b>1부터 12까지 한 장씩</b>, 그리고 <b>꽝 두 장</b>이 들어 있어요.
        </p>
      </div>
    ),
  },
  {
    title: '화면은 이렇게 생겼어',
    sub: '왼쪽이 통, 오른쪽이 점수와 버튼이에요.',
    body: (
      <div className="rules-split">
        <Screen m={START} />
        <ul className="rules-points">
          <li><b>왼쪽 통</b> — 여기서 공이 나와요</li>
          <li><b>오른쪽 위</b> — 상대 점수</li>
          <li><b>오른쪽 아래</b> — 내 점수</li>
          {/* 버튼에 실제로 적힌 말을 그대로 알려 준다. 아이들이 화면에서 찾아야 한다 */}
          <li><b>뽑기 / 스탑</b> — 둘 중 하나를 골라요. <b>스탑</b>이 "여기서 그만" 이에요</li>
        </ul>
      </div>
    ),
  },
  {
    title: '첫 판에는 꽝이 없어',
    sub: '마음 놓고 뽑아도 돼요. 꽝 두 장은 첫 판이 끝난 뒤에 통에 들어가요.',
    body: (
      <div className="rules-split">
        <Screen m={AFTER_1} />
        <ul className="rules-points">
          <li>나는 <b>9</b>, 곰이는 <b>7</b> 을 뽑았어요</li>
          <li>이제 통에 <b>꽝 두 장</b>이 들어갔어요</li>
          <li>지금 뽑으면 꽝이 나올 확률은 <b>10장 중 2장</b></li>
        </ul>
      </div>
    ),
  },
  {
    title: '뽑을수록 점수는 오르고, 위험도 올라',
    sub: '공이 줄어들수록 남은 꽝이 나올 확률이 커져요.',
    body: (
      <div className="rules-split">
        <Screen m={AFTER_3} />
        <ul className="rules-points">
          <li>세 번 뽑아서 <b>나 21점 · 곰 20점</b></li>
          <li>통에 <b>6장</b> 남았는데 그중 <b>꽝이 2장</b></li>
          <li>이제 뽑으면 <b>셋 중 하나</b>는 꽝이에요</li>
          <li className="warn">여기서 고민해야 해요. <b>더 뽑을까, 스탑할까?</b></li>
        </ul>
      </div>
    ),
  },
  {
    title: '갈림길 ① — 스탑',
    sub: '둘 다 스탑하면 숨은 카드를 열고 합을 견줘요.',
    body: (
      <div className="rules-split">
        <Screen m={BOTH_STOP} />
        <ul className="rules-points">
          <li>나 21 + 숨은 카드 <b>12</b> = <b>33</b></li>
          <li>곰 20 + 숨은 카드 <b>10</b> = <b>30</b></li>
          <li><b>33 대 30 으로 내가 이겼어요</b></li>
          <li className="warn"><b>한 번 스탑하면 그 판에는 다시 못 뽑아요.</b></li>
        </ul>
      </div>
    ),
  },
  {
    title: '갈림길 ② — 계속 뽑기',
    sub: '욕심을 내다가 꽝을 뽑으면 점수가 아무리 높아도 그 자리에서 져요.',
    body: (
      <div className="rules-split">
        <Screen m={HIT_BLANK} />
        <ul className="rules-points">
          <li>곰이가 한 번 더 뽑았는데 <b>꽝</b>이 나왔어요</li>
          <li>곰이는 20점이었지만 <b>그대로 패배</b></li>
          <li className="warn">둘이 <b>같은 판에 동시에</b> 꽝을 뽑으면 <b>비겨요</b></li>
        </ul>
      </div>
    ),
  },
  {
    title: '숨은 카드 한 장',
    sub: '처음부터 나한테만 보이는 카드가 한 장 있어요.',
    body: (
      <div className="rules-cards">
        <div className="rules-card">
          <b>나만 볼 수 있어요</b>
          <p>상대 것은 판이 끝나야 열려요. 그래서 <b>이기고 있는지 끝까지 알 수 없어요.</b></p>
        </div>
        <div className="rules-card">
          <b>숨은 카드에는 꽝이 없어요</b>
          <p>1부터 12 중 한 장이에요. 안심해도 돼요.</p>
        </div>
        <div className="rules-card">
          <b>그래서 재미있어요</b>
          <p>내 숨은 카드가 크면 조금 일찍 그만해도 이길 수 있어요.</p>
        </div>
      </div>
    ),
  },
  {
    title: `${TURN_LIMIT_SEC}초 안에 고르기`,
    sub: '시간이 다 되면 저절로 "스탑" 이 돼요.',
    body: (
      <div className="rules-cards">
        <div className="rules-card">
          <b>저절로 뽑히지는 않아요</b>
          <p>가만히 있었다고 꽝을 뽑고 지는 일은 없어요. 안전한 쪽으로 넘어가요.</p>
        </div>
        <div className="rules-card">
          <b>빨리 고르면 바로 넘어가요</b>
          <p>{TURN_LIMIT_SEC}초를 다 기다릴 필요 없어요. 둘 다 고르면 곧장 다음 판이에요.</p>
        </div>
      </div>
    ),
  },
  {
    title: '상대가 없는 사람은 응원단장',
    sub: '인원이 홀수면 매 판 한 명이 남아요. 쉬는 게 아니라 할 일이 따로 있어요.',
    body: (
      <div className="rules-cards">
        <div className="rules-card">
          <b>팀원 한 명에게 걸어요</b>
          <p>고른 친구가 이기면 그 판이 <b>우리 팀 2점</b>이 돼요.</p>
        </div>
        <div className="rules-card">
          <b>져도 잃는 건 없어요</b>
          <p>그러니 마음 편하게 걸어도 돼요.</p>
        </div>
        <div className="rules-card warn">
          <b>한 번 고르면 못 바꿔요</b>
          <p>그리고 <b>승부가 끝난 친구에게는 걸 수 없어요.</b></p>
        </div>
      </div>
    ),
  },
  {
    title: '정리하면',
    body: (
      <ol className="rules-summary">
        <li>통에 <b>1~12 한 장씩 + 꽝 두 장</b></li>
        <li><b>첫 판에는 꽝이 없어요.</b> 그 뒤부터 들어가요</li>
        <li><b>뽑기</b> 또는 <b>스탑</b>. 스탑하면 다시 못 뽑아요</li>
        <li><b>꽝을 뽑으면 그 자리에서 져요</b></li>
        <li>둘 다 스탑하면 <b>숨은 카드를 열고 합이 큰 쪽이 이겨요</b></li>
        <li><b>{TURN_LIMIT_SEC}초</b> 안에 안 고르면 저절로 스탑</li>
      </ol>
    ),
  },
]

/* ── 화면 ───────────────────────────────────────────── */

export function Rules() {
  const [i, setI] = useState(0)
  const last = SLIDES.length - 1
  const go = useCallback((d: number) => setI((v) => Math.min(last, Math.max(0, v + d))), [last])

  // 전자칠판에서는 화살표 키나 스페이스로 넘기는 게 제일 편하다
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault()
        go(1)
      }
      if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault()
        go(-1)
      }
      if (e.key === 'Home') setI(0)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [go])

  const s = SLIDES[i]!

  return (
    <div className="rules">
      <header className="rules-head">
        <h1>{s.title}</h1>
        {s.sub && <p className="rules-sub">{s.sub}</p>}
      </header>

      <main className="rules-body">{s.body}</main>

      <footer className="rules-foot">
        <button className="rules-nav" onClick={() => go(-1)} disabled={i === 0}>
          ← 앞으로
        </button>
        <span className="rules-dots">
          {SLIDES.map((_, n) => (
            <i key={n} className={n === i ? 'on' : ''} />
          ))}
        </span>
        <span className="rules-count">{i + 1} / {SLIDES.length}</span>
        <button className="rules-nav primary" onClick={() => go(1)} disabled={i === last}>
          다음 →
        </button>
        <Link className="rules-exit" to="/">나가기</Link>
      </footer>
    </div>
  )
}
