/**
 * T6 — 방법 선택 + 적용. 맥락에 맞는 어림 방법을 고르고 값까지 구한다. [6수01-03]
 * params: scenario / ask(방법만·값까지) / post(없음·나머지·묶음수×단가·합산후어림)
 *
 * 설계보고서 1.7 발견 3: 상 난이도 실생활 문항의 공통 구조는 "어림 + 후처리 연산" 이다.
 * 어림 결과가 최종 답이 아니라 중간 계산인 구조가 핵심이다.
 */

import type { Rng } from '../../lib/rng'
import type { Draft, Template } from '../_types'
import { estimate, fmt, type Method } from '../_guards'
import { buildChoices } from '../_helpers'

type Post = '없음' | '나머지' | '묶음수×단가' | '합산후어림'

type Built = {
  scenario: string
  method: Method
  /** 방법만 물을 때의 발문 */
  askMethodPrompt: string
  /** 값까지 물을 때의 발문 */
  askValuePrompt: string
  value: number
  unitLabel: string
  reason: string
  valueExplain: string
  post: Post
}

/** 버스 대수 — 올림 */
function bus(rng: Rng, withPost: boolean): Built {
  const cap = rng.pick([35, 40, 45])
  const boys = rng.int(48, 96)
  const girls = rng.int(48, 96)
  const total = withPost ? boys + girls : rng.int(120, 260)
  const buses = Math.ceil(total / cap)
  const head = withPost
    ? `남학생 ${boys}명과 여학생 ${girls}명이 함께 버스를 타고 갑니다.`
    : `학생 ${total}명이 버스를 타고 갑니다.`
  return {
    scenario: '버스 대수',
    method: '올림',
    askMethodPrompt: `${head}\n버스 한 대에 ${cap}명씩 탈 때, 어떤 방법으로 어림해야 할까요?`,
    askValuePrompt: `${head}\n버스 한 대에 ${cap}명씩 탈 때, 버스는 최소 몇 대 필요한가요?`,
    value: buses,
    unitLabel: '대',
    reason: '남는 학생도 버스를 타야 하므로 남는 사람이 생기면 한 대를 더 준비해야 합니다. 그래서 올림입니다.',
    valueExplain: `${withPost ? `${boys} + ${girls} = ${total}(명), ` : ''}${total} ÷ ${cap} = ${Math.floor(total / cap)}대 하고 ${total % cap}명이 남습니다. 남는 ${total % cap}명도 타야 하므로 ${buses}대가 필요합니다.`,
    post: withPost ? '합산후어림' : '없음',
  }
}

/** 상자 포장 — 버림 */
function box(rng: Rng, withPost: boolean): Built {
  const per = rng.pick([10, 12, 20, 25])
  const total = rng.int(8, 18) * per + rng.int(1, per - 1)
  const boxes = Math.floor(total / per)
  const rest = total - boxes * per
  const item = rng.pick(['사탕', '쿠키', '초콜릿', '귤'])
  const head = `${item} ${total}개를 한 상자에 ${per}개씩 담아 팔려고 합니다.`
  return {
    scenario: '상자 포장',
    method: '버림',
    askMethodPrompt: `${head}\n팔 수 있는 상자 수를 구하려면 어떤 방법으로 어림해야 할까요?`,
    askValuePrompt: withPost
      ? `${head}\n상자에 담고 남는 ${item}은 몇 개인가요?`
      : `${head}\n팔 수 있는 상자는 최대 몇 상자인가요?`,
    value: withPost ? rest : boxes,
    unitLabel: withPost ? '개' : '상자',
    reason: `${per}개가 안 되면 한 상자로 팔 수 없으므로 남는 것은 버립니다. 그래서 버림입니다.`,
    valueExplain: withPost
      ? `${total} ÷ ${per} = ${boxes}상자 하고 ${rest}개가 남습니다. 남는 ${item}은 ${rest}개입니다.`
      : `${total} ÷ ${per} = ${boxes}상자 하고 ${rest}개가 남습니다. 남는 것으로는 상자를 채울 수 없으므로 ${boxes}상자입니다.`,
    post: withPost ? '나머지' : '없음',
  }
}

/** 물건값 지불 — 올림 */
function pay(rng: Rng): Built {
  const price = rng.int(6, 19) * 100 + rng.pick([0, 50])
  const count = rng.int(3, 9)
  const total = price * count
  const bill = rng.pick([1000, 1000, 10000])
  const bills = Math.ceil(total / bill)
  return {
    scenario: '물건값 지불',
    method: '올림',
    askMethodPrompt: `공책 한 권이 ${fmt(price)}원입니다. ${count}권을 사려고 합니다.\n${fmt(bill)}원짜리 지폐로만 낼 때 어떤 방법으로 어림해야 할까요?`,
    askValuePrompt: `공책 한 권이 ${fmt(price)}원입니다. ${count}권을 사려고 합니다.\n${fmt(bill)}원짜리 지폐로만 낸다면 최소 몇 장을 내야 하나요?`,
    value: bills,
    unitLabel: '장',
    reason: '돈이 모자라면 물건을 살 수 없으므로 부족하지 않게 올려야 합니다. 그래서 올림입니다.',
    valueExplain: `${fmt(price)} × ${count} = ${fmt(total)}(원)입니다. ${fmt(bill)}원짜리 ${bills - 1}장이면 ${fmt(bill * (bills - 1))}원으로 모자라므로 ${bills}장을 내야 합니다.`,
    post: '없음',
  }
}

/** 묶음 수 × 묶음값 — 올림 + 곱셈 */
function bundle(rng: Rng): Built {
  const per = rng.pick([10, 20, 25])
  const price = rng.int(4, 12) * 100
  const need = rng.int(6, 18) * per + rng.int(1, per - 1)
  const bundles = Math.ceil(need / per)
  const cost = bundles * price
  const item = rng.pick(['색종이', '도화지', '스티커'])
  const head = `${item} ${need}장이 필요합니다. ${item}는 ${per}장씩 한 묶음에 ${fmt(price)}원입니다.`
  return {
    scenario: '묶음 구매',
    method: '올림',
    askMethodPrompt: `${head}\n필요한 묶음 수를 구하려면 어떤 방법으로 어림해야 할까요?`,
    askValuePrompt: `${head}\n${item}를 사려면 최소 얼마가 필요한가요?`,
    value: cost,
    unitLabel: '원',
    reason: `${per}장이 안 되는 만큼도 사려면 한 묶음을 더 사야 합니다. 그래서 올림입니다.`,
    valueExplain: `${need} ÷ ${per} = ${Math.floor(need / per)}묶음 하고 ${need % per}장이 남으므로 ${bundles}묶음이 필요합니다.\n${bundles} × ${fmt(price)} = ${fmt(cost)}(원)입니다.`,
    post: '묶음수×단가',
  }
}

/** 인구 추산 — 반올림 */
function population(rng: Rng): Built {
  const place = rng.pick([1000, 10000] as const)
  const n = rng.int(place === 1000 ? 12 : 3, place === 1000 ? 89 : 9) * place + rng.int(1, place - 1)
  const v = estimate(n, place, '반올림')
  const label = place === 1000 ? '천의 자리' : '만의 자리'
  return {
    scenario: '인구 추산',
    method: '반올림',
    askMethodPrompt: `어느 마을의 인구는 ${fmt(n)}명입니다.\n인구를 대강 얼마쯤이라고 말할 때 어떤 방법으로 어림해야 할까요?`,
    askValuePrompt: `어느 마을의 인구는 ${fmt(n)}명입니다.\n반올림하여 ${label}까지 나타내면 몇 명인가요?`,
    value: v,
    unitLabel: '명',
    reason: '실제 수에 가장 가깝게 나타내야 하므로 반올림입니다.',
    valueExplain: `${label} 바로 아래 자리 숫자를 보고 반올림하면 ${fmt(v)}명입니다.`,
    post: '없음',
  }
}

const METHOD_CHOICES = ['올림', '버림', '반올림']

export const T6: Template = {
  id: 'T6',
  name: '방법 선택 + 적용',
  supports: [2, 3],
  family: 'estimate',
  generate(rng, difficulty) {
    let b: Built
    if (difficulty === 3) {
      // 상 난이도 = 실생활 2단계. 어림한 뒤 한 번 더 연산한다
      b = rng.pick([
        () => bus(rng, true),
        () => box(rng, true),
        () => bundle(rng),
      ])()
    } else {
      b = rng.pick([
        () => bus(rng, false),
        () => box(rng, false),
        () => pay(rng),
        () => population(rng),
      ])()
    }

    const ask = difficulty === 3 ? '값까지' : rng.pick(['방법만', '값까지', '값까지'] as const)

    if (ask === '방법만') {
      return {
        templateId: 'T6',
        params: { scenario: b.scenario, ask, post: b.post, method: b.method },
        difficulty,
        prompt: b.askMethodPrompt,
        choices: rng.shuffle(METHOD_CHOICES),
        answer: b.method,
        explanation: b.reason,
        standard: '6수01-03',
      } satisfies Draft
    }

    if (!Number.isFinite(b.value) || b.value <= 0) return null

    // 값까지 묻는 문항은 단답형. 단위는 발문에 이미 있으므로 숫자만 받는다
    const useChoices = difficulty === 2 && rng.bool(0.4)
    const correct = fmt(b.value)
    const base: Draft = {
      templateId: 'T6',
      params: { scenario: b.scenario, ask, post: b.post, method: b.method },
      difficulty,
      prompt: b.askValuePrompt,
      answer: correct,
      explanation: `${b.reason}\n${b.valueExplain}`,
      standard: '6수01-03',
    }
    if (!useChoices) return base

    const step = b.unitLabel === '원' ? Math.max(100, Math.round(b.value / 10)) : 1
    const distractors = [fmt(b.value + step), fmt(Math.max(1, b.value - step)), fmt(b.value + step * 2)]
    const choices = buildChoices(rng, correct, distractors)
    if (!choices) return null
    return { ...base, choices }
  },
}
