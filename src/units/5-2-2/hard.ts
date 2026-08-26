/**
 * 진짜 심화 — T12~T15.
 *
 * ── 왜 따로 만들었나 ────────────────────────────────
 * 처음에는 수학익힘책만 보고 상 난이도를 잡았다. 그런데 검수에서
 * **"상 문제들이 다 쉽다"** 는 지적을 받았고, 맞는 말이었다.
 *
 * **수학익힘책은 기본 교재다.** 거기 있는 '추론' 문항은 심화의 가장 아래층이고,
 * 익힘책 안에서 아무리 골라 봐야 그 위로 못 올라간다.
 *
 * 그래서 여기 넷은 익힘책에 **없는** 얼개로 만든다.
 * 공통점은 곱셈을 한 번 더 하는 게 아니라 **다른 생각이 한 번 더 필요하다**는 것이다.
 *
 *   T12  거꾸로 구하기      곱셈을 거꾸로 되짚어야 한다
 *   T13  남은 것 구하기      뺄셈이 섞이고 기준이 두 번 바뀐다
 *   T14  자연수 만들기       약수·배수를 끌어와야 한다
 *   T15  계산 없이 판단      1보다 큰지 작은지로 판단한다
 */

import type { Rng } from '../../lib/rng'
import type { Draft, Template } from '../_types'
import { distractors, gcd, improper, josa, josaAfter, mul, reduce, show, showMixed, value, type Frac } from './frac'
import { STANDARD } from './calc'

/* ── T12 거꾸로 구하기 ──────────────────────────────── */

/**
 * `□ × [3/4] = [1_1/5]` 에서 □ 를 찾는다.
 *
 * 5학년은 분수 나눗셈을 아직 안 배웠다(6학년). 그래서 **나눗셈으로 풀 수 없고**,
 * 곱해서 그 값이 되는 수를 찾아야 한다. 그게 이 문항이 어려운 이유다.
 * 보기를 주고 고르게 한다 — 넷을 다 곱해 봐야 답이 나온다.
 */
function inverse(rng: Rng): Draft | null {
  const d = rng.pick([2, 3, 4, 5, 6, 8] as const)
  const mult: Frac = { n: rng.int(1, d - 1), d }
  // 답이 될 수 (구하는 수). 깔끔한 값이어야 한다
  const ansD = rng.pick([2, 3, 4, 5, 6] as const)
  const ans: Frac = rng.bool(0.4)
    ? { n: rng.int(2, 8), d: 1 }
    : { n: rng.int(1, ansD * 3), d: ansD }
  const result = mul(ans, mult)
  if (result.d > 24 || result.n <= 0 || value(result) > 30) return null
  // 곱한 값이 원래 수와 같으면 문제가 안 된다
  if (value(result) === value(ans)) return null
  // 답이 1이면 "곱해도 그대로니까 1" 로 바로 보인다. 심화가 아니다
  if (value(ans) === 1) return null

  const slips = [
    // 한 번 더 곱해 버리는 실수 — 나눗셈이 필요한 걸 모르면 이렇게 한다
    { why: '거꾸로 가지 않고 한 번 더 곱함', wrong: mul(result, mult) },
    { why: '곱한 수를 그대로 답함', wrong: mult },
    { why: '결과를 그대로 답함', wrong: result },
  ]
  const wrong = distractors(ans, slips, () => rng.next())
  if (wrong.length < 3) return null
  const choices = rng.shuffle([show(ans), ...wrong.map(show)])

  return {
    templateId: 'T12',
    params: { kind: 'inverse' },
    difficulty: 3,
    prompt:
      `어떤 수에 ${josaAfter(show(mult), '을를')} 곱했더니 ${josaAfter(show(result), '이가')} 되었습니다.\n` +
      `어떤 수는 얼마인가요?`,
    choices,
    answer: show(ans),
    explanation:
      `보기의 수에 ${show(mult)}을 각각 곱해 봅니다.\n` +
      `${show(ans)} × ${show(mult)} = ${show(result)} 이므로 답은 ${show(ans)}입니다.`,
    standard: STANDARD,
  }
}

export const T12: Template = {
  id: 'T12',
  name: '거꾸로 구하기',
  description:
    "'어떤 수에 4분의 3을 곱했더니 …이 되었다. 어떤 수는?' 곱셈을 거꾸로 되짚어야 합니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => inverse(rng),
}

/* ── T13 남은 것 구하기 ─────────────────────────────── */

const LEFTOVER = [
  { thing: '물', unit: 'L', verb: '마셨습니다', second: '화분에 주었습니다' },
  { thing: '색 테이프', unit: 'm', verb: '선물 포장에 썼습니다', second: '만들기에 썼습니다' },
  { thing: '밀가루', unit: 'kg', verb: '빵을 만드는 데 썼습니다', second: '과자를 만드는 데 썼습니다' },
  { thing: '주스', unit: 'L', verb: '마셨습니다', second: '동생에게 주었습니다' },
] as const

/**
 * "그중 A를 쓰고, **남은 것의** B를 또 썼다. 남은 것은?"
 *
 * 어려운 이유는 계산이 아니라 **기준이 두 번 바뀌고 뺄셈이 섞이는 것**이다.
 * 두 번째 B 는 처음 양이 아니라 *남은 것*의 B 다. 아이들이 여기서 다 틀린다.
 */
function leftover(rng: Rng): Draft | null {
  const s = rng.pick(LEFTOVER)
  const w = rng.int(1, 4)
  const td = rng.pick([2, 3, 4, 5, 6] as const)
  const total = improper(w, rng.int(1, td - 1), td)
  const totalText = showMixed(w, total.n - w * td, td)

  const ad = rng.pick([2, 3, 4, 5, 6, 7] as const)
  const a: Frac = { n: rng.int(1, ad - 1), d: ad }
  const bd = rng.pick([2, 3, 4, 5] as const)
  const b: Frac = { n: rng.int(1, bd - 1), d: bd }

  // 처음 쓰고 남은 것
  const rest1 = mul(total, reduce({ n: a.d - a.n, d: a.d }))
  // 남은 것의 b 를 또 쓰고 남은 것
  const rest2 = mul(rest1, reduce({ n: b.d - b.n, d: b.d }))
  if (rest2.d > 24 || rest2.n <= 0 || value(rest2) > 20) return null
  if (value(rest2) === value(rest1)) return null

  const slips = [
    { why: '두 번째를 처음 양의 비율로 봄', wrong: mul(total, reduce({ n: (a.d - a.n) * (b.d - b.n), d: a.d * b.d })) },
    { why: '남은 것이 아니라 쓴 것을 답함', wrong: mul(rest1, b) },
    { why: '한 번만 쓴 것으로 봄', wrong: rest1 },
  ]
  const wrong = distractors(rest2, slips, () => rng.next())
  if (wrong.length < 3) return null
  const choices = rng.shuffle([show(rest2), ...wrong.map(show)])

  return {
    templateId: 'T13',
    params: { kind: 'leftover', thing: s.thing },
    difficulty: 3,
    prompt:
      `${josa(s.thing, '이가')} ${totalText} ${s.unit} 있습니다.\n` +
      `그중 ${josaAfter(show(a), '을를')} ${s.verb}.\n` +
      `남은 ${s.thing}의 ${josaAfter(show(b), '을를')} ${s.second}.\n` +
      `마지막에 남은 ${josa(s.thing, '은는')} 몇 ${s.unit}인가요?`,
    choices,
    answer: show(rest2),
    explanation:
      `${show(a)}을 썼으므로 남은 것은 처음의 ${show(reduce({ n: a.d - a.n, d: a.d }))}입니다.\n` +
      `${totalText} × ${show(reduce({ n: a.d - a.n, d: a.d }))} = ${show(rest1)}\n` +
      `두 번째 ${show(b)}은 **남은 것의** ${show(b)}입니다. 처음 양의 ${show(b)}이 아닙니다.\n` +
      `${show(rest1)} × ${show(reduce({ n: b.d - b.n, d: b.d }))} = ${show(rest2)}`,
    standard: STANDARD,
  }
}

export const T13: Template = {
  id: 'T13',
  name: '쓰고 남은 것 구하기',
  description:
    "'그중 얼마를 쓰고, 남은 것의 얼마를 또 썼다' 두 번째 기준이 남은 양이라는 점이 함정입니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => leftover(rng),
}

/* ── T14 자연수가 되게 하는 수 ──────────────────────── */

/**
 * `[5/12] × □` 가 자연수가 되게 하는 가장 작은 자연수 □.
 *
 * 분수 곱셈만으로는 못 푼다. **약수와 배수**를 끌어와야 한다.
 * 답은 분모를 분자와의 최대공약수로 나눈 값이다.
 * 곱셈 단원 안에서 다른 단원 개념이 필요한 첫 문항이라 진짜 심화다.
 */
function makeWhole(rng: Rng): Draft | null {
  const d = rng.pick([12, 14, 15, 16, 18, 20, 24] as const)
  const n = rng.int(1, d - 1)
  const f = reduce({ n, d })
  if (f.d === 1) return null
  const ans = f.d // 기약분수의 분모가 답이다

  // **약분을 반드시 거쳐야 풀리게 한다.**
  // 3/6 처럼 한눈에 1/2 로 보이면 답 2 가 그냥 보여서 생각할 거리가 없다.
  // 약분 전 분모(d)와 답(ans)이 충분히 달라야 "약분 먼저" 라는 판단이 필요해진다.
  if (gcd(n, d) === 1) return null // 약분할 게 없으면 그냥 분모를 답하면 된다
  if (ans < 5) return null // 답이 2·3·4 면 눈으로 보인다
  if (d - ans < 4) return null // 약분 전후가 비슷하면 헷갈릴 일이 없다

  // 오답 — 약분을 안 하거나, 분자를 답하거나, 분모+분자
  const cands = [d, f.n, n, ans + 1, ans - 1, 2 * ans]
  const wrong: number[] = []
  const seen = new Set<number>([ans])
  for (const c of cands) {
    if (wrong.length >= 3) break
    if (c <= 1 || seen.has(c)) continue
    seen.add(c)
    wrong.push(c)
  }
  if (wrong.length < 3) return null
  const choices = rng.shuffle([ans, ...wrong]).map(String)

  return {
    templateId: 'T14',
    params: { kind: 'make-whole' },
    difficulty: 3,
    prompt:
      `[${n}/${d}] × □ 의 계산 결과가 자연수가 되도록 하려고 합니다.\n` +
      `□ 안에 들어갈 수 있는 가장 작은 자연수는 얼마인가요?`,
    choices,
    answer: String(ans),
    explanation:
      `[${n}/${d}]을 약분하면 ${show(f)}입니다.\n` +
      `분모 ${f.d}가 없어져야 자연수가 되므로 ${f.d}의 배수를 곱해야 합니다.\n` +
      `가장 작은 수는 ${ans}입니다. (${show(f)} × ${ans} = ${show(mul(f, { n: ans, d: 1 }))})`,
    standard: STANDARD,
  }
}

export const T14: Template = {
  id: 'T14',
  name: '자연수가 되게 하는 수 찾기',
  description:
    "'분수 × □ 가 자연수가 되는 가장 작은 □' 약수와 배수를 함께 써야 풀립니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => makeWhole(rng),
}

/* ── T15 계산 없이 크기 판단 ────────────────────────── */

/**
 * "계산하지 않고" 원래 수보다 큰지 작은지 고른다.
 *
 * 1보다 작은 수를 곱하면 작아지고, 1보다 큰 수를 곱하면 커진다.
 * 익힘책에도 비슷한 문항이 있지만(계산 결과가 4보다 작은 것 찾기),
 * 여기서는 **계산을 막아** 원리로만 판단하게 한다.
 */
function judgeSize(rng: Rng): Draft | null {
  // 곱하는 수를 **모두 1에 가깝게** 만든다.
  // 1/2 과 2와1/3 처럼 벌어져 있으면 눈대중으로 끝나고,
  // 곱수가 크면 아이들이 그냥 다 계산해 버린다.
  // 19/20 · 1과1/15 처럼 붙여 두면 손으로 네 번 곱하는 게 훨씬 귀찮아서
  // "1보다 큰가 작은가" 를 보는 쪽이 실제로 빠른 길이 된다.
  const base = rng.int(24, 96)
  const items: { text: string; v: number }[] = []
  const seen = new Set<string>()
  for (let i = 0; i < 60 && items.length < 4; i++) {
    const d = rng.pick([9, 10, 11, 12, 15, 16, 18, 20] as const)
    let text: string
    let v: number
    if (rng.bool(0.5)) {
      // 1보다 조금 큰 대분수
      const n = rng.int(1, Math.max(1, Math.floor(d / 4)))
      text = showMixed(1, n, d)
      v = (d + n) / d
    } else {
      // 1보다 조금 작은 진분수
      const n = d - rng.int(1, Math.max(1, Math.floor(d / 4)))
      text = show({ n, d })
      v = n / d
    }
    if (seen.has(text)) continue
    seen.add(text)
    items.push({ text, v })
  }
  if (items.length < 4) return null

  const smaller = items.filter((x) => x.v < 1)
  const bigger = items.filter((x) => x.v > 1)
  // 답이 하나여야 한다 (G6)
  const askSmaller = smaller.length === 1
  if (!askSmaller && bigger.length !== 1) return null
  const target = askSmaller ? smaller[0]! : bigger[0]!

  const choices = items.map((x) => `${base} × ${x.text}`)
  if (new Set(choices).size !== 4) return null

  return {
    templateId: 'T15',
    params: { kind: 'judge-size', want: askSmaller ? 'small' : 'big' },
    difficulty: 3,
    // "계산하지 않고 답해 보세요" 는 뺐다.
    // 시험 문제에서 지킬 수도 확인할 수도 없는 말이라 아이들이 웃는다.
    // 문구로 막는 대신 **계산이 귀찮게** 만들어서 원리를 쓰게 한다.
    prompt: `계산 결과가 ${base}보다 ${askSmaller ? '작은' : '큰'} 것은 어느 것인가요?`,
    choices,
    answer: `${base} × ${target.text}`,
    explanation:
      `1보다 작은 수를 곱하면 원래 수보다 작아지고, 1보다 큰 수를 곱하면 커집니다.\n` +
      items
        .map((x) => `${x.text} 은(는) 1보다 ${x.v < 1 ? '작다' : '크다'}`)
        .join('\n') +
      `\n그러므로 ${base} × ${target.text} 하나만 ${base}보다 ${askSmaller ? '작습니다' : '큽니다'}.`,
    standard: STANDARD,
  }
}

export const T15: Template = {
  id: 'T15',
  name: '계산 없이 크기 판단하기',
  description:
    '1보다 큰 수를 곱하면 커지고 작은 수를 곱하면 작아진다는 원리로 계산 없이 판단합니다.',
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => judgeSize(rng),
}

export const HARD_TEMPLATES: Template[] = [T12, T13, T14, T15]

/** 검사 스크립트가 약수 계산을 다시 확인할 때 쓴다 */
export const smallestWholeMultiplier = (n: number, d: number): number => d / gcd(n, d)
