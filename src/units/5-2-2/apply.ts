/**
 * 활용 세 유형 — T7 중첩 비율, T8 단위 환산, T11 도형 공식.
 *
 * T7 이 **2단원 상 난이도의 절반**이다 (`docs/2단원_유형분석.md` 발견 3).
 * 1단원의 "어림 + 후처리 연산" 자리에 오는 것이 "전체의 A의 B" 다.
 * 아이들이 막히는 건 계산이 아니라 **기준이 바뀌는 것**이다 —
 * `3/5` 이 *무엇의* `3/5` 인지를 놓친다.
 */

import type { Rng } from '../../lib/rng'
import type { Difficulty, Draft, Template } from '../_types'
import { distractors, improper, mul, reduce, show, showMixed, value, type Frac } from './frac'
import { STANDARD } from './calc'

/* ── T7 중첩 비율 ───────────────────────────────────── */

/** 기준이 두 번 바뀌는 상황들. 익힘책에 실제로 나온 얼개만 쓴다 */
const NESTED = [
  { whole: '전교생', a: '여학생', b: '야구를 좋아하는 학생', unitA: '이고', ask: '야구를 좋아하는 여학생' },
  { whole: '전체 헝겊', a: '바느질에 쓴 헝겊', b: '그중 실제로 꿰맨 부분', unitA: '이고', ask: '꿰맨 부분' },
  { whole: '학교 텃밭', a: '5학년 텃밭', b: '채소를 심은 곳', unitA: '이고', ask: '채소를 심은 곳' },
  { whole: '색종이 묶음', a: '오늘 쓴 색종이', b: '그중 노란색', unitA: '이고', ask: '오늘 쓴 노란색 색종이' },
  { whole: '도서관 책', a: '동화책', b: '그중 그림이 있는 책', unitA: '이고', ask: '그림이 있는 동화책' },
] as const

/** 분모가 작은 진분수. 중첩하면 분모가 금세 커진다 (G7) */
function smallFrac(rng: Rng): Frac {
  const d = rng.pick([2, 3, 4, 5, 6, 7, 8] as const)
  return { n: rng.int(1, d - 1), d }
}

function nested(rng: Rng, difficulty: Difficulty): Draft | null {
  const s = rng.pick(NESTED)
  const a = smallFrac(rng)
  const b = smallFrac(rng)
  // 삼중은 상 난이도에서만. 익힘책의 텃밭 문제가 이 얼개다
  const triple = difficulty === 3 && rng.bool(0.45)
  const c = triple ? smallFrac(rng) : null

  let ans = mul(a, b)
  if (c) ans = mul(ans, c)
  // G7 — 최종 분모가 24 를 넘으면 5학년 손계산을 벗어난다
  if (ans.d > 24 || ans.n <= 0) return null

  const step = c
    ? `${show(a)} × ${show(b)} × ${show(c)}`
    : `${show(a)} × ${show(b)}`

  const prompt = c
    ? `${s.whole}의 ${show(a)}이 ${s.a}입니다.\n` +
      `${s.a}의 ${show(b)}이 ${s.b}이고, 그중 ${show(c)}이 ${s.ask}입니다.\n` +
      `${s.ask}은 ${s.whole} 전체의 얼마인가요?`
    : `${s.whole}의 ${show(a)}이 ${s.a}입니다.\n` +
      `${s.a} 중에서 ${show(b)}이 ${s.b}입니다.\n` +
      `${s.b}은 ${s.whole} 전체의 얼마인가요?`

  // 오답은 "기준을 놓친" 실수에서 뽑는다. 이게 이 유형의 핵심 오개념이다
  const slips = [
    { why: '더해 버림', wrong: reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }) },
    { why: '마지막 비율만 답함', wrong: c ?? b },
    { why: '첫 비율만 답함', wrong: a },
  ]
  const wrong = distractors(ans, slips, () => rng.next())
  const choices = rng.shuffle([show(ans), ...wrong.map(show)])

  return {
    templateId: 'T7',
    params: { kind: 'nested', depth: c ? '3' : '2', scenario: s.whole },
    difficulty,
    prompt,
    choices,
    answer: show(ans),
    explanation:
      `"전체의 얼마"를 묻고 있으므로 비율을 이어서 곱합니다.\n` +
      `${step} = ${show(ans)}\n` +
      `${show(b)}은 ${s.whole} 전체가 아니라 ${s.a}의 ${show(b)}이라는 점이 중요합니다.`,
    standard: STANDARD,
  }
}

export const T7: Template = {
  id: 'T7',
  name: '전체의 얼마인지 구하기',
  description:
    "'전체의 3분의 1 중에서 5분의 2' 처럼 기준이 두 번 바뀝니다. 이 단원에서 가장 어려운 유형입니다.",
  topic: '활용과 판단',
  supports: [2, 3],
  family: '활용',
  generate: (rng, d) => nested(rng, d),
}

/* ── T8 단위 환산 결합 ──────────────────────────────── */

/** G8 — 아이가 이미 아는 단위만. 새 지식을 요구하면 분수 문제가 아니게 된다 */
const UNITS = [
  { one: '1시간', total: 60, unit: '분' },
  { one: '하루', total: 24, unit: '시간' },
  { one: '1 m', total: 100, unit: 'cm' },
  { one: '1 kg', total: 1000, unit: 'g' },
  { one: '1 L', total: 1000, unit: 'mL' },
  { one: '1 km', total: 1000, unit: 'm' },
  { one: '1분', total: 60, unit: '초' },
] as const

function unitConvert(rng: Rng, difficulty: Difficulty): Draft | null {
  const u = rng.pick(UNITS)
  const d = rng.pick([2, 3, 4, 5, 6, 8, 10, 12] as const)
  const n = rng.int(1, d - 1)
  const exact = (u.total * n) / d
  // 딱 떨어지지 않으면 5학년 문제가 아니다
  if (!Number.isInteger(exact) || exact <= 0) return null

  if (difficulty === 3 && rng.bool(0.5)) {
    // 상 — 셋 중 잘못 말한 친구 찾기. 익힘책의 그 문항 얼개다
    const others: { text: string; ok: boolean }[] = []
    const seen = new Set<string>()
    for (let i = 0; i < 30 && others.length < 2; i++) {
      const v = rng.pick(UNITS)
      const dd = rng.pick([2, 3, 4, 5, 6, 8, 10] as const)
      const nn = rng.int(1, dd - 1)
      const e = (v.total * nn) / dd
      if (!Number.isInteger(e) || e <= 0) continue
      const key = `${v.one}|${nn}/${dd}`
      if (seen.has(key)) continue
      seen.add(key)
      others.push({ text: `${v.one}의 [${nn}/${dd}]은 ${e}${v.unit}이야.`, ok: true })
    }
    if (others.length < 2) return null

    // 틀린 사람 하나 — 값을 어긋나게 만든다
    const off = exact + rng.pick([-1, 1] as const) * Math.max(1, Math.round(exact * rng.pick([0.2, 0.5] as const)))
    if (off === exact || off <= 0) return null
    const wrongLine = `${u.one}의 [${n}/${d}]은 ${off}${u.unit}이야.`

    const names = rng.shuffle(['소민', '성진', '은별', '재희', '다정'] as const).slice(0, 3)
    const lines = rng.shuffle([wrongLine, others[0]!.text, others[1]!.text])
    const wrongIdx = lines.indexOf(wrongLine)

    return {
      templateId: 'T8',
      params: { kind: 'unit-judge', unit: u.unit },
      difficulty: 3,
      prompt:
        '잘못 말한 친구는 누구인가요?\n' +
        lines.map((l, i) => `${names[i]}: ${l}`).join('\n'),
      choices: [...names],
      answer: names[wrongIdx]!,
      explanation:
        `${u.one}은 ${u.total}${u.unit}입니다.\n` +
        `${u.total} × [${n}/${d}] = ${exact}${u.unit} 이므로 ${off}${u.unit}은 틀렸습니다.`,
      standard: STANDARD,
    }
  }

  // 중 — 값을 직접 구하기. 답이 자연수라 단답형으로 낼 수 있다
  return {
    templateId: 'T8',
    params: { kind: 'unit-value', unit: u.unit },
    difficulty,
    prompt: `${u.one}의 [${n}/${d}]은 몇 ${u.unit}인가요?`,
    answer: String(exact),
    explanation:
      `${u.one}은 ${u.total}${u.unit}입니다.\n` +
      `${u.total} × [${n}/${d}] = ${exact}${u.unit}`,
    standard: STANDARD,
  }
}

export const T8: Template = {
  id: 'T8',
  name: '단위와 함께 구하기',
  description: "'1 m의 5분의 3은 몇 cm인가' 처럼 분수 곱셈에 단위 바꾸기가 붙습니다.",
  topic: '활용과 판단',
  supports: [2, 3],
  family: '활용',
  generate: (rng, d) => unitConvert(rng, d),
}

/* ── T11 도형 공식 안에서 ───────────────────────────── */

function figure(rng: Rng, difficulty: Difficulty): Draft | null {
  const shape = rng.pick(['square', 'rect', 'para', 'triangle'] as const)
  const mk = (): { text: string; f: Frac } => {
    if (rng.bool(0.5)) {
      const m = { w: rng.int(1, 3), d: rng.pick([2, 3, 4, 5, 6] as const), n: 0 }
      m.n = rng.int(1, m.d - 1)
      return { text: showMixed(m.w, m.n, m.d), f: improper(m.w, m.n, m.d) }
    }
    const d = rng.pick([2, 3, 4, 5, 6, 8] as const)
    const f = { n: rng.int(1, d - 1), d }
    return { text: show(f), f }
  }

  const a = mk()
  const b = mk()
  let ans: Frac
  let prompt: string
  let how: string

  if (shape === 'square') {
    ans = mul(a.f, { n: 4, d: 1 })
    prompt = `한 변의 길이가 ${a.text} m인 정사각형 액자가 있습니다.\n이 액자의 둘레는 몇 m인가요?`
    how = `정사각형의 둘레 = 한 변 × 4\n${a.text} × 4 = ${show(ans)}`
  } else if (shape === 'rect') {
    ans = mul(a.f, b.f)
    prompt = `가로가 ${a.text} m, 세로가 ${b.text} m인 직사각형이 있습니다.\n넓이는 몇 m²인가요?`
    how = `직사각형의 넓이 = 가로 × 세로\n${a.text} × ${b.text} = ${show(ans)}`
  } else if (shape === 'para') {
    ans = mul(a.f, b.f)
    prompt = `밑변이 ${a.text} m, 높이가 ${b.text} m인 평행사변형이 있습니다.\n넓이는 몇 m²인가요?`
    how = `평행사변형의 넓이 = 밑변 × 높이\n${a.text} × ${b.text} = ${show(ans)}`
  } else {
    ans = mul(mul(a.f, b.f), { n: 1, d: 2 })
    prompt = `밑변이 ${a.text} m, 높이가 ${b.text} m인 삼각형이 있습니다.\n넓이는 몇 m²인가요?`
    how = `삼각형의 넓이 = 밑변 × 높이 ÷ 2\n${a.text} × ${b.text} ÷ 2 = ${show(ans)}`
  }

  // G3 — 답이 너무 커지거나 분모가 크면 버린다
  if (ans.d > 24 || value(ans) > 40 || ans.n <= 0) return null

  const slips = [
    { why: '넓이인데 둘레를 구함', wrong: reduce({ n: (a.f.n * b.f.d + b.f.n * a.f.d) * 2, d: a.f.d * b.f.d }) },
    { why: '더해 버림', wrong: reduce({ n: a.f.n * b.f.d + b.f.n * a.f.d, d: a.f.d * b.f.d }) },
    ...(shape === 'triangle' ? [{ why: '2로 나누는 것을 잊음', wrong: mul(a.f, b.f) }] : []),
  ]
  const wrong = distractors(ans, slips, () => rng.next())
  const choices = rng.shuffle([show(ans), ...wrong.map(show)])

  return {
    templateId: 'T11',
    params: { kind: 'figure', shape },
    difficulty,
    prompt,
    choices,
    answer: show(ans),
    explanation: how,
    standard: STANDARD,
  }
}

export const T11: Template = {
  id: 'T11',
  name: '도형의 둘레·넓이 구하기',
  description: '분수로 된 길이를 넣어 정사각형 둘레, 직사각형·평행사변형·삼각형 넓이를 구합니다.',
  topic: '활용과 판단',
  supports: [2, 3],
  family: '활용',
  generate: (rng, d) => figure(rng, d),
}
