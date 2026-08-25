/**
 * 5-2-1 「수의 범위와 올림, 버림, 반올림」
 *
 * generateSet(seed, config) — 같은 seed 면 항상 같은 세트가 나온다.
 * 요청한 난이도 구성에 정확히 맞추지 못하면 에러를 던진다. 조용히 문항 수를 줄이지 않는다.
 */

import { makeRng, type Rng } from '../../lib/rng'
import { maxPerTemplate, POINTS } from '../_plan'
import type {
  Difficulty, Draft, Problem, SetConfig, Template, TopicInfo, UnitModule,
} from '../_types'
import { T1 } from './t1'
import { T2 } from './t2'
import { T3 } from './t3'
import { T4 } from './t4'
import { T5 } from './t5'
import { T6 } from './t6'
import { T7 } from './t7'

export const TEMPLATES: Template[] = [T1, T2, T3, T4, T5, T6, T7]

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
 * 한 문항 뽑기. 가드를 못 맞추면 재시도한다.
 * accept 로 "이건 받겠다" 는 조건을 넘긴다 — 성격이 새로운지, 발문이 새로운지 등.
 */
type Accept = (d: Draft) => boolean

function tryTemplate(
  t: Template,
  rng: Rng,
  difficulty: Difficulty,
  accept: Accept,
  tries = 60,
): Draft | null {
  for (let i = 0; i < tries; i++) {
    let d: Draft | null = null
    try {
      d = t.generate(rng, difficulty)
    } catch {
      d = null // 독립 검산 불일치 등 — 버리고 다시 뽑는다
    }
    if (!d || !isSane(d)) continue
    if (!accept(d)) continue
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
  const usedPrompts = new Set<string>()
  const out: Problem[] = []

  // 교사가 고른 출제 범위만 쓴다. 안 고르면 단원 전체
  const wanted = config.templateIds && config.templateIds.length > 0 ? config.templateIds : null
  const allowed = wanted ? TEMPLATES.filter((t) => wanted.includes(t.id)) : TEMPLATES
  if (allowed.length === 0) throw new Error(`${config.unit}: 출제할 유형을 하나 이상 골라야 합니다.`)
  // 유형을 적게 고르면 같은 유형이 여러 번 나올 수밖에 없다. 그만큼 한도를 올린다
  const perTemplate = maxPerTemplate(allowed.length, slots.length)

  slots.forEach((slot, i) => {
    // 이 난이도를 낼 수 있고, 한 유형이 너무 많이 나오지 않는 것만
    let pool = allowed.filter(
      (t) => t.supports.includes(slot.difficulty) && (used[t.id] ?? 0) < perTemplate,
    )
    if (pool.length === 0) pool = allowed.filter((t) => t.supports.includes(slot.difficulty))
    if (pool.length === 0) {
      throw new Error(
        `${config.unit}: 고른 유형으로는 난이도 ${slot.difficulty} 문항을 만들 수 없습니다.`,
      )
    }

    // 성취기준 균형 — 목표에서 더 많이 모자란 쪽 계열을 먼저 쓴다
    const needRange = TARGET.range - family.range
    const needEstimate = TARGET.estimate - family.estimate
    const prefer: Template['family'] = needRange >= needEstimate ? 'range' : 'estimate'
    const preferred = pool.filter((t) => t.family === prefer || t.family === 'both')
    const finalPool = preferred.length > 0 ? preferred : pool

    const t = rng.pick(finalPool)
    const alt = rng.shuffle(allowed.filter((x) => x.supports.includes(slot.difficulty) && x.id !== t.id))

    // 받아들이는 기준을 세 단계로 느슨하게 푼다.
    // **발문이 같은 문항은 마지막까지 막는다** — 학생 눈에 그게 제일 티가 난다.
    const freshShape: Accept = (d) => !usedShapes.has(shapeOf(d)) && !usedPrompts.has(d.prompt)
    const freshPrompt: Accept = (d) => !usedPrompts.has(d.prompt)
    const anything: Accept = () => true

    // ① 이 유형에서 성격도 발문도 새로운 문항
    const d1 = tryTemplate(t, rng, slot.difficulty, freshShape)
    if (d1) return push(d1, t)

    // ② 같은 난이도의 다른 유형에서
    for (const a of alt) {
      if ((used[a.id] ?? 0) >= perTemplate) continue
      const d2 = tryTemplate(a, rng, slot.difficulty, freshShape)
      if (d2) return push(d2, a)
    }

    // ③ 성격이 겹쳐도 좋다. 발문만 새로우면 받는다
    //    (출제 범위를 하나만 골랐을 때는 성격이 겹칠 수밖에 없다)
    for (const a of [t, ...alt]) {
      const d3 = tryTemplate(a, rng, slot.difficulty, freshPrompt, 160)
      if (d3) return push(d3, a)
    }

    // ④ 마지막 수단. 문항 수를 조용히 줄이지는 않는다
    for (const a of [t, ...alt]) {
      const d4 = tryTemplate(a, rng, slot.difficulty, anything)
      if (d4) return push(d4, a)
    }

    throw new Error(
      `${config.unit}: 난이도 ${slot.difficulty} 문항을 만들지 못했습니다 (${i + 1}번째). 가드 조건을 확인하세요.`,
    )

    function push(d: Draft, tpl: Template): void {
      used[tpl.id] = (used[tpl.id] ?? 0) + 1
      usedShapes.add(shapeOf(d))
      usedPrompts.add(d.prompt)
      // family 는 이제 자유 글자다(단원마다 다르므로). 이 단원이 쓰는 값만 센다
      if (tpl.family === 'both') {
        if (needRange >= needEstimate) family.range++
        else family.estimate++
      } else if (tpl.family === 'range' || tpl.family === 'estimate') {
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

  topics(): TopicInfo[] {
    return TEMPLATES.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      topic: t.topic,
      levels: [...t.supports],
    }))
  },

  /** 교사가 '이런 게 나옵니다' 를 볼 수 있게 한 문항만 뽑아 준다 */
  sample(templateId: string, seed: string): Problem | null {
    const t = TEMPLATES.find((x) => x.id === templateId)
    if (!t) return null
    for (let i = 0; i < 40; i++) {
      const rng = makeRng(['sample', templateId, seed, i].join('|'))
      const level = t.supports[i % t.supports.length]!
      try {
        const d = t.generate(rng, level)
        if (d && isSane(d)) return { ...d, id: 'sample', points: POINTS[d.difficulty] }
      } catch {
        /* 다음 시도 */
      }
    }
    return null
  },
}

export default unit521
