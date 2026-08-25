/**
 * 분수 계산과 표기. **Firebase 도 React 도 모른다.**
 * 단독으로 실행해서 값이 맞는지 확인할 수 있어야 문항 검수가 된다.
 *
 * 여기서 정하는 두 가지가 2단원 전체를 좌우한다.
 *
 * 1. **분수를 어떻게 글자로 쓸까** — 발문 안에 `[3/4]`, `[1_2/3]` 로 넣는다.
 *    화면이 그것만 세로 분수로 바꿔 그린다 (`components/MathText.tsx`).
 *    생성기는 글자만 다루면 되고, 그리는 일은 화면이 맡는다.
 *
 * 2. **흔한 오류를 흉내내는 계산** — 오답 보기를 아무 수로 만들면 소거법으로 풀린다.
 *    아이들이 실제로 하는 실수에서 뽑아야 틀린 아이가 자기 실수를 알아본다.
 *    (`docs/2단원_유형분석.md` 발견 5)
 */

/** 분자/분모. 항상 기약분수로 들고 다닌다 */
export type Frac = { n: number; d: number }

export function gcd(a: number, b: number): number {
  a = Math.abs(a)
  b = Math.abs(b)
  while (b) {
    const t = a % b
    a = b
    b = t
  }
  return a || 1
}

/** 약분. 분모가 1이면 자연수다 */
export function reduce(f: Frac): Frac {
  const g = gcd(f.n, f.d)
  return { n: f.n / g, d: f.d / g }
}

export const mul = (a: Frac, b: Frac): Frac => reduce({ n: a.n * b.n, d: a.d * b.d })

/** 대분수 → 가분수. whole 이 0이면 진분수 그대로 */
export const improper = (whole: number, n: number, d: number): Frac => ({ n: whole * d + n, d })

export const isWhole = (f: Frac): boolean => f.d === 1
export const value = (f: Frac): number => f.n / f.d

/** 자연수를 분수로 */
export const whole = (n: number): Frac => ({ n, d: 1 })

/* ── 글자로 쓰기 ────────────────────────────────────── */

/**
 * 화면에 그릴 표시로 바꾼다.
 *   자연수  → `3`
 *   진분수  → `[3/4]`
 *   가분수  → 대분수로 바꿔 `[1_2/3]`
 *
 * **가분수를 그대로 두지 않는다.** 교과서가 답을 대분수로 쓰기 때문이다.
 * `9/4` 를 답으로 내면 아이가 맞게 풀고도 틀렸다고 느낀다.
 */
export function show(f0: Frac): string {
  const f = reduce(f0)
  if (f.d === 1) return String(f.n)
  if (f.n < f.d) return `[${f.n}/${f.d}]`
  const w = Math.floor(f.n / f.d)
  const r = f.n - w * f.d
  return r === 0 ? String(w) : `[${w}_${r}/${f.d}]`
}

/** 곱셈식을 글자로. `[3/4] × 6` 처럼 */
export const showMul = (a: string, b: string): string => `${a} × ${b}`

/** 대분수를 표시로 (계산 안 하고 그대로 보여 줄 때) */
export const showMixed = (w: number, n: number, d: number): string =>
  w === 0 ? `[${n}/${d}]` : `[${w}_${n}/${d}]`

/* ── 흔한 오류 (오답 보기의 재료) ────────────────────── */

/**
 * 아이들이 실제로 하는 실수. `docs/2단원_유형분석.md` 발견 5 에서 뽑았다.
 * **오답 보기는 여기서만 만든다.** 아무 수나 넣으면 소거법으로 풀린다.
 */
export type Slip = {
  /** 검수 화면에 뭐라고 적을지 */
  why: string
  wrong: Frac
}

/** (진분수)×(자연수) 에서 분모에도 곱하는 실수 — 5/7 × 6 = 30/42 */
export function slipMulDen(f: Frac, k: number): Slip | null {
  const w = reduce({ n: f.n * k, d: f.d * k })
  return { why: '분모에도 곱함', wrong: w }
}

/** 대분수의 자연수만 곱하는 실수 — 2와 1/3 × 2 = 4와 1/3 */
export function slipWholeOnly(w: number, n: number, d: number, k: number): Slip | null {
  if (w === 0) return null
  return { why: '자연수만 곱하고 분수는 그대로 둠', wrong: reduce({ n: (w * k) * d + n, d }) }
}

/** 대분수를 가분수로 안 바꾸고 분자만 곱하는 실수 */
export function slipNumOnly(w: number, n: number, d: number, k: number): Slip | null {
  if (w === 0) return null
  return { why: '가분수로 안 바꾸고 분자만 곱함', wrong: reduce({ n: w * d + n * k, d }) }
}

/** 분수끼리 곱할 때 분자는 분자끼리, 분모는 **더하는** 실수 */
export function slipAddDen(a: Frac, b: Frac): Slip | null {
  if (a.d === b.d) return null
  return { why: '분모를 더함', wrong: reduce({ n: a.n * b.n, d: a.d + b.d }) }
}

/** 곱셈인데 더해 버리는 실수 */
export function slipAdd(a: Frac, b: Frac): Slip | null {
  return { why: '곱하지 않고 더함', wrong: reduce({ n: a.n * b.d + b.n * a.d, d: a.d * b.d }) }
}

/** 두 분수를 뒤집어 곱하는 실수 (나눗셈과 헷갈림) */
export function slipFlip(a: Frac, b: Frac): Slip | null {
  if (b.n === b.d) return null
  return { why: '뒤집어 곱함 (나눗셈과 헷갈림)', wrong: reduce({ n: a.n * b.d, d: a.d * b.n }) }
}

/**
 * 오답 보기 세 개를 고른다.
 *
 * - 정답과 같은 값, 서로 같은 값은 버린다 (보기 중복 금지)
 * - 0 이하이거나 터무니없이 큰 값도 버린다
 * - 모자라면 정답을 조금 흔들어 채운다. **그래도 흔한 오류를 먼저 쓴다**
 */
export function distractors(answer: Frac, slips: (Slip | null)[], rnd: () => number): Frac[] {
  const out: Frac[] = []
  const seen = new Set<string>([`${answer.n}/${answer.d}`])
  const add = (f: Frac): void => {
    const r = reduce(f)
    const key = `${r.n}/${r.d}`
    if (seen.has(key)) return
    if (r.n <= 0 || value(r) > value(answer) * 12 + 20) return
    seen.add(key)
    out.push(r)
  }

  for (const s of slips) {
    if (out.length >= 3) break
    if (s) add(s.wrong)
  }

  // 모자라면 흔들어 채운다. 분자만 살짝 바꾸는 게 제일 그럴듯하다
  let guard = 0
  while (out.length < 3 && guard++ < 60) {
    const k = 1 + Math.floor(rnd() * 3)
    add(rnd() < 0.5 ? { n: answer.n + k, d: answer.d } : { n: answer.n, d: answer.d + k })
  }
  return out.slice(0, 3)
}
