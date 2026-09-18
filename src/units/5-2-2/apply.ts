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
import { distractors, gcd, improper, josa, josaAfter, mul, reduce, show, showMixed, value, type Frac } from './frac'
import { STANDARD } from './calc'

/* ── T7 중첩 비율 ───────────────────────────────────── */

/** 기준이 두 번 바뀌는 상황들. 익힘책에 실제로 나온 얼개만 쓴다 */
/**
 * 기준이 바뀌는 상황들. **b 에 "그중" 을 넣지 않는다** —
 * 문장 틀에 이미 들어 있어서 "그중 … 그중" 이 되어 뜻이 꼬인다.
 *   whole 전체 → a 그 일부 → b 그 안의 일부 → (삼중이면) ask 그 안의 일부
 */
const NESTED = [
  // 세 겹이 진짜 부분집합으로 좁혀져야 한다.
  // 예전 '야구를 좋아하는 학생 → 야구를 좋아하는 여학생' 은 같은 것을 두 번 부르는 꼴이었다
  { whole: '전교생', a: '여학생', b: '운동을 좋아하는 여학생', ask: '야구를 좋아하는 여학생' },
  { whole: '전체 헝겊', a: '바느질에 쓴 헝겊', b: '실제로 꿰맨 부분', ask: '무늬를 넣은 부분' },
  { whole: '학교 텃밭', a: '5학년 텃밭', b: '채소를 심은 곳', ask: '토마토를 심은 곳' },
  { whole: '색종이 묶음', a: '오늘 쓴 색종이', b: '노란색 색종이', ask: '접기에 쓴 노란색 색종이' },
  { whole: '도서관 책', a: '동화책', b: '그림이 있는 동화책', ask: '새로 들어온 책' },
] as const

/** 분모가 작은 진분수. 중첩하면 분모가 금세 커진다 (G7) */
function smallFrac(rng: Rng): Frac {
  const d = rng.pick([2, 3, 4, 5, 6, 7, 8] as const)
  return { n: rng.int(1, d - 1), d }
}

/**
 * 상 난이도용 진분수. **[1/2]·[1/3]·[1/4] 를 뽑지 않는다.**
 * 그 셋이 나오면 삼중이라도 `[1/2] × [1/2] × [1/3]` 이 되어 암산으로 끝난다.
 * 분모 3~9, 분자는 2 이상 — 약분할 것이 있어야 손을 움직인다.
 */
function hardFrac(rng: Rng): Frac | null {
  const d = rng.pick([3, 4, 5, 6, 7, 8, 9] as const)
  const n = rng.int(2, d - 1)
  // [2/4] 는 화면에 [1/2] 로 나간다. 기약이 아니면 버린다
  return gcd(n, d) === 1 ? { n, d } : null
}

function nested(rng: Rng, difficulty: Difficulty): Draft | null {
  const s = rng.pick(NESTED)
  /*
   * 삼중은 상 난이도에서만. 익힘책의 텃밭 문제가 이 얼개다.
   * **상이면 반드시 삼중이다.** 이중 중첩은 곱셈 두 번이라 중과 다를 게 없는데,
   * 예전에는 상에서도 절반쯤 이중이 나와서 "상 문제가 쉽다" 는 말이 나왔다.
   */
  const triple = difficulty === 3
  const a = triple ? hardFrac(rng) : smallFrac(rng)
  const b = triple ? hardFrac(rng) : smallFrac(rng)
  const c = triple ? hardFrac(rng) : null
  if (!a || !b || (triple && !c)) return null

  let ans = mul(a, b)
  if (c) ans = mul(ans, c)
  // G7 — 최종 분모가 24 를 넘으면 5학년 손계산을 벗어난다
  if (ans.d > 24 || ans.n <= 0) return null
  if (triple) {
    // 세 분수가 다 약분되어 [1/5] 처럼 떨어지면 결국 암산이다. 답의 분모가 커야 한다
    if (ans.d < 8) return null
    // 같은 분수가 두 번 나오면 "곱하면 제곱" 으로 지름길이 생긴다
    const keys = [a, b, c!].map((f) => `${reduce(f).n}/${reduce(f).d}`)
    if (new Set(keys).size < 3) return null
  }

  const step = c
    ? `${show(a)} × ${show(b)} × ${show(c)}`
    : `${show(a)} × ${show(b)}`

  const prompt = c
    ? `${s.whole}의 ${josaAfter(show(a), '이가')} ${s.a}입니다.\n` +
      `${s.a}의 ${josaAfter(show(b), '이가')} ${s.b}이고, 그중 ${josaAfter(show(c), '이가')} ${s.ask}입니다.\n` +
      `${josa(s.ask, '은는')} ${s.whole} 전체의 얼마인가요?`
    : `${s.whole}의 ${show(a)}이 ${s.a}입니다.\n` +
      `${s.a} 중에서 ${josaAfter(show(b), '이가')} ${s.b}입니다.\n` +
      `${josa(s.b, '은는')} ${s.whole} 전체의 얼마인가요?`

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
      `${josaAfter(show(b), '은는')} ${s.whole} 전체가 아니라 ${s.a}의 ${show(b)}이라는 점이 중요합니다.`,
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
/** batchim — 단위를 소리 내어 읽었을 때 받침이 있나. "15초야" vs "20분이야" */
const UNITS = [
  { one: '1시간', total: 60, unit: '분', batchim: true },
  { one: '하루', total: 24, unit: '시간', batchim: true },
  { one: '1 m', total: 100, unit: 'cm', batchim: false },   // 센티미터
  { one: '1 kg', total: 1000, unit: 'g', batchim: false },  // 그램
  { one: '1 L', total: 1000, unit: 'mL', batchim: false },  // 밀리리터
  { one: '1 km', total: 1000, unit: 'm', batchim: false },  // 미터
  { one: '1분', total: 60, unit: '초', batchim: false },
] as const

/**
 * 상 난이도용 분수. **분자 1 을 뽑지 않는다.**
 * `1 km의 [1/2]은 500 m` 는 분수 곱셈이 아니라 반 나누기다.
 * 분자가 2 이상이어야 "한 묶음이 얼마, 그게 몇 묶음" 을 실제로 계산한다.
 */
function hardUnitFrac(rng: Rng): { n: number; d: number } {
  const d = rng.pick([3, 4, 5, 6, 8, 10, 12] as const)
  return { n: rng.int(2, d - 1), d }
}

function unitConvert(rng: Rng, difficulty: Difficulty): Draft | null {
  const u = rng.pick(UNITS)
  const { n, d } = difficulty === 3
    ? hardUnitFrac(rng)
    : (() => { const dd = rng.pick([2, 3, 4, 5, 6, 8, 10, 12] as const); return { n: rng.int(1, dd - 1), d: dd } })()
  const exact = (u.total * n) / d
  // 딱 떨어지지 않으면 5학년 문제가 아니다
  if (!Number.isInteger(exact) || exact <= 0) return null

  // **상에서는 반드시 판별형으로 낸다.**
  // 값만 구하는 변주는 하 난이도와 다를 게 없는데 난이도 표만 상으로 붙어 나갔다.
  // (검수에서 "1 m의 1/2은 몇 cm" 가 상으로 나왔다)
  if (difficulty === 3) {
    // 약분되는 분수([4/6])는 [2/3] 으로 적어야 하는데 그러면 같은 문항이 두 벌 생긴다. 기약만 쓴다
    if (gcd(n, d) !== 1) return null
    // 상 — 셋 중 잘못 말한 친구 찾기. 익힘책의 그 문항 얼개다
    const others: { text: string; ok: boolean }[] = []
    const seen = new Set<string>([`${u.one}|${n}/${d}`])
    for (let i = 0; i < 30 && others.length < 2; i++) {
      const v = rng.pick(UNITS)
      const { n: nn, d: dd } = hardUnitFrac(rng)
      const e = (v.total * nn) / dd
      if (!Number.isInteger(e) || e <= 0 || gcd(nn, dd) !== 1) continue
      const key = `${v.one}|${nn}/${dd}`
      if (seen.has(key)) continue
      seen.add(key)
      others.push({ text: `${v.one}의 ${josaAfter(`[${nn}/${dd}]`, '은는')} ${e}${v.unit}${v.batchim ? '이야' : '야'}.`, ok: true })
    }
    if (others.length < 2) return null // 상인데 판별형을 못 만들면 아예 안 낸다

    /*
     * 틀린 사람 하나 — **아이들이 실제로 하는 실수**로 값을 만든다.
     * 예전에는 정답에 20%·50% 를 더하고 빼서 `72cm` 같은 아무 수가 나왔다.
     *   - 한 묶음(total ÷ d)만 구하고 분자를 곱하지 않음
     *   - 쓴 쪽이 아니라 남은 쪽(d − n 묶음)을 답함
     *   - 묶음 수를 하나 더/덜 셈
     */
    const one = u.total / d
    const slipPool = [one, one * (d - n), one * (n + 1), one * (n - 1)]
      // 전체와 같은 값([3/4] 이 60초)이나 정답의 반 이하·두 배 이상은 크기만 보고 걸러진다
      .filter((v) => Number.isInteger(v) && v > 0 && v !== exact && v !== u.total)
      .filter((v) => v > exact / 2 && v < exact * 2)
    if (slipPool.length === 0) return null
    const off = rng.pick(slipPool)
    const wrongLine = `${u.one}의 ${josaAfter(`[${n}/${d}]`, '은는')} ${off}${u.unit}${u.batchim ? '이야' : '야'}.`

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
    prompt: `${u.one}의 ${josaAfter(`[${n}/${d}]`, '은는')} 몇 ${u.unit}인가요?`,
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
  /*
   * 상에서는 정사각형을 빼고 삼각형에 무게를 둔다.
   * 정사각형 둘레는 `한 변 × 4` 한 번이라 하 난이도와 다를 게 없는데
   * 상 자리에 그게 나오고 있었다. 삼각형은 곱셈 두 번에 ÷2 가 더 붙는다.
   */
  const shape = difficulty === 3
    ? rng.pick(['triangle', 'triangle', 'rect', 'para'] as const)
    : rng.pick(['square', 'rect', 'para', 'triangle'] as const)
  const hard = difficulty === 3
  /*
   * 상에서는 **두 변이 다 대분수**고 분모에 2 가 없다.
   * `[1_1/2] × [1/2] ÷ 2` 는 상 자리에 있었지만 암산이었다.
   * 대분수 둘을 가분수로 바꿔 곱하면 두 자리 × 두 자리가 되고, 약분까지 해야 한다.
   */
  const mk = (): { text: string; f: Frac } => {
    if (hard || rng.bool(0.5)) {
      const m = hard
        ? { w: rng.int(1, 4), d: rng.pick([3, 4, 5, 6, 7, 8] as const), n: 0 }
        : { w: rng.int(1, 3), d: rng.pick([2, 3, 4, 5, 6] as const), n: 0 }
      m.n = hard ? rng.int(2, m.d - 1) : rng.int(1, m.d - 1)
      return { text: showMixed(m.w, m.n, m.d), f: improper(m.w, m.n, m.d) }
    }
    const d = rng.pick([2, 3, 4, 5, 6, 8] as const)
    const f = { n: rng.int(1, d - 1), d }
    return { text: show(f), f }
  }

  const a = mk()
  const b = mk()
  if (hard) {
    // [2_2/4] 는 화면에 [2_1/2] 로 나간다 — 분모 2 를 뺀 뜻이 없어진다. 기약일 때만
    if (gcd(a.f.n, a.f.d) !== 1 || gcd(b.f.n, b.f.d) !== 1) return null
    // 분모가 같으면([2_3/4] × [1_1/4]) 약분 없이 분자끼리만 곱하면 된다. 서로 달라야 한다
    if (a.f.d === b.f.d) return null
  }
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
