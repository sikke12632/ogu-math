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
  /*
   * 곱하는 수는 **분자 2 이상, 분모 4 이상**.
   * `[1/4] 을 곱했더니 [1/2]` 은 "4 배 하면 되네" 로 끝나는 나눗셈 암산이다.
   * `[3/8] 을 곱했더니 [2_5/8]` 이어야 보기를 하나씩 곱해 보게 된다.
   */
  const d = rng.pick([4, 5, 6, 7, 8, 9] as const)
  const mult: Frac = { n: rng.int(2, d - 1), d }
  if (gcd(mult.n, mult.d) !== 1) return null
  // 답이 될 수 (구하는 수). 깔끔한 값이어야 한다
  const ansD = rng.pick([3, 4, 5, 6, 7, 8] as const)
  const ans: Frac = rng.bool(0.4)
    ? { n: rng.int(3, 9), d: 1 }
    : { n: rng.int(2, ansD * 3), d: ansD }
  if (ans.d !== 1 && gcd(ans.n, ans.d) !== 1) return null
  const result = mul(ans, mult)
  if (result.d > 48 || result.n <= 0 || value(result) > 30) return null
  // 곱한 값이 원래 수와 같으면 문제가 안 된다
  if (value(result) === value(ans)) return null
  // 답이 1이면 "곱해도 그대로니까 1" 로 바로 보인다. 심화가 아니다
  if (value(ans) === 1) return null

  /*
   * 오답에 **문제에 적힌 수(곱한 수·결과)를 넣지 않는다.**
   * 넣으면 아이가 "저건 문제에 있던 거니까 아니지" 하고 둘을 지워 2지선다가 된다.
   * 한 번 더 곱한 값 하나만 실수에서 뽑고, 나머지는 답 근처 값으로 채워
   * 넷을 다 곱해 봐야 갈리게 한다.
   */
  const slips = [
    // 한 번 더 곱해 버리는 실수 — 나눗셈이 필요한 걸 모르면 이렇게 한다
    { why: '거꾸로 가지 않고 한 번 더 곱함', wrong: mul(result, mult) },
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

/**
 * 분모 3~8 의 기약 진분수. 기약이 아니면 다시 뽑는다 —
 * `return null` 로 버리면 분모 4·6·8 에서 절반이 날아가 생성률이 검수 기준 아래로 떨어진다.
 */
function reducedFrac(rng: Rng): Frac {
  for (;;) {
    const d = rng.pick([3, 4, 5, 6, 7, 8] as const)
    const n = rng.int(1, d - 1)
    if (gcd(n, d) === 1) return { n, d }
  }
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
  const w = rng.int(2, 5)
  const td = rng.pick([3, 4, 5, 6, 8] as const)
  const tn = rng.int(1, td - 1)
  if (gcd(tn, td) !== 1) return null
  const total = improper(w, tn, td)
  const totalText = showMixed(w, tn, td)

  /*
   * 쓰는 비율은 **[1/2] 을 뽑지 않는다.** `[1/2] 쓰고 남은 것의 [1/2]` 은
   * "반의 반" 으로 끝난다. 분모 3~8 에서 기약분수를 뽑고,
   * 둘 다 단위분수([1/3] 쓰고 남은 것의 [1/4])면 버린다 — 남은 비율이 한눈에 보인다.
   */
  const a = reducedFrac(rng)
  const b = reducedFrac(rng)
  // 같은 비율을 두 번 쓰면 "제곱" 지름길이 생긴다
  if (a.n === b.n && a.d === b.d) return null
  if (a.n === 1 && b.n === 1) return null

  // 처음 쓰고 남은 것
  const rest1 = mul(total, reduce({ n: a.d - a.n, d: a.d }))
  // 남은 것의 b 를 또 쓰고 남은 것
  const rest2 = mul(rest1, reduce({ n: b.d - b.n, d: b.d }))
  // 중간값은 풀이에 그대로 찍힌다. 분모 48 을 넘으면 표기 규칙에 걸린다
  if (rest1.d > 48) return null
  // 답의 분모 한도는 24 에서 48(표기 규칙의 최대)로 — 분모 2 를 뺐더니 24 로는 열에 아홉이
  // 버려졌고, 오답 셋을 실수에서만 뽑게 하자 40 으로도 생성률이 검수 기준(20%) 에 걸렸다
  if (rest2.d > 48 || rest2.n <= 0 || value(rest2) > 20) return null
  if (value(rest2) === value(rest1)) return null

  /*
   * 오답은 **실수에서만** 뽑고, 셋이 안 모이면 문항을 버린다.
   * 예전에는 `distractors` 에 맡겼는데, 첫 오답의 식이 틀려서(1−a 와 1−b 를 곱한 것 —
   * 그건 정답이다) 항상 정답과 겹쳤고, 모자란 자리를 분모를 ±1 흔든 `[13/37]` 같은
   * 값으로 채웠다. 실수처럼 안 보이는 보기는 소거법의 재료가 된다.
   *
   *   - 두 번째 비율을 처음 양의 비율로 봄:  처음 × (1 − a − b)
   *   - 남은 것이 아니라 두 번째 쓴 양을 답함: 남은 것 × b
   *   - 한 번만 쓴 것으로 봄:                처음 × (1 − a)
   *   - 쓴 양이 아니라 남은 양의 비율로 곱함:  처음 × a × b
   */
  const bothFromStart = a.n * b.d + b.n * a.d < a.d * b.d
    ? mul(total, reduce({ n: a.d * b.d - a.n * b.d - b.n * a.d, d: a.d * b.d }))
    : null
  const slipVals: Frac[] = [
    ...(bothFromStart ? [bothFromStart] : []),
    mul(rest1, b),
    rest1,
    mul(mul(total, a), b),
  ]
  const wrong: Frac[] = []
  const seenKey = new Set<string>([`${rest2.n}/${rest2.d}`])
  for (const f of slipVals) {
    if (wrong.length >= 3) break
    const key = `${f.n}/${f.d}`
    if (seenKey.has(key) || f.n <= 0 || f.d > 48) continue
    seenKey.add(key)
    wrong.push(f)
  }
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
  /*
   * 분모는 24~48. 예전 12~24 에서는 `[4/24]` 가 나와 한눈에 [1/6] 이 보였다.
   * 약분한 결과가 **단위분수가 아니어야** 한다 — `[4/24] → [1/6]` 은 "24 를 4 로 나누면 6"
   * 이지만 `[20/48] → [5/12]` 는 최대공약수를 찾고 분모를 그걸로 나눠야 한다.
   */
  const d = rng.pick([24, 27, 28, 30, 32, 36, 40, 42, 45, 48] as const)
  const n = rng.int(2, d - 1)
  const f = reduce({ n, d })
  if (f.d === 1) return null
  const ans = f.d // 기약분수의 분모가 답이다

  // **약분을 반드시 거쳐야 풀리게 한다.**
  // 3/6 처럼 한눈에 1/2 로 보이면 답 2 가 그냥 보여서 생각할 거리가 없다.
  // 약분 전 분모(d)와 답(ans)이 충분히 달라야 "약분 먼저" 라는 판단이 필요해진다.
  if (gcd(n, d) === 1) return null // 약분할 게 없으면 그냥 분모를 답하면 된다
  if (f.n === 1) return null // 단위분수로 떨어지면 "분모 ÷ 분자" 로 바로 보인다
  if (ans < 7) return null // 답이 한 자리 앞쪽이면 눈으로 보인다
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
 * "67 × ? × ? 의 결과가 67보다 큰 것은?"
 *
 * ── 왜 두 번 곱하게 바꿨나 ─────────────────────────
 * 처음에는 곱하는 수가 하나였다. `67 × [12/11]` 처럼.
 * 그러면 **분자가 분모보다 큰 것 하나를 찾으면 끝난다.** 한눈에 보인다.
 * 원리를 아는지 묻는 게 아니라 분수를 볼 줄 아는지 묻는 문항이 되어 버렸다.
 *
 * 그래서 곱하는 수를 둘로 만든다. **하나는 1보다 크고 하나는 1보다 작게** —
 * 넷 다 `대분수 × 진분수` 라 눈으로는 아무것도 못 고른다.
 * 1보다 큰 쪽이 대분수라 그것만은 한눈에 보이지만, 그건 상관없다.
 * `1과[3/4] × [5/8]` 이 1보다 큰지는 여전히 곱해 봐야 알기 때문이다.
 *
 * 세 수를 곱하는 것은 범위 안이다 — 익힘책 상 문항이 이미
 * `텃밭의 [1/6] → 그중 [2/3] → 그중 [3/4]` 로 삼중을 낸다
 * (`docs/2단원_유형분석.md` 발견 3). 다만 익힘책은 문장제로만 내고,
 * 곱수를 **가분수로 적지는 않는다.** 그래서 대분수로 쓴다.
 * 커지는지 작아지는지는 **두 분수를 곱한 것이 1보다 큰가**로 정해지고,
 * 그건 분자끼리·분모끼리 곱해 견주어야 알 수 있다.
 * 계산은 두 자리 곱셈 한 번, 생각은 두 단계다.
 *
 * 곱한 값이 1에 바짝 붙어 있어야 한다. 30 대 28 처럼 아슬아슬해야
 * 눈대중이 안 통하고 실제로 견주게 된다.
 */
function judgeSize(rng: Rng): Draft | null {
  const base = rng.int(24, 96)

  type Item = { text: string; big: boolean }
  const items: Item[] = []
  const seen = new Set<string>()

  for (let i = 0; i < 200 && items.length < 4; i++) {
    // 1보다 큰 쪽 — 대분수로 적는다. 교과서가 쓰는 표기다
    const d1 = rng.int(3, 9)
    const n1 = d1 + rng.int(1, 3)
    if (gcd(n1, d1) !== 1) continue
    // 1보다 작은 쪽
    const d2 = rng.int(4, 9)
    const n2 = d2 - rng.int(1, 3)
    if (n2 < 1 || gcd(n2, d2) !== 1) continue

    const top = n1 * n2
    const bottom = d1 * d2
    if (top === bottom) continue // 결과가 그대로면 크지도 작지도 않다
    // 1 에서 멀어지면 눈대중으로 끝난다
    if (Math.abs(top / bottom - 1) > 0.18) continue

    const text = `${base} × ${showMixed(1, n1 - d1, d1)} × ${show({ n: n2, d: d2 })}`
    if (seen.has(text)) continue
    seen.add(text)
    items.push({ text, big: top > bottom })
  }
  if (items.length < 4) return null

  const bigger = items.filter((x) => x.big)
  const smaller = items.filter((x) => !x.big)
  // 답이 하나여야 한다 (G6)
  const askSmaller = smaller.length === 1
  if (!askSmaller && bigger.length !== 1) return null
  const target = askSmaller ? smaller[0]! : bigger[0]!

  const choices = items.map((x) => x.text)
  if (new Set(choices).size !== 4) return null

  const explainOne = (x: Item): string => {
    // 대분수를 가분수로 바꿔 분자끼리·분모끼리 곱한다 — 교과서가 가르치는 그 방법이다
    const m = /\[1_(\d+)\/(\d+)\] × \[(\d+)\/(\d+)\]/.exec(x.text)!
    const [w, d1, n2, d2] = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])]
    const n1 = d1 + w
    const top = n1 * n2
    const bottom = d1 * d2
    return (
      `${showMixed(1, w, d1)} × ${show({ n: n2, d: d2 })} → ` +
      `${showMixed(1, w, d1)} 을 가분수로 바꾸면 분자 ${n1}, 분모 ${d1}
` +
      `  분자 ${n1} × ${n2} = ${top}, 분모 ${d1} × ${d2} = ${bottom}` +
      ` → ${top} ${top > bottom ? '>' : '<'} ${bottom} 이므로 1보다 ${top > bottom ? '큽니다' : '작습니다'}`
    )
  }

  return {
    templateId: 'T15',
    params: { kind: 'judge-size', want: askSmaller ? 'small' : 'big' },
    difficulty: 3,
    // "계산하지 않고 답해 보세요" 는 뺐다.
    // 시험 문제에서 지킬 수도 확인할 수도 없는 말이라 아이들이 웃는다.
    // 문구로 막는 대신 **계산이 귀찮게** 만들어서 원리를 쓰게 한다.
    prompt: `계산 결과가 ${base}보다 ${askSmaller ? '작은' : '큰'} 것은 어느 것인가요?`,
    choices: rng.shuffle(choices),
    answer: target.text,
    explanation:
      `곱하는 두 수를 먼저 곱해 1과 견줍니다.\n` +
      `1보다 큰 수를 곱하면 커지고, 1보다 작은 수를 곱하면 작아집니다.\n` +
      items.map(explainOne).join('\n') +
      `\n그러므로 ${target.text} 하나만 ${base}보다 ${askSmaller ? '작습니다' : '큽니다'}.`,
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
