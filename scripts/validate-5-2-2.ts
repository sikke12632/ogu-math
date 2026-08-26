/**
 * 2단원 「분수의 곱셈」 자동 검사. `npm run check:2`
 *
 * 자동 검사는 **"형식이 맞나"** 와 **"답이 맞나"** 를 본다.
 * "문제가 말이 되나" 는 사람이 봐야 한다 (`npm run dump` → STEP 4).
 *
 * ── 독립 검산이 이 파일의 핵심이다 ────────────────────
 * 생성기가 쓴 계산기를 그대로 다시 부르면 같이 틀린다.
 * 그래서 여기서는 **발문에 적힌 식을 다시 읽어** 소수로도 계산하고
 * 정수로도 계산해 셋이 일치하는지 본다.
 * 1단원이 "정답을 두 방법으로 계산해 대조" 한 것과 같은 자리다.
 */

import { makeRng } from '../src/lib/rng'
import { generateSet, isSane, TEMPLATES } from '../src/units/5-2-2'
import type { Difficulty, Problem } from '../src/units/_types'

let failures = 0
const fail = (msg: string): void => {
  failures++
  if (failures <= 25) console.log(`  ✗ ${msg}`)
}

/* ── 발문에서 식을 다시 읽어 독립으로 계산한다 ──────── */

type Q = { n: number; d: number }

/** `[1_2/3]` `[3/4]` `7` 을 분수로 읽는다. frac.ts 를 쓰지 않는다 */
function readTerm(s: string): Q | null {
  const mixed = /^\[(\d+)_(\d+)\/(\d+)\]$/.exec(s)
  if (mixed) {
    const w = Number(mixed[1]), n = Number(mixed[2]), d = Number(mixed[3])
    if (d <= 0 || n <= 0 || n >= d) return null
    return { n: w * d + n, d }
  }
  const frac = /^\[(\d+)\/(\d+)\]$/.exec(s)
  if (frac) {
    const n = Number(frac[1]), d = Number(frac[2])
    if (d <= 0 || n <= 0) return null
    return { n, d }
  }
  if (/^\d+$/.test(s)) return { n: Number(s), d: 1 }
  return null
}

/** 곱셈식 `A × B [× C]` 를 읽어 곱한다 */
function readProduct(expr: string): Q | null {
  const parts = expr.trim().split('×').map((p) => p.trim())
  if (parts.length < 2) return null
  let acc: Q = { n: 1, d: 1 }
  for (const p of parts) {
    const t = readTerm(p)
    if (!t) return null
    acc = { n: acc.n * t.n, d: acc.d * t.d }
  }
  return acc
}

const asDecimal = (q: Q): number => q.n / q.d

/** 표시된 답(`[2_1/4]` 등)을 값으로 */
function readAnswerValue(s: string): number | null {
  const t = readTerm(s)
  return t ? asDecimal(t) : null
}

/**
 * 계산 문항(T1~T6)의 답이 맞는지 독립으로 확인한다.
 * 발문이 `<식> 을 계산해 보세요.` 꼴일 때만 본다.
 */
function checkCalcAnswer(p: Problem): void {
  const m = /^(.+?) 을 계산해 보세요\.$/.exec(p.prompt)
  if (!m) return
  const lhs = readProduct(m[1]!)
  if (!lhs) {
    fail(`${p.templateId} 식을 다시 읽지 못함: "${m[1]}"`)
    return
  }
  const ans = readAnswerValue(String(p.answer))
  if (ans === null) {
    fail(`${p.templateId} 답을 읽지 못함: "${p.answer}"`)
    return
  }
  if (Math.abs(asDecimal(lhs) - ans) > 1e-9) {
    fail(`${p.templateId} 답이 다름: ${m[1]} → 정답표기 ${p.answer} (다시 계산하면 ${asDecimal(lhs).toFixed(6)})`)
  }
}

/** 검산용 최대공약수. frac.ts 를 안 쓰는 게 이 파일의 요점이라 여기서 다시 적는다 */
function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

/** 분수 표기가 성한지 — 분모 0, 분자 0, 가분수 표기가 새어 나오면 안 된다 */
function checkFractionText(p: Problem): void {
  const texts = [p.prompt, p.explanation, ...(p.choices ?? []), String(p.answer)]
  for (const t of texts) {
    for (const m of t.matchAll(/\[(?:(\d+)_)?(\d+)\/(\d+)\]/g)) {
      const n = Number(m[2]), d = Number(m[3])
      if (d === 0) fail(`분모가 0: "${m[0]}"`)
      if (n === 0) fail(`분자가 0: "${m[0]}"`)
      /*
       * T15 만 가분수를 일부러 쓴다. 1보다 큰 수를 대분수로 적으면
       * 모양만 보고 답이 찍히기 때문이다 (hard.ts 의 judgeSize 주석).
       * 나머지 자리에 가분수가 새어 나오는 것은 여전히 잘못이다.
       */
      if (n >= d && p.templateId !== 'T15') {
        fail(`진분수 자리에 가분수가 들어감: "${m[0]}" (${p.templateId})`)
      }
      if (n >= d && gcd(n, d) !== 1) fail(`약분이 안 된 가분수: "${m[0]}" (${p.templateId})`)
      // 48 — 익힘책에 [3/28], [1/42] 가 나온다. 그보다 크면 약분이 두 번 겹친다
      if (d > 48) fail(`분모가 너무 큼: "${m[0]}" (${p.templateId})`)
    }
    // 표시를 안 감싼 채 새어 나온 분수 — 화면에 3/4 로 그냥 보인다
    if (/(?<!\[)\b\d+\/\d+\b(?!\])/.test(t.replace(/\[[^\]]*\]/g, ''))) {
      fail(`분수 표시를 안 감쌈: "${t.slice(0, 50)}" (${p.templateId})`)
    }
  }
}

/* ── 1. 템플릿별로 많이 뽑아 본다 ───────────────────── */

console.log('유형별 생성 (각 600회)')
for (const t of TEMPLATES) {
  let made = 0
  let tried = 0
  const forms = new Map<string, number>()
  for (let i = 0; i < 600; i++) {
    const level = t.supports[i % t.supports.length]!
    const rng = makeRng(`v2|${t.id}|${i}`)
    tried++
    let d = null
    try {
      d = t.generate(rng, level)
    } catch (e) {
      fail(`${t.id} 생성 중 오류: ${e instanceof Error ? e.message : String(e)}`)
      continue
    }
    if (!d) continue
    if (!isSane(d)) {
      fail(`${t.id} 형식 불량: "${d.prompt.slice(0, 40)}"`)
      continue
    }
    made++
    forms.set(d.params['form'] ?? d.params['kind'] ?? '-', (forms.get(d.params['form'] ?? d.params['kind'] ?? '-') ?? 0) + 1)
    const p: Problem = { ...d, id: 'x', points: 1 }
    checkCalcAnswer(p)
    checkFractionText(p)
  }
  const rate = ((made / tried) * 100).toFixed(0)
  const mix = [...forms.entries()].map(([k, v]) => `${k} ${v}`).join(' · ')
  console.log(`  ${t.id.padEnd(4)} ${t.name.padEnd(22)} 성공 ${rate}%  ${mix}`)
  if (made < 120) fail(`${t.id}: 600번 중 ${made}번만 만들어졌습니다. 가드가 너무 빡빡합니다`)
}

/* ── 2. 세트로 뽑아 본다 ────────────────────────────── */

console.log('\n세트 생성 (400회 · 9문항)')
const counts = { easy: 3, mid: 4, hard: 2 }
let setFail = 0
let dupPrompt = 0
const famCount: Record<string, number> = {}
const tplCount: Record<string, number> = {}

for (let i = 0; i < 400; i++) {
  try {
    const set = generateSet(`s${i}`, { unit: '5-2-2', counts })
    if (set.length !== 9) { fail(`set${i}: ${set.length}문항`); setFail++; continue }

    const levels = set.map((p) => p.difficulty)
    const want: Difficulty[] = [1, 1, 1, 2, 2, 2, 2, 3, 3]
    if (levels.slice().sort().join() !== want.slice().sort().join()) {
      fail(`set${i}: 난이도 분포가 다름 ${levels.join(',')}`)
    }
    const prompts = set.map((p) => p.prompt)
    if (new Set(prompts).size !== prompts.length) dupPrompt++

    for (const p of set) {
      checkCalcAnswer(p)
      checkFractionText(p)
      tplCount[p.templateId] = (tplCount[p.templateId] ?? 0) + 1
      const f = TEMPLATES.find((t) => t.id === p.templateId)!.family
      famCount[f] = (famCount[f] ?? 0) + 1
    }
    // 한 유형이 세트의 절반을 넘으면 지겹다
    const per: Record<string, number> = {}
    for (const p of set) per[p.templateId] = (per[p.templateId] ?? 0) + 1
    const worst = Math.max(...Object.values(per))
    if (worst > 4) fail(`set${i}: 한 유형이 ${worst}번 나옴`)
  } catch (e) {
    fail(`set${i}: ${e instanceof Error ? e.message : String(e)}`)
    setFail++
  }
}

console.log(`  실패 ${setFail}건 · 발문 중복이 있는 세트 ${dupPrompt}건`)
const famTotal = Object.values(famCount).reduce((a, b) => a + b, 0)
console.log(
  '  계열 비율  ' +
    Object.entries(famCount)
      .map(([k, v]) => `${k} ${((v / famTotal) * 100).toFixed(0)}%`)
      .join(' · '),
)
console.log(
  '  유형 분포  ' +
    TEMPLATES.map((t) => `${t.id} ${tplCount[t.id] ?? 0}`).join(' · '),
)
if (dupPrompt > 0) fail(`발문이 겹치는 세트가 ${dupPrompt}건 있습니다`)
for (const t of TEMPLATES) {
  if ((tplCount[t.id] ?? 0) === 0) fail(`${t.id} 이 한 번도 안 나왔습니다`)
}

/* ── 3. 출제 범위를 하나만 골라도 되는지 ────────────── */

console.log('\n출제 범위 하나만 고르기')
for (const t of TEMPLATES) {
  const lv = t.supports
  const counts2 = {
    easy: lv.includes(1) ? 2 : 0,
    mid: lv.includes(2) ? 2 : 0,
    hard: lv.includes(3) ? 2 : 0,
  }
  try {
    const set = generateSet(`only-${t.id}`, { unit: '5-2-2', counts: counts2, templateIds: [t.id] })
    if (set.some((p) => p.templateId !== t.id)) fail(`${t.id} 만 골랐는데 다른 유형이 섞임`)
    console.log(`  ${t.id.padEnd(4)} ${set.length}문항 OK`)
  } catch (e) {
    fail(`${t.id} 만 골랐을 때: ${e instanceof Error ? e.message : String(e)}`)
  }
}

console.log(
  failures === 0
    ? '\n통과. 2단원 형식·정답·표기에 문제 없습니다.'
    : `\n실패 ${failures}건`,
)
if (failures > 0) process.exitCode = 1
