/**
 * T5 — 어림 역방향. 어림한 결과에서 원래 수의 범위를 되짚는다. [6수01-02·03]
 *
 * 이 단원의 핵심 문항이다. 범위와 어림을 연결하는 유일한 유형이고,
 * 교과서가 둘을 한 단원으로 묶은 이유이기도 하다. 상 난이도에 반드시 1문항 이상 넣는다.
 */

import type { Draft, Template } from '../_types'
import { estimate, fmt, PLACE_LABEL, type Method, type PlaceName } from '../_guards'
import { buildChoices, numJosa } from '../_helpers'

const METHODS: Method[] = ['올림', '버림', '반올림']

/**
 * 어림해서 target 이 되는 자연수의 최소·최대를 **직접 훑어서** 찾는다.
 * 공식으로 유도하지 않고 실제로 대입해 보는 쪽이라, 공식 실수를 잡아 준다.
 */
function scanRange(target: number, place: number, method: Method): { min: number; max: number } | null {
  const from = Math.max(1, target - place * 2)
  const to = target + place * 2
  let min = Number.NaN
  let max = Number.NaN
  for (let n = from; n <= to; n++) {
    if (estimate(n, place, method) === target) {
      if (Number.isNaN(min)) min = n
      max = n
    }
  }
  if (Number.isNaN(min)) return null
  return { min, max }
}

/** 같은 결과를 규칙으로 구하는 쪽(독립 검산) */
function ruleRange(target: number, place: number, method: Method): { min: number; max: number } {
  switch (method) {
    case '올림': return { min: target - place + 1, max: target }
    case '버림': return { min: target, max: target + place - 1 }
    case '반올림': return { min: target - place / 2, max: target + place / 2 - 1 }
  }
}

const PLACE_SET: { name: PlaceName; place: number }[] = [
  { name: '십', place: 10 },
  { name: '백', place: 100 },
  { name: '천', place: 1000 },
]

export const T5: Template = {
  id: 'T5',
  name: '어림 역방향',
  supports: [2, 3],
  family: 'both',
  generate(rng, difficulty) {
    const method = rng.pick(METHODS)
    const po = rng.pick(difficulty === 2 ? PLACE_SET.slice(0, 2) : PLACE_SET.slice(1))
    const target = rng.int(12, 89) * po.place

    const scanned = scanRange(target, po.place, method)
    if (!scanned) return null
    const ruled = ruleRange(target, po.place, method)
    if (scanned.min !== ruled.min || scanned.max !== ruled.max) return null // 독립 검산 불일치

    const { min, max } = scanned
    const ask = difficulty === 2 ? rng.pick(['최솟값', '최댓값'] as const) : rng.pick(['범위', '최솟값', '최댓값'] as const)

    const head = `어떤 자연수를 ${method}하여 ${PLACE_LABEL[po.name]}까지 나타냈더니 ${fmt(target)}이 되었습니다.`
    const why =
      method === '올림'
        ? `${fmt(target)}${numJosa(target, '이', '가')} 되려면 ${fmt(ruled.min)}부터 ${fmt(target)}까지여야 합니다. ${fmt(ruled.min - 1)}${numJosa(ruled.min - 1, '은', '는')} 올림하면 ${fmt(target - po.place)}${numJosa(target - po.place, '이', '가')} 되어 버립니다.`
        : method === '버림'
          ? `${fmt(target)}${numJosa(target, '이', '가')} 되려면 ${fmt(target)}부터 ${fmt(ruled.max)}까지여야 합니다. ${fmt(ruled.max + 1)}${numJosa(ruled.max + 1, '부터는', '부터는')} 버림해도 ${fmt(target + po.place)}${numJosa(target + po.place, '이', '가')} 됩니다.`
          : `${fmt(target)}${numJosa(target, '이', '가')} 되려면 ${fmt(ruled.min)}부터 ${fmt(ruled.max)}까지여야 합니다. ${fmt(ruled.min - 1)}${numJosa(ruled.min - 1, '은', '는')} 내려가고, ${fmt(ruled.max + 1)}${numJosa(ruled.max + 1, '은', '는')} 올라갑니다.`

    if (ask === '범위') {
      const upper = max + 1
      const correct = `${fmt(min)} 이상 ${fmt(upper)} 미만`
      const distractors = [
        `${fmt(min)} 초과 ${fmt(upper)} 이하`,
        `${fmt(min - po.place / 2)} 이상 ${fmt(upper - po.place / 2)} 미만`,
        `${fmt(min)} 이상 ${fmt(upper)} 이하`,
        `${fmt(min + 1)} 이상 ${fmt(upper + 1)} 미만`,
      ]
      const choices = buildChoices(rng, correct, distractors)
      if (!choices) return null
      return {
        templateId: 'T5',
        params: { method, place: po.name, ask, numberType: '자연수' },
        difficulty,
        prompt: `${head}\n어떤 수가 될 수 있는 범위를 바르게 나타낸 것은 어느 것인가요?`,
        choices,
        answer: correct,
        explanation: `${why}\n이를 이상과 미만으로 쓰면 ${correct}입니다.`,
        standard: '6수01-02·03',
      } satisfies Draft
    }

    const value = ask === '최솟값' ? min : max
    return {
      templateId: 'T5',
      params: { method, place: po.name, ask, numberType: '자연수' },
      difficulty,
      prompt: `${head}\n어떤 수가 될 수 있는 가장 ${ask === '최솟값' ? '작은' : '큰'} 자연수를 구하세요.`,
      answer: fmt(value),
      explanation: `${why}\n따라서 가장 ${ask === '최솟값' ? '작은' : '큰'} 수는 ${fmt(value)}입니다.`,
      standard: '6수01-02·03',
    } satisfies Draft
  },
}
