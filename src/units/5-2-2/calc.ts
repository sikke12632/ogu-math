/**
 * 계산 여섯 유형 — T1~T6.
 *
 * 익힘책이 차시를 이렇게 자른다 (`docs/2단원_유형분석.md` 발견 1).
 * 곱하는 순서가 바뀌면 계산 방법 설명이 달라지므로 **아이들에게는 다른 유형이다.**
 *   (진분수)×(자연수)는 "분모는 그대로, 분자와 자연수를 곱한다"
 *   (자연수)×(진분수)는 "분모는 그대로, 자연수와 분자를 곱한다"
 *
 * 여섯이 하는 일은 거의 같아서 한 틀로 만든다. 유형마다 다른 것은
 * **어떤 수를 뽑는가**와 **어떻게 설명하는가** 둘뿐이다.
 *
 * ── 왜 전부 선택형인가 ────────────────────────────────
 * 답이 분수면 단답형을 쓸 수 없다. 크롬북에서 "4와 2/7" 을 어떻게 치겠는가.
 * 아이가 맞게 풀고도 표기 때문에 틀리는 일이 생긴다.
 * **답이 자연수인 문항만** 단답형으로 낸다.
 */

import type { Rng } from '../../lib/rng'
import type { Difficulty, Draft, Template } from '../_types'
import {
  distractors, improper, josaAfter, mul, show, showMixed, slipAdd, slipAddDen, slipFlip,
  slipMulDen, slipNumOnly, slipWholeOnly, value, type Frac, type Slip,
} from './frac'

export const STANDARD = '6수01-09'

/* ── 수 뽑기 (가드 G1·G2) ──────────────────────────── */

/** G1 — 분모는 12 이하. 5학년이 암산으로 검산할 수 있어야 한다 */
const DENS = [2, 3, 4, 5, 6, 7, 8, 9, 10, 12] as const

/** 진분수 하나. 분자는 분모보다 작다 */
function properFrac(rng: Rng): Frac {
  const d = rng.pick(DENS)
  return { n: rng.int(1, d - 1), d }
}

/** 단위분수 (분자가 1). 익힘책이 (단위분수)×(단위분수) 를 따로 다룬다 */
function unitFrac(rng: Rng): Frac {
  return { n: 1, d: rng.pick(DENS) }
}

/** G2 — 대분수의 자연수 부분은 1~4. 커지면 계산만 길어지고 개념과 무관해진다 */
function mixedParts(rng: Rng): { w: number; n: number; d: number } {
  const d = rng.pick(DENS)
  return { w: rng.int(1, 4), n: rng.int(1, d - 1), d }
}

/* ── 가드 ───────────────────────────────────────────── */

/**
 * G3·G4 — 답이 5학년이 다룰 만한 크기인가.
 *
 * 분모 한도를 48 로 둔다. 익힘책에 [3/28] 과 [1/42] 가 실제로 나오므로
 * 24 로 막으면 교과서 수준 문항까지 버리게 된다.
 * 다만 60·84 처럼 커지면 약분이 두 번 겹쳐 이 단원 목표를 벗어난다.
 */
function answerOk(f: Frac): boolean {
  if (f.n <= 0) return false
  if (f.d > 48) return false
  if (value(f) > 60) return false
  return true
}

/* ── 문항 만들기 ────────────────────────────────────── */

type Made = {
  /** 화면에 보일 곱셈식 — `[3/4] × 6` */
  expr: string
  answer: Frac
  /** 이 유형에서 아이들이 실제로 하는 실수 (발견 5) */
  slips: (Slip | null)[]
  /** 해설에 쓸 한 줄 */
  how: string
  params: Record<string, string>
}

type Kind = {
  id: string
  name: string
  description: string
  topic: string
  make(rng: Rng): Made | null
}

const KINDS: Kind[] = [
  {
    id: 'T1',
    name: '(진분수) × (자연수)',
    description: "'3분의 2 × 4' 처럼 분수에 자연수를 곱합니다. 분모는 그대로 두고 분자에만 곱합니다.",
    topic: '분수 × 자연수',
    make(rng) {
      const f = properFrac(rng)
      const k = rng.int(2, 9)
      return {
        expr: `${show(f)} × ${k}`,
        answer: mul(f, { n: k, d: 1 }),
        slips: [slipMulDen(f, k), slipAdd(f, { n: k, d: 1 })],
        how: '분모는 그대로 두고, 분자와 자연수를 곱합니다.',
        params: { kind: 'proper-nat', den: String(f.d) },
      }
    },
  },
  {
    id: 'T2',
    name: '(대분수) × (자연수)',
    description: "'1과 3분의 2 × 3' 처럼 대분수에 자연수를 곱합니다. 가분수로 바꿔 계산합니다.",
    topic: '분수 × 자연수',
    make(rng) {
      const m = mixedParts(rng)
      const k = rng.int(2, 6)
      const f = improper(m.w, m.n, m.d)
      return {
        expr: `${showMixed(m.w, m.n, m.d)} × ${k}`,
        answer: mul(f, { n: k, d: 1 }),
        slips: [slipWholeOnly(m.w, m.n, m.d, k), slipNumOnly(m.w, m.n, m.d, k), slipMulDen(f, k)],
        how: '대분수를 가분수로 바꾼 뒤 분자에 자연수를 곱합니다.',
        params: { kind: 'mixed-nat', den: String(m.d) },
      }
    },
  },
  {
    id: 'T3',
    name: '(자연수) × (진분수)',
    description: "'8 × 5분의 3' 처럼 자연수에 분수를 곱합니다. 자연수와 분자를 곱합니다.",
    topic: '자연수 × 분수',
    make(rng) {
      const f = properFrac(rng)
      const k = rng.int(2, 12)
      return {
        expr: `${k} × ${show(f)}`,
        answer: mul({ n: k, d: 1 }, f),
        slips: [slipMulDen(f, k), slipAdd({ n: k, d: 1 }, f)],
        how: '분모는 그대로 두고, 자연수와 분자를 곱합니다.',
        params: { kind: 'nat-proper', den: String(f.d) },
      }
    },
  },
  {
    id: 'T4',
    name: '(자연수) × (대분수)',
    description: "'4 × 1과 6분의 5' 처럼 자연수에 대분수를 곱합니다.",
    topic: '자연수 × 분수',
    make(rng) {
      const m = mixedParts(rng)
      const k = rng.int(2, 8)
      const f = improper(m.w, m.n, m.d)
      return {
        expr: `${k} × ${showMixed(m.w, m.n, m.d)}`,
        answer: mul({ n: k, d: 1 }, f),
        slips: [slipWholeOnly(m.w, m.n, m.d, k), slipNumOnly(m.w, m.n, m.d, k)],
        how: '대분수를 가분수로 바꾼 뒤 자연수와 분자를 곱합니다.',
        params: { kind: 'nat-mixed', den: String(m.d) },
      }
    },
  },
  {
    id: 'T5',
    name: '(진분수) × (진분수)',
    description: "'4분의 3 × 5분의 2' 처럼 분수끼리 곱합니다. 분자는 분자끼리, 분모는 분모끼리.",
    topic: '분수 × 분수',
    make(rng) {
      // 익힘책이 단위분수를 따로 다루므로 절반쯤 섞어 낸다
      const a = rng.bool(0.4) ? unitFrac(rng) : properFrac(rng)
      const b = rng.bool(0.4) ? unitFrac(rng) : properFrac(rng)
      return {
        expr: `${show(a)} × ${show(b)}`,
        answer: mul(a, b),
        slips: [slipAddDen(a, b), slipFlip(a, b), slipAdd(a, b)],
        how: '분자는 분자끼리, 분모는 분모끼리 곱합니다.',
        params: { kind: 'proper-proper', den: `${a.d}x${b.d}` },
      }
    },
  },
  {
    id: 'T6',
    name: '(대분수) × (대분수)',
    description: "'1과 2분의 1 × 1과 3분의 2' 처럼 대분수끼리 곱합니다. 둘 다 가분수로 바꿉니다.",
    topic: '분수 × 분수',
    make(rng) {
      const p = mixedParts(rng)
      const q = mixedParts(rng)
      const a = improper(p.w, p.n, p.d)
      const b = improper(q.w, q.n, q.d)
      return {
        expr: `${showMixed(p.w, p.n, p.d)} × ${showMixed(q.w, q.n, q.d)}`,
        answer: mul(a, b),
        slips: [
          // 자연수는 자연수끼리, 분수는 분수끼리 곱해 버리는 실수
          { why: '자연수끼리·분수끼리 따로 곱함', wrong: mul({ n: p.w, d: 1 }, { n: q.w, d: 1 }) },
          slipAdd(a, b),
          slipAddDen(a, b),
        ],
        how: '두 대분수를 모두 가분수로 바꾼 뒤 분자끼리, 분모끼리 곱합니다.',
        params: { kind: 'mixed-mixed', den: `${p.d}x${q.d}` },
      }
    },
  },
]

/* ── 변주 ───────────────────────────────────────────── */

/** 하 — 계산해서 보기 넷 중 고르기 */
function plain(rng: Rng, k: Kind, m: Made, difficulty: Difficulty): Draft {
  const wrong = distractors(m.answer, m.slips, () => rng.next())
  const choices = rng.shuffle([show(m.answer), ...wrong.map(show)])
  return {
    templateId: k.id,
    params: { ...m.params, form: 'choice' },
    difficulty,
    prompt: `${josaAfter(m.expr, '을를')} 계산해 보세요.`,
    choices,
    answer: show(m.answer),
    explanation: `${m.how}\n${m.expr} = ${show(m.answer)}`,
    standard: STANDARD,
  }
}

/**
 * 중 — 두 식을 견주기. 익힘책의 `>, =, <` 문항이다.
 * **두 값이 같으면 안 낸다** — `=` 만 나오는 세트가 되면 재미가 없다.
 */
function compare(k: Kind, a: Made, b: Made): Draft | null {
  const va = value(a.answer)
  const vb = value(b.answer)
  if (Math.abs(va - vb) < 1e-9) return null
  const sign = va > vb ? '>' : '<'
  return {
    templateId: k.id,
    params: { ...a.params, form: 'compare' },
    difficulty: 2,
    prompt: `두 식을 계산하여 크기를 비교해 보세요.\n${a.expr} □ ${b.expr}`,
    choices: ['>', '=', '<'],
    answer: sign,
    explanation:
      `${a.expr} = ${show(a.answer)}\n${b.expr} = ${show(b.answer)}\n` +
      `그러므로 ${sign} 입니다.`,
    standard: STANDARD,
  }
}

/** 중 — 넷 중 가장 큰(작은) 것 고르기. 계산을 네 번 해야 한다 */
function biggest(rng: Rng, k: Kind, made: Made[], difficulty: Difficulty): Draft | null {
  if (made.length < 4) return null
  const wantBig = rng.bool()
  const vals = made.map((m) => value(m.answer))
  // 1등이 둘이면 답이 유일하지 않다 (G6)
  const best = wantBig ? Math.max(...vals) : Math.min(...vals)
  if (vals.filter((v) => Math.abs(v - best) < 1e-9).length !== 1) return null
  const idx = vals.findIndex((v) => Math.abs(v - best) < 1e-9)
  const choices = made.map((m) => m.expr)
  if (new Set(choices).size !== choices.length) return null
  return {
    templateId: k.id,
    params: { ...made[0]!.params, form: wantBig ? 'largest' : 'smallest' },
    difficulty,
    prompt: `계산 결과가 가장 ${wantBig ? '큰' : '작은'} 것은 어느 것인가요?`,
    choices,
    answer: choices[idx]!,
    explanation:
      made.map((m) => `${m.expr} = ${show(m.answer)}`).join('\n') +
      `\n그러므로 ${choices[idx]} 이(가) 가장 ${wantBig ? '큽니다' : '작습니다'}.`,
    standard: STANDARD,
  }
}

/* ── 템플릿으로 내보내기 ────────────────────────────── */

function makeOk(rng: Rng, k: Kind): Made | null {
  for (let i = 0; i < 40; i++) {
    const m = k.make(rng)
    if (m && answerOk(m.answer)) return m
  }
  return null
}

export const CALC_TEMPLATES: Template[] = KINDS.map((k) => ({
  id: k.id,
  name: k.name,
  description: k.description,
  topic: k.topic,
  supports: [1, 2] as Difficulty[],
  family: '계산',
  generate(rng: Rng, difficulty: Difficulty): Draft | null {
    const m = makeOk(rng, k)
    if (!m) return null
    if (difficulty === 1) return plain(rng, k, m, 1)

    // 중 난이도는 세 가지 중 하나로. 같은 계산만 반복되지 않게 한다
    const pickForm = rng.weighted([
      ['compare', 3],
      ['biggest', 3],
      ['plain', 2],
    ] as const)

    if (pickForm === 'compare') {
      const b = makeOk(rng, k)
      if (b) {
        const d = compare(k, m, b)
        if (d) return d
      }
    }
    if (pickForm === 'biggest') {
      const four: Made[] = [m]
      for (let i = 0; i < 12 && four.length < 4; i++) {
        const x = makeOk(rng, k)
        if (x && !four.some((y) => y.expr === x.expr)) four.push(x)
      }
      const d = biggest(rng, k, four, 2)
      if (d) return d
    }
    return plain(rng, k, m, 2)
  },
}))
