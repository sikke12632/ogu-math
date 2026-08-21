/**
 * 5-2-1 「수의 범위와 올림, 버림, 반올림」
 *
 * generateSet(seed, config) — 같은 seed 면 항상 같은 세트가 나온다.
 * 요청한 난이도 구성에 정확히 맞추지 못하면 에러를 던진다. 조용히 문항 수를 줄이지 않는다.
 */

import { makeRng, type Rng } from '../../lib/rng'
import { G7_MAX_PER_TEMPLATE } from '../_guards'
import type { Difficulty, Draft, Problem, SetConfig, Template, UnitModule } from '../_types'
import { T1 } from './t1'
import { T2 } from './t2'
import { T3 } from './t3'
import { T4 } from './t4'
import { T5 } from './t5'
import { T6 } from './t6'
import { T7 } from './t7'

export const TEMPLATES: Template[] = [T1, T2, T3, T4, T5, T6, T7]

const POINTS: Record<Difficulty, number> = { 1: 1, 2: 2, 3: 3 }

/** 성취기준 균형 목표 — 범위 5 : 어림 4 (설계보고서 1.7 발견 4) */
const TARGET = { range: 5, estimate: 4 }

type Slot = { difficulty: Difficulty }

function buildSlots(config: SetConfig): Slot[] {
  const { easy, mid, hard } = config.counts
  return [
    ...Array.from({ length: easy }, () => ({ difficulty: 1 as Difficulty })),
    ...Array.from({ length: mid }, () => ({ difficulty: 2 as Difficulty })),
    ...Array.from({ length: hard }, () => ({ difficulty: 3 as Difficulty })),
  ]
}

/**
 * G7 확장 — 템플릿이 같아도 파라미터까지 같으면 학생 눈에는 "같은 문제 두 번"이다.
 * 실제로 한 세트에 "버림·십의 자리 역방향" 이 두 번 들어가는 일이 있었다.
 * 방법·자리·상황처럼 문제의 성격을 정하는 값만 본다 (선택형/단답형 같은 형식 차이는 무시).
 */
const SHAPE_KEYS = ['method', 'place', 'scenario', 'term', 'extra', 'direction', 'pair'] as const

function shapeOf(d: Draft): string {
  return [d.templateId, ...SHAPE_KEYS.map((k) => d.params[k] ?? '')].join('|')
}

/**
 * 한 문항 뽑기. 가드를 못 맞추면 50회까지 재시도한다.
 * usedShapes 를 주면 이미 나온 성격과 겹치는 문항은 돌려주지 않는다(엄격 모드).
 */
function tryTemplate(
  t: Template,
  rng: Rng,
  difficulty: Difficulty,
  usedShapes: Set<string> | null,
): Draft | null {
  for (let i = 0; i < 50; i++) {
    let d: Draft | null = null
    try {
      d = t.generate(rng, difficulty)
    } catch {
      d = null // 독립 검산 불일치 등 — 버리고 다시 뽑는다
    }
    if (!d || !isSane(d)) continue
    if (usedShapes && usedShapes.has(shapeOf(d))) continue
    return d
  }
  return null
}

/** 문장에 undefined·NaN·빈칸이 없는지. 여기서 새면 학생 화면에 그대로 나간다 */
export function isSane(d: Draft): boolean {
  const texts = [d.prompt, d.explanation, ...(d.choices ?? []), ...(Array.isArray(d.answer) ? d.answer : [d.answer])]
  for (const t of texts) {
    if (typeof t !== 'string' || t.trim() === '') return false
    if (/undefined|NaN|null/.test(t)) return false
  }
  if (d.choices) {
    if (d.choices.length < 2) return false
    if (new Set(d.choices).size !== d.choices.length) return false
    const answers = Array.isArray(d.answer) ? d.answer : [d.answer]
    if (!answers.every((a) => d.choices!.includes(a))) return false
    if (d.choiceVisuals && d.choiceVisuals.length !== d.choices.length) return false
  }
  return true
}

export function generateSet(seed: string, config: SetConfig): Problem[] {
  const rng = makeRng(`${config.unit}|${seed}`)
  const slots = buildSlots(config)
  const used: Record<string, number> = {}
  const family = { range: 0, estimate: 0 }
  const usedShapes = new Set<string>()
  const out: Problem[] = []

  slots.forEach((slot, i) => {
    // 이 난이도를 만들 수 있고, G7(같은 템플릿 2회 초과 금지)에 걸리지 않는 것만
    let pool = TEMPLATES.filter(
      (t) => t.supports.includes(slot.difficulty) && (used[t.id] ?? 0) < G7_MAX_PER_TEMPLATE,
    )
    if (pool.length === 0) pool = TEMPLATES.filter((t) => t.supports.includes(slot.difficulty))

    // 성취기준 균형 — 목표에서 더 많이 모자란 쪽 계열을 먼저 쓴다
    const needRange = TARGET.range - family.range
    const needEstimate = TARGET.estimate - family.estimate
    const prefer: Template['family'] = needRange >= needEstimate ? 'range' : 'estimate'
    const preferred = pool.filter((t) => t.family === prefer || t.family === 'both')
    const finalPool = preferred.length > 0 ? preferred : pool

    const t = rng.pick(finalPool)

    // ① 이 템플릿에서 아직 안 나온 성격의 문항
    const draft = tryTemplate(t, rng, slot.difficulty, usedShapes)
    if (draft) {
      push(draft, t)
      return
    }

    // ② 안 되면 같은 난이도의 다른 템플릿으로 (같은 난이도 전체를 훑는다)
    const alt = rng.shuffle(TEMPLATES.filter((x) => x.supports.includes(slot.difficulty) && x.id !== t.id))
    for (const a of alt) {
      if ((used[a.id] ?? 0) >= G7_MAX_PER_TEMPLATE) continue
      const d2 = tryTemplate(a, rng, slot.difficulty, usedShapes)
      if (d2) {
        push(d2, a)
        return
      }
    }

    // ③ 그래도 안 되면 성격 중복을 허용한다. 문항 수를 줄이지는 않는다
    for (const a of [t, ...alt]) {
      const d3 = tryTemplate(a, rng, slot.difficulty, null)
      if (d3) {
        push(d3, a)
        return
      }
    }

    throw new Error(
      `${config.unit}: 난이도 ${slot.difficulty} 문항을 만들지 못했습니다 (${i + 1}번째). 가드 조건을 확인하세요.`,
    )

    function push(d: Draft, tpl: Template) {
      used[tpl.id] = (used[tpl.id] ?? 0) + 1
      usedShapes.add(shapeOf(d))
      if (tpl.family === 'both') {
        if (needRange >= needEstimate) family.range++
        else family.estimate++
      } else {
        family[tpl.family]++
      }
      out.push({ ...d, id: `q${out.length + 1}`, points: POINTS[d.difficulty] })
    }
  })

  if (out.length !== slots.length) {
    throw new Error(`${config.unit}: 요청한 ${slots.length}문항 중 ${out.length}문항만 만들어졌습니다.`)
  }
  return out
}

export const unit521: UnitModule = {
  id: '5-2-1',
  name: '수의 범위와 올림, 버림, 반올림',
  grade: 5,
  semester: 2,
  unit: 1,
  mode: 'generated',
  generate: generateSet,
}

export default unit521
