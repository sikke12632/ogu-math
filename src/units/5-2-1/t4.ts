/**
 * T4 — 어림하기. 자리를 판정한다. [6수01-03]
 * params: method(올림·버림·반올림) / numberType(자연수·소수) / place(십·백·천·소수 첫째·둘째) / format(선택형·단답형)
 */

import type { Draft, Difficulty, Template } from '../_types'
import {
  composeNumber, estimate, fmt, g1_belowFirstNotZero,
  g2_pickRoundingDigit, PLACE_LABEL, type Method, type PlaceName,
} from '../_guards'
import { buildChoices, numJosa } from '../_helpers'

const METHODS: Method[] = ['올림', '버림', '반올림']

type PlaceChoice = { name: PlaceName; place: number; unit: number; aboveMin: number; aboveMax: number }

function placeOptions(difficulty: Difficulty, decimal: boolean): PlaceChoice[] {
  if (decimal) {
    return [
      { name: '소수 첫째', place: 0.1, unit: 0.01, aboveMin: 10, aboveMax: 99 },
      { name: '소수 둘째', place: 0.01, unit: 0.001, aboveMin: 100, aboveMax: 999 },
    ]
  }
  if (difficulty === 1) {
    return [
      { name: '십', place: 10, unit: 1, aboveMin: 12, aboveMax: 98 },
      { name: '백', place: 100, unit: 1, aboveMin: 12, aboveMax: 48 },
    ]
  }
  return [
    { name: '백', place: 100, unit: 1, aboveMin: 12, aboveMax: 98 },
    { name: '천', place: 1000, unit: 1, aboveMin: 12, aboveMax: 89 },
  ]
}

export const T4: Template = {
  id: 'T4',
  name: "올림·버림·반올림 하기",
  description: "'3428을 올림하여 백의 자리까지' 처럼 실제로 어림해 보는 문제입니다.",
  topic: "어림하기",
  supports: [1, 2],
  family: 'estimate',
  generate(rng, difficulty) {
    const method = rng.pick(METHODS)
    const decimal = difficulty >= 2 && rng.bool(0.45)
    const po = rng.pick(placeOptions(difficulty, decimal))

    // G1 — 어림 자리 아래 첫 자리는 0 금지. G2 — 반올림은 {3,4,5,6,7} 에서
    const belowFirst = method === '반올림' ? g2_pickRoundingDigit(rng) : rng.int(1, 9)

    const n = composeNumber(rng, {
      place: po.place,
      unit: po.unit,
      aboveMin: po.aboveMin,
      aboveMax: po.aboveMax,
      belowFirst,
      allowChainCarry: difficulty >= 2, // G3
    })
    if (n === null) return null
    if (!g1_belowFirstNotZero(n, po.place)) return null

    let correct: number
    let others: number[]
    try {
      correct = estimate(n, po.place, method)
      others = METHODS.filter((m) => m !== method).map((m) => estimate(n, po.place, m))
    } catch {
      return null // 독립 검산 불일치
    }

    const format = difficulty === 1 ? rng.pick(['선택형', '선택형', '단답형'] as const) : rng.pick(['선택형', '단답형'] as const)
    const prompt = `${fmt(n)}${numJosa(n, '을', '를')} ${method}하여 ${PLACE_LABEL[po.name]}까지 나타내면 얼마인가요?`

    const explanation =
      `${PLACE_LABEL[po.name]}까지 나타내려면 그 아래 자리를 봅니다.\n` +
      (method === '반올림'
        ? `바로 아래 자리 숫자가 ${belowFirst}이므로 ${belowFirst >= 5 ? '올려서' : '버려서'} ${fmt(correct)}입니다.`
        : method === '올림'
          ? `아래 자리에 0이 아닌 수가 있으므로 올려서 ${fmt(correct)}입니다.`
          : `아래 자리를 모두 버려서 ${fmt(correct)}입니다.`)

    const base: Draft = {
      templateId: 'T4',
      params: {
        method,
        numberType: decimal ? '소수' : '자연수',
        place: po.name,
        format,
      },
      difficulty,
      prompt,
      answer: fmt(correct),
      explanation,
      standard: '6수01-03',
    }

    if (format === '단답형') return base

    // 오답 보기는 다른 어림 방법의 결과와 인접 자리 결과로 만든다 (G4 로 중복 걸러짐)
    const distractors = [
      ...others.map(fmt),
      fmt(estimate(n, po.place * 10 > 10000 ? po.place / 10 : po.place * 10, method)),
      fmt(correct + po.place),
      fmt(Math.max(0, correct - po.place)),
    ]
    const choices = buildChoices(rng, fmt(correct), distractors)
    if (!choices) return null
    return { ...base, choices }
  },
}
