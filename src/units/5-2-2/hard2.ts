/**
 * 더 어려운 심화 — T16~T19.
 *
 * ── 왜 또 만들었나 ──────────────────────────────────
 * hard.ts 의 T12~T15 를 넣고도 **"상 치고 쉽다"** 는 말이 또 나왔다.
 * T12~T15 는 익힘책 밖으로 한 발 나갔을 뿐, 여전히 *분수 하나를 다루는* 문항이다.
 *
 * 여기 넷은 선생님이 직접 잡아 준 얼개다. 공통점은
 * **분수 곱셈이 문제의 전부가 아니라는 것** — 곱셈은 도중에 한 번 쓰이고,
 * 그 앞뒤로 다른 생각이 붙는다.
 *
 *   T16  역산 + 중첩     비율을 두 겹 겹친 뒤 실제 사람 수에서 거꾸로 올라온다
 *   T17  □ 자연수 개수    양쪽 끝을 계산하고 그 사이 자연수를 센다
 *   T18  튀어오르는 공    같은 비율을 반복해서 곱한다
 *   T19  속력과 거리      단위가 붙고, 두 값을 만들어 견준다
 *
 * ── 아직 못 만든 것 ────────────────────────────────
 * **겹친 부분의 넓이**(도형 두 개가 포개진 그림)는 여기 없다. 그림이 있어야
 * 성립하는데 `FigureSpec` 은 타입만 있고 그리는 코드가 없다. 만들려면
 * 코어를 건드려야 해서 멈췄다 (`docs/현재_상태.md` 참고).
 */

import type { Rng } from '../../lib/rng'
import type { Draft, Template } from '../_types'
import { improper, josa, josaAfter, mul, show, showMixed, value, type Frac } from './frac'
import { STANDARD } from './calc'

/* ── T16 역산 + 중첩 ───────────────────────────────── */

/** unit 의 batchim — '명' 은 받침이 있어 '5명이라면', '그루' 는 없어서 '5그루라면' */
const WHO = [
  { whole: '전교생', a: '남학생', b: '안경을 쓴 남학생', unit: '명', batchim: true },
  { whole: '전교생', a: '여학생', b: '피아노를 배우는 여학생', unit: '명', batchim: true },
  { whole: '우리 반 학생', a: '남학생', b: '축구를 좋아하는 남학생', unit: '명', batchim: true },
  { whole: '동아리 회원', a: '5학년 회원', b: '악기를 다루는 5학년 회원', unit: '명', batchim: true },
  { whole: '농장의 나무', a: '사과나무', b: '열매가 달린 사과나무', unit: '그루', batchim: false },
] as const

/**
 * "전체의 [2/5]가 남학생, 남학생의 [3/4]이 안경을 썼다.
 *  안경 쓴 남학생이 12명이면 전체는 몇 명인가?"
 *
 * **거꾸로 올라와야 한다.** 아이들이 아는 길은 전체 → 부분 방향뿐인데,
 * 여기서는 제일 안쪽 값만 주고 바깥을 묻는다.
 * 두 비율을 먼저 곱해 `전체의 [3/10]` 을 만든 다음,
 * `전체 × [3/10] = 12` 에서 전체를 찾는 것이 정석이다.
 *
 * 답이 자연수라서 **단답형**으로 낼 수 있다. 크롬북에서 분수는 못 치지만
 * 자연수는 친다 — 보기 넷에서 고르는 것보다 훨씬 어렵다.
 */
function backward(rng: Rng): Draft | null {
  const s = rng.pick(WHO)
  const ad = rng.pick([2, 3, 4, 5, 6] as const)
  const bd = rng.pick([2, 3, 4, 5, 6] as const)
  const a: Frac = { n: rng.int(1, ad - 1), d: ad }
  const b: Frac = { n: rng.int(1, bd - 1), d: bd }
  const both = mul(a, b)

  // 겹친 비율이 너무 단순하면(1/2, 1/4 같은 것) 암산으로 끝난다
  if (both.d < 4) return null
  // 전체 = 안쪽 값 ÷ 겹친 비율. 전체가 자연수여야 사람 수가 된다
  const times = rng.int(2, 5)
  const whole = both.d * times
  if (whole > 200) return null
  const inner = (whole * both.n) / both.d
  if (!Number.isInteger(inner) || inner < 4) return null
  // 안쪽 값이 전체와 같으면 문제가 안 된다
  if (inner === whole) return null

  // 오답 — 아이들이 실제로 하는 길
  const slips = [
    // 한 겹만 거꾸로 올라옴 (b 만 되돌리고 a 를 잊음)
    Math.round((inner * b.d) / b.n),
    // 거꾸로 가지 않고 곱해 버림
    Math.round(inner * both.n / both.d),
    // 두 비율을 더해서 되돌림
    Math.round((inner * (a.d * b.d)) / (a.n * b.d + b.n * a.d)),
  ]
  const seen = new Set<number>([whole])
  const wrong: number[] = []
  for (const v of slips) {
    // 1명·2명 같은 답은 아이들이 보자마자 지운다. 오답도 그럴듯해야 한다
    if (v < 4 || v > 400 || seen.has(v)) continue
    seen.add(v)
    wrong.push(v)
  }
  // 모자라면 가까운 수로 채운다
  for (let k = 1; wrong.length < 3 && k < 20; k++) {
    for (const v of [whole + k * both.d, whole - k * both.d]) {
      if (wrong.length >= 3 || v < 4 || seen.has(v)) continue
      seen.add(v)
      wrong.push(v)
    }
  }
  if (wrong.length < 3) return null

  return {
    templateId: 'T16',
    params: { kind: 'backward', scenario: s.whole + s.a },
    difficulty: 3,
    prompt:
      `${s.whole} 전체의 ${josaAfter(show(a), '이가')} ${s.a}입니다.\n` +
      `${s.a}의 ${josaAfter(show(b), '이가')} ${s.b}입니다.\n` +
      `${josa(s.b, '이가')} ${inner}${s.unit}${s.batchim ? '이라면' : '라면'} ` +
      `${josa(s.whole, '은는')} 모두 몇 ${s.unit}인가요?`,
    choices: rng.shuffle([String(whole), ...wrong.map(String)]),
    answer: String(whole),
    explanation:
      `${josa(s.b, '은는')} 전체의 ${show(a)} × ${show(b)} = ${show(both)} 입니다.\n` +
      `전체의 ${show(both)}이 ${inner}${s.unit}이므로,\n` +
      `전체를 ${both.d}묶음으로 보면 ${both.n}묶음이 ${inner}${s.unit},\n` +
      `한 묶음은 ${inner / both.n}${s.unit}, 전체는 ${inner / both.n} × ${both.d} = ${whole}${s.unit}입니다.`,
    standard: STANDARD,
  }
}

export const T16: Template = {
  id: 'T16',
  name: '거꾸로 전체 구하기',
  description:
    "'전체의 5분의 2가 남학생, 남학생의 4분의 3이 안경을 썼다. 안경 쓴 남학생이 12명이면 전체는?' 비율을 겹친 뒤 실제 수에서 거꾸로 올라옵니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => backward(rng),
}

/* ── T17 □ 안에 들어갈 자연수 개수 ─────────────────── */

/**
 * "[2/5] × 15 < □ < [3/4] × 12 를 만족하는 자연수 □ 는 몇 개인가?"
 *
 * 곱셈은 두 번뿐이지만, 그 뒤가 이 문항의 몸통이다 —
 * **부등호를 읽고, 양 끝을 자연수로 옮기고, 사이를 센다.**
 * 끝값이 자연수로 딱 떨어질 때 그 값을 포함하는지 아닌지에서 아이들이 갈린다.
 * 그래서 일부러 딱 떨어지는 경우와 아닌 경우를 섞는다.
 *
 * 답이 개수(자연수)라 **단답형**이다.
 */
function howManyInts(rng: Rng): Draft | null {
  const mk = (): { text: string; v: number } | null => {
    const d = rng.pick([2, 3, 4, 5, 6, 8] as const)
    /*
     * 분모로 나누어떨어지면 show 가 자연수로 그린다 — `2 × 7` 이 되어 버려서
     * 분수 곱셈 문제가 아니게 된다. 버리지 말고 **처음부터 안 나오게** 만든다:
     * 진분수(n < d) 를 뽑고, 절반은 거기에 분모를 한 번 더해 대분수로 올린다.
     */
    const n = rng.int(1, d - 1) + (rng.bool() ? d : 0)
    const k = rng.int(4, 24)
    const f: Frac = { n, d }
    const r = mul(f, { n: k, d: 1 })
    if (value(r) > 40) return null
    // 가분수는 대분수로 그린다 — show 가 알아서 한다
    return { text: `${show(f)} × ${k}`, v: value(r) }
  }

  const x = mk()
  const y = mk()
  if (!x || !y) return null
  // 순서가 뒤집혔다고 버리지 않는다. 작은 쪽을 왼쪽에 두면 그만이다
  const lo = x.v <= y.v ? x : y
  const hi = x.v <= y.v ? y : x
  if (hi.v - lo.v < 1.2) return null // 답이 0 이나 1 이면 셀 것이 없다
  if (hi.v - lo.v > 12) return null // 너무 벌어지면 그냥 세기만 하는 문제가 된다

  // lo < □ < hi 를 만족하는 자연수 개수 (양 끝은 넣지 않는다)
  const first = Math.floor(lo.v) + 1
  const last = Math.ceil(hi.v) - 1
  const count = last - first + 1
  if (count < 2 || count > 11) return null

  const list = []
  for (let i = first; i <= last; i++) list.push(i)

  return {
    templateId: 'T17',
    params: { kind: 'count-ints' },
    difficulty: 3,
    prompt:
      `${lo.text} < □ < ${hi.text}\n` +
      `□ 안에 들어갈 수 있는 자연수는 모두 몇 개인가요?`,
    answer: String(count),
    explanation:
      `${lo.text} = ${fmt(lo.v)}, ${hi.text} = ${fmt(hi.v)} 입니다.\n` +
      `${fmt(lo.v)}보다 크고 ${fmt(hi.v)}보다 작은 자연수는 ${list.join(', ')} 이므로 ${count}개입니다.\n` +
      `부등호에 밑줄이 없으므로 양 끝의 수는 넣지 않습니다.`,
    standard: STANDARD,
  }
}

/** 설명에 쓸 값 표기. 자연수면 그대로, 아니면 분수로 */
function fmt(v: number): string {
  if (Number.isInteger(v)) return String(v)
  // 소수로 적으면 5학년이 못 읽는다. 분모 24 까지 찾아 분수로 되돌린다
  for (let d = 2; d <= 24; d++) {
    const n = Math.round(v * d)
    if (Math.abs(n / d - v) < 1e-9) return show({ n, d })
  }
  return String(Math.round(v * 100) / 100)
}

export const T17: Template = {
  id: 'T17',
  name: '□ 안에 들어갈 자연수 개수',
  description:
    "'5분의 2 × 15 < □ < 4분의 3 × 12 를 만족하는 자연수는 몇 개?' 양쪽을 계산하고 그 사이의 개수를 셉니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => howManyInts(rng),
}

/* ── T18 튀어오르는 공 ─────────────────────────────── */

const BOUNCE = ['공', '고무공', '탱탱볼'] as const

/**
 * "떨어진 높이의 [3/5]만큼 튀어오르는 공을 50 m 높이에서 떨어뜨렸다.
 *  두 번째로 튀어오른 높이는?"
 *
 * **같은 비율을 두 번 곱한다.** 한 번만 곱하고 답하는 아이가 제일 많고,
 * 그게 그대로 오답 보기가 된다.
 * 세 번째까지 묻는 것도 섞는다 — 계산이 늘어나는 게 아니라
 * *몇 번 곱해야 하는지 세는 일*이 늘어난다.
 */
function bounce(rng: Rng): Draft | null {
  const thing = rng.pick(BOUNCE)
  const d = rng.pick([2, 3, 4, 5] as const)
  const n = rng.int(1, d - 1)
  const ratio: Frac = { n, d }
  const times = rng.pick([2, 2, 3] as const)

  // 답이 자연수가 되게 시작 높이를 고른다. 분수 높이는 크롬북에서 못 친다
  const need = Math.pow(d, times)
  const base = need * rng.int(1, Math.floor(96 / need) || 1)
  // 공을 떨어뜨리는 높이다. 128 m 짜리 공놀이는 없다
  if (base < 8 || base > 96) return null
  const answer = (base * Math.pow(n, times)) / need
  if (!Number.isInteger(answer) || answer < 1) return null
  if (answer === base) return null

  const seen = new Set<number>([answer])
  const wrong: number[] = []
  const push = (v: number): void => {
    // **여기서 개수를 막아야 한다.** 바깥 for 문은 한 바퀴에 두 번 부르므로
    // 조건을 바깥에만 두면 보기가 다섯 개가 되어 나간다
    if (wrong.length >= 3) return
    if (!Number.isInteger(v) || v <= 0 || v >= base || seen.has(v)) return
    seen.add(v)
    wrong.push(v)
  }
  // 한 번 덜 곱함 — 제일 흔한 실수
  push((base * Math.pow(n, times - 1)) / Math.pow(d, times - 1))
  // 한 번 더 곱함
  push((base * Math.pow(n, times + 1)) / Math.pow(d, times + 1))
  // 비율을 곱하는 대신 배수로 곱함 (2번이면 비율 × 2)
  push(Math.round((base * n * times) / d))
  for (let k = 1; wrong.length < 3 && k < 30; k++) {
    push(answer + k)
    push(answer - k)
  }
  if (wrong.length < 3) return null

  const ord = times === 2 ? '두' : '세'
  return {
    templateId: 'T18',
    params: { kind: 'bounce', depth: String(times) },
    difficulty: 3,
    prompt:
      `떨어진 높이의 ${show(ratio)}만큼 튀어오르는 ${thing}이 있습니다.\n` +
      `이 ${thing}을 ${base} m 높이에서 떨어뜨렸습니다.\n` +
      `${ord} 번째로 튀어오른 높이는 몇 m인가요?`,
    choices: rng.shuffle([String(answer), ...wrong.map(String)]).map((x) => `${x} m`),
    answer: `${answer} m`,
    explanation:
      Array.from({ length: times }, (_, i) => {
        const h = (base * Math.pow(n, i + 1)) / Math.pow(d, i + 1)
        return `${i + 1}번째: ${(base * Math.pow(n, i)) / Math.pow(d, i)} × ${show(ratio)} = ${h} m`
      }).join('\n') +
      `\n${show(ratio)}을 ${times}번 곱해야 합니다.`,
    standard: STANDARD,
  }
}

export const T18: Template = {
  id: 'T18',
  name: '튀어오르는 공',
  description:
    "'떨어진 높이의 5분의 3만큼 튀어오른다. 두 번째로 튀어오른 높이는?' 같은 비율을 반복해서 곱합니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => bounce(rng),
}

/* ── T19 속력과 거리 ───────────────────────────────── */

/**
 * "1시간에 42 km 가는 자동차가 1과[1/3]시간 동안 간 거리는?"
 *
 * 이것만이면 `자연수 × 대분수` 한 번이라 상이 아니다. 그래서 **둘을 견주게** 한다 —
 * 서로 다른 두 대가 각각 다른 시간을 달렸고, 어느 쪽이 더 멀리 갔는지,
 * 또는 얼마나 더 갔는지를 묻는다. 곱셈 두 번에 비교나 뺄셈이 붙는다.
 *
 * 단위(km)가 붙어 있어 실생활에 가장 가까운 문항이기도 하다.
 */
/**
 * **느린 것부터 순서대로 적어 둔다.** 이 순서가 중요하다 —
 * 자전거와 기차를 함께 내면 계산하지 않아도 기차가 이긴다.
 * 이웃한 것끼리만 짝지어야 거리가 비슷해지고, 그래야 실제로 곱셈을 한다.
 */
const MOVER = [
  { thing: '자전거', lo: 12, hi: 20 },
  { thing: '배', lo: 20, hi: 32 },
  { thing: '오토바이', lo: 24, hi: 40 },
  { thing: '자동차', lo: 30, hi: 48 },
  { thing: '기차', lo: 48, hi: 84 },
] as const

/**
 * "1시간에 42 km 가는 자동차가 1과[1/3]시간 동안 간 거리는?"
 *
 * 이것만이면 `자연수 × 대분수` 한 번이라 상이 아니다. 그래서 **여러 대를 견주게** 한다 —
 * 서로 다른 차가 저마다 다른 시간을 달렸고, 어느 쪽이 더 멀리 갔는지
 * 또는 얼마나 더 갔는지를 묻는다. 곱셈이 두세 번에 비교나 뺄셈이 붙는다.
 *
 * **거리를 보기에 적지 않는다.** 한 번 그렇게 만들었다가
 * `기차 (195 km) / 자동차 (90 km)` 가 되어 문제가 스스로 답을 말해 버렸다.
 *
 * 두 거리가 너무 벌어져 있어도 안 된다. 208 km 와 24 km 면 계산하지 않아도
 * 기차가 이긴다. **가까울 때만 낸다.**
 */
function speed(rng: Rng): Draft | null {
  type Run = { name: string; rate: number; hours: string; dist: number }

  const mk = (m: (typeof MOVER)[number]): Run | null => {
    const d = rng.pick([2, 3, 4, 5, 6] as const)
    const w = rng.int(1, 2)
    const n = rng.int(1, d - 1)
    // 거리가 자연수여야 크롬북으로 칠 수 있고, 견주기도 깔끔하다
    const loK = Math.ceil(m.lo / d)
    const hiK = Math.floor(m.hi / d)
    if (hiK < loK) return null
    const rate = d * rng.int(loK, hiK)
    const hours = improper(w, n, d)
    const dist = (rate * hours.n) / hours.d
    if (!Number.isInteger(dist)) return null
    return { name: m.thing, rate, hours: showMixed(w, n, d), dist }
  }

  const line = (r: Run): string =>
    `${josa(r.name, '은는')} 1시간에 ${r.rate} km를 갑니다. ` +
    `이 ${josa(r.name, '이가')} ${r.hours}시간 동안 갔습니다.`

  const askDiff = rng.bool(0.5)
  // 속력이 이웃한 것끼리만 뽑는다 (위 MOVER 주석)
  const span = askDiff ? 2 : 3
  const at = rng.int(0, MOVER.length - span)
  const picked = MOVER.slice(at, at + span)

  if (askDiff) {
    const a = mk(picked[0]!)
    const b = mk(picked[1]!)
    if (!a || !b || a.dist === b.dist) return null
    const far = a.dist > b.dist ? a : b
    const near = a.dist > b.dist ? b : a
    const diff = far.dist - near.dist
    // 한눈에 승부가 나면 곱셈을 안 한다. 두 거리가 비슷할 때만 낸다
    if (diff > near.dist / 2) return null
    if (diff < 2) return null
    // 속력과 시간이 둘 다 같으면 견줄 것이 없다
    if (a.rate === b.rate && a.hours === b.hours) return null

    const seen = new Set<number>([diff])
    const wrong: number[] = []
    const push = (v: number): void => {
      if (wrong.length >= 3) return
      if (!Number.isInteger(v) || v <= 0 || seen.has(v)) return
      seen.add(v)
      wrong.push(v)
    }
    push(far.dist + near.dist) // 더해 버림
    push(far.dist) // 먼 쪽 거리를 그대로 답함
    push(Math.abs(far.rate - near.rate)) // 시간을 빼먹고 속력만 뺌
    for (let k = 1; wrong.length < 3 && k < 30; k++) { push(diff + k); push(diff - k) }
    if (wrong.length < 3) return null

    return {
      templateId: 'T19',
      params: { kind: 'speed', want: 'diff' },
      difficulty: 3,
      prompt:
        `${line(a)}\n${line(b)}\n` +
        `더 멀리 간 쪽은 다른 쪽보다 몇 km 더 갔나요?`,
      choices: rng.shuffle([String(diff), ...wrong.map(String)]).map((x) => `${x} km`),
      answer: `${diff} km`,
      explanation:
        `${a.name}: ${a.rate} × ${a.hours} = ${a.dist} km\n` +
        `${b.name}: ${b.rate} × ${b.hours} = ${b.dist} km\n` +
        `${josa(far.name, '이가')} 더 멀리 갔고, ${far.dist} - ${near.dist} = ${diff} km 더 갔습니다.`,
      standard: STANDARD,
    }
  }

  // 세 대를 늘어놓고 가장 멀리 간 것을 고르게 한다. 곱셈을 세 번 해야 한다
  const runs = picked.map((m) => mk(m))
  if (runs.some((r) => !r)) return null
  const rs = runs as Run[]
  const dists = rs.map((r) => r.dist)
  const best = Math.max(...dists)
  // 1등이 둘이면 답이 하나가 아니다
  if (dists.filter((v) => v === best).length !== 1) return null
  const worst = Math.min(...dists)
  // 셋이 서로 가까워야 실제로 계산하게 된다
  if (best - worst > worst / 2) return null
  // 2등과 너무 벌어지면 1등만 눈에 띈다
  const second = [...dists].sort((p, q) => q - p)[1]!
  if (best - second > second / 4) return null

  return {
    templateId: 'T19',
    params: { kind: 'speed', want: 'which' },
    difficulty: 3,
    prompt: `${rs.map(line).join('\n')}\n가장 멀리 간 것은 어느 것인가요?`,
    // **거리를 붙이지 않는다.** 붙이면 문제가 답을 말해 준다
    choices: rng.shuffle(rs.map((r) => r.name)),
    answer: rs.find((r) => r.dist === best)!.name,
    explanation:
      rs.map((r) => `${r.name}: ${r.rate} × ${r.hours} = ${r.dist} km`).join('\n') +
      `\n그러므로 ${josa(rs.find((r) => r.dist === best)!.name, '이가')} 가장 멀리 갔습니다.`,
    standard: STANDARD,
  }
}
export const T19: Template = {
  id: 'T19',
  name: '속력과 거리',
  description:
    "'1시간에 42 km 가는 차가 1과 3분의 1시간 동안 간 거리는?' 두 대를 견주게 해서 곱셈 두 번에 비교가 붙습니다.",
  topic: '심화',
  supports: [3],
  family: '활용',
  generate: (rng) => speed(rng),
}

export const HARD2_TEMPLATES: Template[] = [T16, T17, T18, T19]
