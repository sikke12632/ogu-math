/**
 * 공용 가드 G1~G8 과 어림 계산.
 *
 * 어림 계산은 **두 가지 방법으로 각각 구해 대조**한다(독립 검산).
 *  - 방법 A: 나머지 연산 (정수로 환산해서 계산)
 *  - 방법 B: 십진 문자열을 잘라 붙이는 방식
 * 두 결과가 다르면 그 문항을 버린다. 소수 자리에서 부동소수점 오차가 나면 여기서 잡힌다.
 */

import type { Rng } from '../lib/rng'

export type Method = '올림' | '버림' | '반올림'

/** 자리 이름 → 그 자리의 크기 */
export const PLACES = {
  십: 10,
  백: 100,
  천: 1000,
  '소수 첫째': 0.1,
  '소수 둘째': 0.01,
} as const
export type PlaceName = keyof typeof PLACES

/** 부동소수점 오차 제거. 이 단원 수치는 소수 셋째 자리까지면 충분하다 */
export function fix(n: number): number {
  return Math.round(n * 1e6) / 1e6
}

/* ── 방법 A: 나머지 연산 ────────────────────────────────── */

const SCALE = 1e6
const toI = (n: number) => Math.round(n * SCALE)

function estimateA(n: number, place: number, method: Method): number {
  const nI = toI(n)
  const pI = toI(place)
  const rem = ((nI % pI) + pI) % pI
  const floor = nI - rem
  if (method === '버림') return fix(floor / SCALE)
  if (method === '올림') return fix((rem === 0 ? floor : floor + pI) / SCALE)
  return fix((rem * 2 >= pI ? floor + pI : floor) / SCALE)
}

/* ── 방법 B: 십진 문자열 ────────────────────────────────── */

/** 어림하려는 자리 바로 아래 자리의 숫자, 그리고 그 아래가 전부 0인지 */
export function digitsBelow(n: number, place: number): { first: number; allZero: boolean } {
  const e = Math.round(Math.log10(place))
  const s = n.toFixed(6)
  const dot = s.indexOf('.')
  const all = s.slice(0, dot) + s.slice(dot + 1)
  const idx = dot - 1 - e
  const below = all.slice(idx + 1)
  return { first: Number(below[0] ?? '0'), allZero: !/[1-9]/.test(below) }
}

function estimateB(n: number, place: number, method: Method): number {
  const e = Math.round(Math.log10(place))
  const s = n.toFixed(6)
  const dot = s.indexOf('.')
  const all = s.slice(0, dot) + s.slice(dot + 1)
  const idx = dot - 1 - e
  const kept = all.slice(0, idx + 1) + '0'.repeat(all.length - idx - 1)
  const truncated = Number(kept.slice(0, dot) + '.' + kept.slice(dot))
  const { first, allZero } = digitsBelow(n, place)
  if (method === '버림') return fix(truncated)
  if (method === '올림') return fix(allZero ? truncated : truncated + place)
  return fix(first >= 5 ? truncated + place : truncated)
}

/**
 * 어림값. 두 방법이 어긋나면 예외를 던진다.
 * 조용히 넘어가면 "앱은 도는데 답이 틀린" 최악의 상태가 된다.
 */
export function estimate(n: number, place: number, method: Method): number {
  const a = estimateA(n, place, method)
  const b = estimateB(n, place, method)
  if (a !== b) {
    throw new Error(`독립 검산 불일치: ${n} ${method} ${place} → A=${a} B=${b}`)
  }
  return a
}

/* ── 수 만들기 ──────────────────────────────────────────── */

export type ComposeOptions = {
  /** 어림할 자리 */
  place: number
  /** 만들 수의 최소 단위 (자연수 1, 소수 첫째까지 0.1 …) */
  unit: number
  /** place 단위 몫의 범위. 예) place=100, above 12~48 이면 1200~4899 */
  aboveMin: number
  aboveMax: number
  /** 어림 자리 바로 아래 자리의 숫자를 지정 (G1·G2) */
  belowFirst: number
  /** true 면 연쇄 자리올림이 나는 수를 허용 (G3) */
  allowChainCarry: boolean
}

/**
 * 어림 문항용 수를 만든다.
 *   G1 — belowFirst 를 1~9 로 주면 "어림 자리 아래 첫 자리 0" 이 원천 차단된다
 *   G3 — allowChainCarry=false 면 어림 자리 바로 위 숫자가 9 인 수를 피한다
 */
export function composeNumber(rng: Rng, o: ComposeOptions): number | null {
  for (let attempt = 0; attempt < 50; attempt++) {
    const above = rng.int(o.aboveMin, o.aboveMax)
    if (!o.allowChainCarry && above % 10 === 9) continue
    const sub = o.place / 10
    const steps = Math.max(1, Math.round(sub / o.unit))
    const tail = steps > 1 ? rng.int(0, steps - 1) * o.unit : 0
    const n = fix(above * o.place + o.belowFirst * sub + tail)
    if (n <= 0) continue
    return n
  }
  return null
}

/* ── 가드 ───────────────────────────────────────────────── */

/** G1 — 어림 대상 자리 아래 첫 자리는 0 금지. (340 을 십의 자리로 어림하면 세 방법 결과가 같다) */
export function g1_belowFirstNotZero(n: number, place: number): boolean {
  return digitsBelow(n, place).first !== 0
}

/** G2 — 반올림 기준 자리 숫자는 {3,4,5,6,7} 에서 균등하게. 4·5 가 합쳐서 40% 가 된다 */
export function g2_pickRoundingDigit(rng: Rng): number {
  return rng.pick([3, 4, 5, 6, 7])
}

/** G3 — 연쇄 자리올림 여부. 하 난이도에서 금지, 상 난이도에서 의도적으로 허용 */
export function g3_hasChainCarry(n: number, place: number): boolean {
  return Math.floor(fix(n / place)) % 10 === 9
}

/** G4 — 보기 값에 중복이 없어야 한다 */
export function g4_choicesDistinct(choices: string[]): boolean {
  return new Set(choices).size === choices.length
}

/** G5 — 실생활 수치의 현실 범위 */
export const REALISTIC = {
  키: { min: 100, max: 155, unit: 0.1, suffix: 'cm' },
  몸무게: { min: 25, max: 60, unit: 0.1, suffix: 'kg' },
  인원: { min: 1, max: 40, unit: 1, suffix: '명' },
  요금: { min: 100, max: 9900, unit: 100, suffix: '원' },
  거리: { min: 1, max: 30, unit: 0.1, suffix: 'km' },
} as const
export type RealisticKey = keyof typeof REALISTIC

export function g5_inRange(kind: RealisticKey, v: number): boolean {
  const r = REALISTIC[kind]
  return v >= r.min && v <= r.max
}

/** G6 — 개수 세기 문항의 정답은 1~15개. 그 이상은 세다가 시간이 다 간다 */
export function g6_countable(n: number): boolean {
  return Number.isInteger(n) && n >= 1 && n <= 15
}

/** G7 — 한 세트 안에 같은 templateId 2회 초과 금지 */
export const G7_MAX_PER_TEMPLATE = 2

/**
 * G8 — T7 에서는 G1 을 역으로 적용한다.
 * "세 방법의 결과가 같아지는 수" 를 다루므로 어림 자리 아래가 전부 0 인 수가 후보에 있어야 한다.
 */
export function g8_allBelowZero(n: number, place: number): boolean {
  return digitsBelow(n, place).allZero
}

/* ── 표기 도우미 ────────────────────────────────────────── */

/** 1234.5 → '1234.5', 2700 → '2700'. 자릿점(,)은 쓰지 않는다 — 교과서 표기와 맞춘다 */
export function fmt(n: number): string {
  return String(fix(n))
}

/** 소수 자리수 */
export function decimals(n: number): number {
  const s = String(fix(n))
  const i = s.indexOf('.')
  return i < 0 ? 0 : s.length - i - 1
}

export const PLACE_LABEL: Record<PlaceName, string> = {
  십: '십의 자리',
  백: '백의 자리',
  천: '천의 자리',
  '소수 첫째': '소수 첫째 자리',
  '소수 둘째': '소수 둘째 자리',
}
