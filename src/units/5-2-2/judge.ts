/**
 * 판단 두 유형 — T9 잘못 계산한 것 찾기, T10 수 카드로 식 만들기.
 * 둘 다 익힘책이 매 차시 마지막에 두는 **추론** 자리다
 * (`docs/2단원_유형분석.md` 발견 5·6).
 */

import type { Rng } from '../../lib/rng'
import type { Difficulty, Draft, Template } from '../_types'
import { gcd, improper, mul, reduce, show, showMixed, value, type Frac } from './frac'
import { STANDARD } from './calc'

/* ── T9 잘못 계산한 것 찾기 ─────────────────────────── */

type Wrong = { expr: string; shown: Frac; right: Frac; why: string }

/**
 * 보기 넷 중 **하나만 틀리게** 만든다.
 * 틀린 것은 반드시 아이들이 실제로 하는 실수여야 한다 (발견 5).
 * 아무 수나 어긋나게 하면 "숫자가 이상한 것" 을 찾는 문제가 되어 버린다.
 */
function makeItem(rng: Rng, makeWrong: boolean): Wrong | null {
  const style = rng.pick(['proper-nat', 'mixed-nat', 'proper-proper'] as const)

  if (style === 'proper-nat') {
    const d = rng.pick([3, 4, 5, 6, 7, 8, 9] as const)
    const f = { n: rng.int(1, d - 1), d }
    const k = rng.int(2, 8)
    const right = mul(f, { n: k, d: 1 })
    if (!makeWrong) return { expr: `${show(f)} × ${k}`, shown: right, right, why: '' }
    // 분모에도 곱하는 실수
    const bad = reduce({ n: f.n * k, d: f.d * k })
    if (value(bad) === value(right)) return null
    return { expr: `${show(f)} × ${k}`, shown: bad, right, why: '분모에는 곱하지 않습니다. 분자에만 곱합니다.' }
  }

  if (style === 'mixed-nat') {
    const d = rng.pick([2, 3, 4, 5, 6] as const)
    const w = rng.int(1, 3)
    const n = rng.int(1, d - 1)
    const k = rng.int(2, 5)
    const right = mul(improper(w, n, d), { n: k, d: 1 })
    const expr = `${showMixed(w, n, d)} × ${k}`
    if (!makeWrong) return { expr, shown: right, right, why: '' }
    // 자연수만 곱하고 분수는 그대로 두는 실수
    const bad = reduce({ n: w * k * d + n, d })
    if (value(bad) === value(right)) return null
    return { expr, shown: bad, right, why: '자연수만 곱하면 안 됩니다. 대분수를 가분수로 바꿔 계산합니다.' }
  }

  const da = rng.pick([2, 3, 4, 5, 6] as const)
  const db = rng.pick([2, 3, 4, 5, 7] as const)
  const a = { n: rng.int(1, da - 1), d: da }
  const b = { n: rng.int(1, db - 1), d: db }
  const right = mul(a, b)
  const expr = `${show(a)} × ${show(b)}`
  if (!makeWrong) return { expr, shown: right, right, why: '' }
  // 분모를 더해 버리는 실수
  if (a.d === b.d) return null
  const bad = reduce({ n: a.n * b.n, d: a.d + b.d })
  if (value(bad) === value(right)) return null
  return { expr, shown: bad, right, why: '분모도 곱해야 합니다. 더하면 안 됩니다.' }
}

function findWrong(rng: Rng): Draft | null {
  const bad = makeItem(rng, true)
  if (!bad) return null
  const good: Wrong[] = []
  const seen = new Set<string>([bad.expr])
  for (let i = 0; i < 40 && good.length < 3; i++) {
    const g = makeItem(rng, false)
    if (!g || seen.has(g.expr)) continue
    seen.add(g.expr)
    good.push(g)
  }
  if (good.length < 3) return null

  const items = rng.shuffle([bad, ...good])
  const lines = items.map((it) => `${it.expr} = ${show(it.shown)}`)
  if (new Set(lines).size !== lines.length) return null

  return {
    templateId: 'T9',
    params: { kind: 'find-wrong' },
    difficulty: 3,
    prompt: '계산이 잘못된 것은 어느 것인가요?',
    choices: lines,
    answer: `${bad.expr} = ${show(bad.shown)}`,
    explanation:
      `${bad.expr} 의 바른 답은 ${show(bad.right)} 입니다.\n${bad.why}`,
    standard: STANDARD,
  }
}

export const T9: Template = {
  id: 'T9',
  name: '잘못 계산한 것 찾기',
  description: '네 개의 계산 중 틀린 것을 찾습니다. 틀린 것은 아이들이 실제로 하는 실수로 만듭니다.',
  topic: '활용과 판단',
  supports: [3],
  family: '활용',
  generate: (rng) => findWrong(rng),
}

/* ── T10 수 카드로 식 만들기 ────────────────────────── */

/**
 * 카드 몇 장으로 만들 수 있는 식을 **전부 계산해** 가장 큰(작은) 것을 찾는다.
 * G9 — **답이 하나일 때만 낸다.** 최댓값이 둘이면 카드를 다시 뽑는다.
 */
function cards(rng: Rng, difficulty: Difficulty): Draft | null {
  const pool = rng.shuffle([2, 3, 4, 5, 6, 7, 8, 9] as const).slice(0, 4)
  const wantBig = rng.bool()
  const mode = rng.pick(['mixed-nat', 'unit-unit'] as const)

  type Cand = { expr: string; v: Frac }
  const cand: Cand[] = []

  if (mode === 'mixed-nat') {
    // 카드 4장 중 3장으로 (대분수) × (자연수). 분자 < 분모 여야 대분수다
    for (const w of pool) {
      for (const n of pool) {
        for (const d of pool) {
          if (w === n || n === d || w === d) continue
          if (n >= d) continue
          /*
           * **약분되면 안 된다.** showMixed 는 분수 부분을 약분해서 그리므로
           * 카드 6·8 로 만든 `5와 6/8` 이 화면에는 `5와 3/4` 로 나온다.
           * 그러면 "카드를 한 번씩만 썼다" 는 말과 식이 어긋나서,
           * 카드에 없는 3 이 식에 들어가 있는 문제가 되어 버린다.
           */
          if (gcd(n, d) !== 1) continue
          const rest = pool.filter((x) => x !== w && x !== n && x !== d)
          for (const k of rest) {
            cand.push({
              expr: `${showMixed(w, n, d)} × ${k}`,
              v: mul(improper(w, n, d), { n: k, d: 1 }),
            })
          }
        }
      }
    }
  } else {
    // 카드 4장 중 2장으로 (단위분수) × (단위분수)
    for (const a of pool) {
      for (const b of pool) {
        if (a === b) continue
        cand.push({ expr: `[1/${a}] × [1/${b}]`, v: mul({ n: 1, d: a }, { n: 1, d: b }) })
      }
    }
  }

  if (cand.length < 4) return null
  const vals = cand.map((c) => value(c.v))
  const best = wantBig ? Math.max(...vals) : Math.min(...vals)
  // 값이 같은 식이 여럿이면 답이 유일하지 않다 → 버린다
  const bestIdx = vals
    .map((v, i) => ({ v, i }))
    .filter((x) => Math.abs(x.v - best) < 1e-9)
    .map((x) => x.i)
  // 식은 달라도 값이 같으면 '가장 큰 것' 이 둘이 된다
  if (bestIdx.length !== 1) return null
  const win = cand[bestIdx[0]!]!

  // 보기 — 정답 하나와 값이 다른 셋
  const others: Cand[] = []
  const seenV = new Set<number>([best])
  for (const c of rng.shuffle(cand)) {
    if (others.length >= 3) break
    const v = value(c.v)
    if (seenV.has(v)) continue
    seenV.add(v)
    others.push(c)
  }
  if (others.length < 3) return null

  const choices = rng.shuffle([win.expr, ...others.map((c) => c.expr)])
  if (new Set(choices).size !== 4) return null

  return {
    templateId: 'T10',
    params: { kind: 'cards', mode, want: wantBig ? 'big' : 'small' },
    difficulty,
    prompt:
      `수 카드 ${pool.join(', ')} 중에서 몇 장을 한 번씩만 써서 곱셈식을 만들었습니다.\n` +
      `계산 결과가 가장 ${wantBig ? '큰' : '작은'} 것은 어느 것인가요?`,
    choices,
    answer: win.expr,
    explanation:
      choices.map((e) => {
        const c = cand.find((x) => x.expr === e)!
        return `${e} = ${show(c.v)}`
      }).join('\n') +
      `\n그러므로 ${win.expr} 이(가) 가장 ${wantBig ? '큽니다' : '작습니다'}.`,
    standard: STANDARD,
  }
}

export const T10: Template = {
  id: 'T10',
  name: '수 카드로 식 만들기',
  description: '수 카드로 만든 곱셈식 중 결과가 가장 큰(작은) 것을 찾습니다. 여러 번 계산해야 합니다.',
  topic: '활용과 판단',
  supports: [3],
  family: '활용',
  generate: (rng, d) => cards(rng, d),
}
