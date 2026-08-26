/**
 * 5-2-2 「분수의 곱셈」
 *
 * 설계 근거는 `docs/2단원_유형분석.md` — 수학익힘책 26~39쪽을 뜯어본 결과다.
 * 익힘책 문항을 베끼지 않았다. **유형과 난이도 구조만** 근거로 삼아 새로 만들었다.
 *
 * 세트 조립은 1단원과 같은 얼개다. 다른 것은 균형 목표뿐이다 —
 * 1단원은 범위 : 어림 을 맞췄고, 여기는 **계산 : 활용**을 맞춘다.
 * 계산만 아홉 개 나오면 지겹고, 활용만 나오면 아이들이 손도 못 댄다.
 */

import { makeRng, type Rng } from '../../lib/rng'
import { maxPerTemplate, POINTS } from '../_plan'
import type { Difficulty, Draft, Problem, SetConfig, Template, TopicInfo, UnitModule } from '../_types'
import { CALC_TEMPLATES } from './calc'
import { T7, T8, T11 } from './apply'
import { T9, T10 } from './judge'
import { HARD_TEMPLATES } from './hard'
import { HARD2_TEMPLATES } from './hard2'

export const TEMPLATES: Template[] = [
  ...CALC_TEMPLATES, T7, T8, T9, T10, T11, ...HARD_TEMPLATES, ...HARD2_TEMPLATES,
]

/** 계산 6 : 활용 3 — 9문항 기준. 계산만 잔뜩 나오면 지겹다 */
const TARGET = { 계산: 6, 활용: 3 }

/**
 * 같은 유형이라도 성격까지 같으면 학생 눈에는 "같은 문제 두 번" 이다.
 * 1단원에서 실제로 겪은 일이라 여기도 같은 장치를 둔다.
 */
const SHAPE_KEYS = ['kind', 'form', 'shape', 'scenario', 'unit', 'mode', 'want', 'depth'] as const

const shapeOf = (d: Draft): string =>
  [d.templateId, ...SHAPE_KEYS.map((k) => d.params[k] ?? '')].join('|')

/** 문장에 undefined·NaN 이 없는지. 여기서 새면 학생 화면에 그대로 나간다 */
export function isSane(d: Draft): boolean {
  const texts = [
    d.prompt,
    d.explanation,
    ...(d.choices ?? []),
    ...(Array.isArray(d.answer) ? d.answer : [d.answer]),
  ]
  for (const t of texts) {
    if (typeof t !== 'string' || t.trim() === '') return false
    if (/undefined|NaN|null/.test(t)) return false
    // 분수 표시가 깨진 채로 나가면 화면에 [3/0] 같은 게 뜬다
    if (/\[\d+\/0\]|\[0\/\d+\]/.test(t)) return false
  }
  if (d.choices) {
    if (d.choices.length < 2) return false
    if (new Set(d.choices).size !== d.choices.length) return false
    const answers = Array.isArray(d.answer) ? d.answer : [d.answer]
    if (!answers.every((a) => d.choices!.includes(a))) return false
  }
  return true
}

type Accept = (d: Draft) => boolean

function tryTemplate(t: Template, rng: Rng, difficulty: Difficulty, accept: Accept, tries = 60): Draft | null {
  for (let i = 0; i < tries; i++) {
    let d: Draft | null = null
    try {
      d = t.generate(rng, difficulty)
    } catch {
      d = null
    }
    if (!d || !isSane(d)) continue
    if (!accept(d)) continue
    return d
  }
  return null
}

export function generateSet(seed: string, config: SetConfig): Problem[] {
  const rng = makeRng(`${config.unit}|${seed}`)
  const { easy, mid, hard } = config.counts
  const slots: Difficulty[] = [
    ...Array.from({ length: easy }, () => 1 as Difficulty),
    ...Array.from({ length: mid }, () => 2 as Difficulty),
    ...Array.from({ length: hard }, () => 3 as Difficulty),
  ]

  const wanted = config.templateIds && config.templateIds.length > 0 ? config.templateIds : null
  const allowed = wanted ? TEMPLATES.filter((t) => wanted.includes(t.id)) : TEMPLATES
  if (allowed.length === 0) throw new Error(`${config.unit}: 출제할 유형을 하나 이상 골라야 합니다.`)

  const perTemplate = maxPerTemplate(allowed.length, slots.length)
  const used: Record<string, number> = {}
  const fam: Record<string, number> = { 계산: 0, 활용: 0 }
  const usedShapes = new Set<string>()
  const usedPrompts = new Set<string>()
  const out: Problem[] = []

  slots.forEach((difficulty, i) => {
    let pool = allowed.filter((t) => t.supports.includes(difficulty) && (used[t.id] ?? 0) < perTemplate)
    if (pool.length === 0) pool = allowed.filter((t) => t.supports.includes(difficulty))
    if (pool.length === 0) {
      throw new Error(`${config.unit}: 고른 유형으로는 난이도 ${difficulty} 문항을 만들 수 없습니다.`)
    }

    // 계산 : 활용 균형 — 목표에서 더 모자란 쪽을 먼저 쓴다
    const need계산 = TARGET.계산 - (fam['계산'] ?? 0)
    const need활용 = TARGET.활용 - (fam['활용'] ?? 0)
    const prefer = need계산 >= need활용 ? '계산' : '활용'
    const preferred = pool.filter((t) => t.family === prefer)
    const finalPool = preferred.length > 0 ? preferred : pool

    const t = rng.pick(finalPool)
    const alt = rng.shuffle(allowed.filter((x) => x.supports.includes(difficulty) && x.id !== t.id))

    const freshShape: Accept = (d) => !usedShapes.has(shapeOf(d)) && !usedPrompts.has(d.prompt)
    const freshPrompt: Accept = (d) => !usedPrompts.has(d.prompt)
    const anything: Accept = () => true

    const d1 = tryTemplate(t, rng, difficulty, freshShape)
    if (d1) return push(d1, t)
    for (const a of alt) {
      if ((used[a.id] ?? 0) >= perTemplate) continue
      const d2 = tryTemplate(a, rng, difficulty, freshShape)
      if (d2) return push(d2, a)
    }
    for (const a of [t, ...alt]) {
      const d3 = tryTemplate(a, rng, difficulty, freshPrompt, 160)
      if (d3) return push(d3, a)
    }
    for (const a of [t, ...alt]) {
      const d4 = tryTemplate(a, rng, difficulty, anything)
      if (d4) return push(d4, a)
    }

    throw new Error(
      `${config.unit}: 난이도 ${difficulty} 문항을 만들지 못했습니다 (${i + 1}번째). 가드 조건을 확인하세요.`,
    )

    function push(d: Draft, tpl: Template): void {
      used[tpl.id] = (used[tpl.id] ?? 0) + 1
      usedShapes.add(shapeOf(d))
      usedPrompts.add(d.prompt)
      fam[tpl.family] = (fam[tpl.family] ?? 0) + 1
      out.push({ ...d, id: `q${out.length + 1}`, points: POINTS[d.difficulty] })
    }
  })

  if (out.length !== slots.length) {
    throw new Error(`${config.unit}: 요청한 ${slots.length}문항 중 ${out.length}문항만 만들어졌습니다.`)
  }
  return out
}

export const unit522: UnitModule = {
  id: '5-2-2',
  name: '분수의 곱셈',
  grade: 5,
  semester: 2,
  unit: 2,
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

  sample(templateId: string, seed: string): Problem | null {
    const t = TEMPLATES.find((x) => x.id === templateId)
    if (!t) return null
    for (let i = 0; i < 60; i++) {
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

export default unit522
