/**
 * 자동 검사. `npm run check`
 *
 * 템플릿마다 1000회 생성해서 아래를 본다.
 *   1. 가드 위반 (G1 / G3 / G6 / G8)
 *   2. 정답 유일성 — 보기 중 정답 조건을 만족하는 게 정확히 하나인가
 *   3. 보기 값 중복
 *   4. 문장에 undefined · NaN · 빈칸이 없는가
 *   5. 정답 위치가 특정 번호에 쏠리지 않는가
 *   6. 세트 조립 — 문항 수, G7, 성취기준 균형, 재현성
 *
 * 자동 검사는 "형식이 맞는가"를 볼 뿐 "문제가 말이 되는가"는 못 본다.
 * 그건 npm run dump 로 뽑아 사람이 봐야 한다 (STEP 4).
 */

import { makeRng } from '../src/lib/rng'
import { digitsBelow, estimate, G7_MAX_PER_TEMPLATE, type Method } from '../src/units/_guards'
import { generateSet, isSane, TEMPLATES } from '../src/units/5-2-1'
import type { Difficulty, Draft } from '../src/units/_types'

const ROUNDS = 1000

type Fail = { template: string; difficulty: number; why: string; sample: string }

const fails: Fail[] = []
let generated = 0
let rejected = 0
let g8Present = 0
let g8Total = 0

const METHODS_BY_PAIR: Record<string, Method[]> = {
  '올림↔반올림': ['올림', '반올림'],
  '버림↔반올림': ['버림', '반올림'],
  '세 방법 전부': ['올림', '버림', '반올림'],
}

function note(t: string, d: number, why: string, draft: Draft | null) {
  fails.push({
    template: t,
    difficulty: d,
    why,
    sample: draft ? `${draft.prompt} | 보기=${(draft.choices ?? []).join(' / ')} | 정답=${draft.answer}` : '(생성 실패)',
  })
}

/* ── 문항 단위 검사 ─────────────────────────────────── */

function checkDraft(t: string, d: Difficulty, draft: Draft): void {
  // 4. 문장 위생
  if (!isSane(draft)) {
    note(t, d, '문장에 빈칸·undefined·NaN 이 있거나 보기/정답이 어긋납니다', draft)
    return
  }

  // 3. 보기 중복 (isSane 에서도 보지만 메시지를 나눠 둔다)
  if (draft.choices && new Set(draft.choices).size !== draft.choices.length) {
    note(t, d, 'G4 위반: 보기 값이 겹칩니다', draft)
  }

  // 2. 정답 유일성 — 단일 정답 문항인데 같은 값이 보기에 두 번 있으면 안 된다
  if (draft.choices && !Array.isArray(draft.answer)) {
    const hits = draft.choices.filter((c) => c === draft.answer).length
    if (hits !== 1) note(t, d, `정답이 보기에 ${hits}개 있습니다 (정확히 1개여야 함)`, draft)
  }
  if (Array.isArray(draft.answer)) {
    if (draft.answer.length < 1) note(t, d, '모두 고르기인데 정답이 없습니다', draft)
    if (draft.choices && draft.answer.length === draft.choices.length) {
      note(t, d, '모두 고르기인데 보기 전부가 정답입니다', draft)
    }
  }

  // 해설 필수
  if (draft.explanation.trim().length < 10) note(t, d, '해설이 너무 짧습니다', draft)

  // 발문 2줄 이내
  if (draft.prompt.split('\n').length > 2) note(t, d, '발문이 3줄 이상입니다', draft)

  // 수직선 — 경계점이 눈금 위에 정확히 놓여야 한다 (docs/수직선_렌더러_검증.html 의 검수 기준)
  for (const v of [draft.visual, ...(draft.choiceVisuals ?? [])]) {
    if (!v || v.kind !== 'numberline') continue
    const s = v.spec
    const ticks: number[] = []
    for (let x = s.min; x <= s.max + 1e-9; x += s.step) ticks.push(Math.round(x * 1e6) / 1e6)
    if (ticks.length > 11) note(t, d, `눈금이 ${ticks.length}개입니다 (11개 이하여야 함)`, draft)
    for (const m of s.marks) {
      if (!ticks.includes(Math.round(m.at * 1e6) / 1e6)) {
        note(t, d, `수직선 점 ${m.at} 이 눈금(${s.min}~${s.max}, ${s.step}씩) 위에 없습니다`, draft)
      }
      if (m.at < s.min || m.at > s.max) note(t, d, `수직선 점 ${m.at} 이 축 밖에 있습니다`, draft)
    }
  }
  // 보기가 그림이면 그림이 서로 달라야 한다
  if (draft.choiceVisuals) {
    const keys = draft.choiceVisuals.map((v) => JSON.stringify(v))
    if (new Set(keys).size !== keys.length) note(t, d, '보기 그림이 서로 겹칩니다', draft)
  }

  // 1. 가드
  const place = placeOf(draft)
  if (place !== null) {
    const n = subjectNumber(draft)
    if (n !== null) {
      if (t !== 'T7' && !(digitsBelow(n, place).first !== 0)) {
        note(t, d, `G1 위반: ${n} 의 ${place} 자리 아래 첫 자리가 0`, draft)
      }
    }
  }
  if (t === 'T3' && !draft.choices) {
    const v = Number(draft.answer)
    if (!Number.isInteger(v) || v < 1 || v > 15) {
      // 역산 문항은 개수가 아니라 경곗값이 답이므로 제외한다
      if (draft.params['extra'] !== '역산') note(t, d, `G6 위반: 개수 정답이 ${v}`, draft)
    }
  }
  if (t === 'T7') {
    // G8 — 어림 자리 아래가 전부 0 인 수가 보기에 있어야 한다.
    // 단 '두 방법 + 같은 것 고르기' 는 예외다. 그 수를 넣으면 정답이 둘이 된다 (t7.ts 머리말 참고)
    const p = PLACE_BY_NAME[draft.params['place'] ?? '']
    const exempt = draft.params['format'] === '같은 것' && draft.params['pair'] !== '세 방법 전부'
    if (p && draft.choices) {
      const has = draft.choices.some((c) => Number.isFinite(Number(c)) && digitsBelow(Number(c), p).allZero)
      if (has) g8Present++
      else if (!exempt) note(t, d, 'G8 위반: 아래가 모두 0 인 수가 보기에 없습니다', draft)
      g8Total++
    }

    // 정답 유일성 — 보기 중 조건을 만족하는 것이 정확히 하나여야 한다.
    // 이건 T7 의 존재 이유라 값으로 직접 확인한다
    if (p && draft.choices) {
      const wantSame = draft.params['format'] === '같은 것'
      const ms = METHODS_BY_PAIR[draft.params['pair'] ?? ''] ?? []
      const hits = draft.choices.filter((c) => {
        const n = Number(c)
        const vs = ms.map((m) => estimate(n, p, m))
        const allEqual = vs.every((v) => v === vs[0])
        return wantSame ? allEqual : !allEqual
      })
      if (hits.length !== 1) note(t, d, `조건을 만족하는 보기가 ${hits.length}개입니다 (정확히 1개여야 함)`, draft)
      if (hits[0] !== draft.answer) note(t, d, `조건을 만족하는 보기(${hits[0]})와 정답(${draft.answer})이 다릅니다`, draft)
    }
  }
}

const PLACE_BY_NAME: Record<string, number | undefined> = {
  십: 10, 백: 100, 천: 1000, '소수 첫째': 0.1, '소수 둘째': 0.01,
}

function placeOf(draft: Draft): number | null {
  if (draft.templateId !== 'T4') return null
  return PLACE_BY_NAME[draft.params['place'] ?? ''] ?? null
}

/** T4 발문에서 어림 대상 수를 뽑아낸다 */
function subjectNumber(draft: Draft): number | null {
  const m = draft.prompt.match(/^([\d.]+)/)
  return m ? Number(m[1]) : null
}

/* ── 실행 ───────────────────────────────────────────── */

console.log(`템플릿 ${TEMPLATES.length}개 × 난이도별 ${ROUNDS}회 생성 검사\n`)

const posCount: Record<string, number[]> = {}

for (const t of TEMPLATES) {
  for (const d of t.supports) {
    let made = 0
    for (let i = 0; i < ROUNDS; i++) {
      const rng = makeRng(`check|${t.id}|${d}|${i}`)
      let draft: Draft | null = null
      try {
        draft = t.generate(rng, d)
      } catch (e) {
        note(t.id, d, `예외: ${e instanceof Error ? e.message : String(e)}`, null)
        continue
      }
      generated++
      if (!draft) {
        rejected++
        continue
      }
      made++
      checkDraft(t.id, d, draft)

      // 5. 정답 위치 분포 — 보기 개수가 다른 형식이 섞이므로 개수별로 따로 센다
      if (draft.choices && !Array.isArray(draft.answer)) {
        const idx = draft.choices.indexOf(draft.answer)
        const key = t.id + `보기${draft.choices.length}개`
        const arr = (posCount[key] ??= new Array(draft.choices.length).fill(0))
        if (idx >= 0 && idx < arr.length) arr[idx] = (arr[idx] ?? 0) + 1
      }
    }
    const rate = ((made / ROUNDS) * 100).toFixed(0)
    const bad = fails.filter((f) => f.template === t.id && f.difficulty === d).length
    console.log(`  ${t.id} 난이도${d}  성공률 ${rate}%  문제 ${bad}건`)
  }
}

console.log('\n정답 위치 분포 (한쪽에 쏠리면 안 됨)')
for (const [id, arr] of Object.entries(posCount)) {
  const total = arr.reduce((s, v) => s + v, 0)
  if (total === 0) continue
  const pct = arr.map((v) => ((v / total) * 100).toFixed(0) + '%').join(' · ')
  // 보기가 k개면 고르게 나왔을 때 각 자리가 1/k 다. 그 1.5배를 넘으면 쏠린 것으로 본다
  const even = 1 / arr.length
  const max = Math.max(...arr) / total
  const skewed = max > even * 1.5
  console.log(`  ${id}  ${pct}${skewed ? '  ← 쏠림' : ''}`)
  if (skewed) {
    fails.push({
      template: id,
      difficulty: 0,
      why: `정답 위치가 한쪽에 ${(max * 100).toFixed(0)}% 쏠렸습니다 (고르면 ${(even * 100).toFixed(0)}%)`,
      sample: '',
    })
  }
}

/* ── 세트 조립 검사 ─────────────────────────────────── */

console.log('\n세트 조립 검사 (200세트)')
let setFail = 0
let dupShape = 0
const familyCount = { range: 0, estimate: 0, both: 0 }
for (let i = 0; i < 200; i++) {
  try {
    const set = generateSet(`set${i}`, { unit: '5-2-1', counts: { easy: 3, mid: 4, hard: 2 } })
    if (set.length !== 9) {
      console.log(`  ✗ set${i}: 문항 수 ${set.length}`)
      setFail++
      continue
    }
    const byTemplate: Record<string, number> = {}
    for (const p of set) byTemplate[p.templateId] = (byTemplate[p.templateId] ?? 0) + 1
    const over = Object.entries(byTemplate).filter(([, c]) => c > G7_MAX_PER_TEMPLATE)
    if (over.length) {
      console.log(`  ✗ set${i}: G7 위반 ${over.map(([k, c]) => `${k}×${c}`).join(', ')}`)
      setFail++
    }
    const pts = set.reduce((s, p) => s + p.points, 0)
    if (pts !== 17) {
      console.log(`  ✗ set${i}: 만점이 ${pts}점 (17점이어야 함)`)
      setFail++
    }
    if (new Set(set.map((p) => p.id)).size !== set.length) {
      console.log(`  ✗ set${i}: 문항 id 중복`)
      setFail++
    }
    // 발문이 통째로 같은 문항이 한 세트에 두 번 들어가면 안 된다
    if (new Set(set.map((p) => p.prompt)).size !== set.length) {
      console.log(`  ✗ set${i}: 같은 발문이 두 번 나왔습니다`)
      setFail++
    }
    // 성격까지 같은 문항(같은 템플릿·같은 방법·같은 자리)이 겹치는지
    const shapes = set.map((p) =>
      [p.templateId, p.params['method'], p.params['place'], p.params['scenario'], p.params['term'], p.params['extra'], p.params['direction'], p.params['pair']].join('|'),
    )
    if (new Set(shapes).size !== shapes.length) dupShape++
    for (const p of set) {
      const f = TEMPLATES.find((t) => t.id === p.templateId)!.family
      if (f === 'range' || f === 'estimate' || f === 'both') familyCount[f]++
    }
  } catch (e) {
    console.log(`  ✗ set${i}: ${e instanceof Error ? e.message : String(e)}`)
    setFail++
  }
}

// 재현성 — 같은 시드면 같은 세트
const a = generateSet('same-seed', { unit: '5-2-1', counts: { easy: 3, mid: 4, hard: 2 } })
const b = generateSet('same-seed', { unit: '5-2-1', counts: { easy: 3, mid: 4, hard: 2 } })
const reproducible = JSON.stringify(a) === JSON.stringify(b)
console.log(`  성격이 겹치는 문항이 든 세트 ${dupShape}/200 (없을수록 좋음)`)
console.log(`  재현성(같은 시드 → 같은 세트): ${reproducible ? 'OK' : '✗ 깨짐'}`)
if (!reproducible) setFail++

const totalF = familyCount.range + familyCount.estimate + familyCount.both
console.log(
  `  성취기준 비율  범위 ${((familyCount.range / totalF) * 100).toFixed(0)}% · ` +
  `어림 ${((familyCount.estimate / totalF) * 100).toFixed(0)}% · ` +
  `둘 다(T5) ${((familyCount.both / totalF) * 100).toFixed(0)}%  (목표 범위 5 : 어림 4)`,
)

/* ── 결과 ───────────────────────────────────────────── */

console.log(`\nT7 보기에 '아래가 모두 0 인 수' 가 든 비율 ${((g8Present / g8Total) * 100).toFixed(0)}% (G8)`)
console.log(`생성 시도 ${generated}회 · 가드로 버린 것 ${rejected}회 (${((rejected / generated) * 100).toFixed(1)}%)`)

if (fails.length === 0 && setFail === 0) {
  console.log('\n통과. 형식 문제는 없습니다.')
  console.log('다음: npm run dump 로 100문항을 뽑아 눈으로 검수하세요 (STEP 4).')
} else {
  console.log(`\n실패 ${fails.length}건 + 세트 문제 ${setFail}건`)
  const grouped = new Map<string, Fail[]>()
  for (const f of fails) {
    const k = `${f.template} · ${f.why}`
    grouped.set(k, [...(grouped.get(k) ?? []), f])
  }
  for (const [k, list] of grouped) {
    console.log(`\n[${list.length}건] ${k}`)
    console.log(`  예: ${list[0]!.sample.slice(0, 160).replace(/\n/g, ' ⏎ ')}`)
  }
  process.exitCode = 1
}
