/**
 * T1 — 범위 판별. 용어를 보고 해당 여부를 판정한다. [6수01-02]
 * params: term(이상·이하·초과·미만) / context(순수·키·요금·인원) / format(다중선택·OX·표)
 */

import type { Rng } from '../../lib/rng'
import type { Draft, Difficulty, Template } from '../_types'
import { fmt, fix, g6_countable } from '../_guards'
import { NAMES, josa, numJosa, pickNames, satisfies, TERMS, type Term } from '../_helpers'

type Format = '다중선택' | 'OX' | '표'

/** 다중선택 — 보기 6개 중 범위에 속하는 것 모두 고르기 */
function multi(rng: Rng, difficulty: Difficulty): Draft | null {
  const term = rng.pick(TERMS)
  const useDecimal = difficulty >= 2 && rng.bool(0.5)
  const boundary = useDecimal
    ? fix(rng.int(30, 90) + rng.int(1, 9) * 0.1)
    : rng.int(15, 90) * (rng.bool(0.4) ? 10 : 1)

  const spread = useDecimal ? 1.2 : boundary >= 150 ? 60 : 8
  const values = new Set<number>()
  values.add(boundary) // 경계값은 반드시 보기에 넣는다. 이 단원의 학습 목표다
  let guard = 0
  while (values.size < 6 && guard++ < 60) {
    const delta = fix((rng.int(1, 6) * spread) / (useDecimal ? 6 : 3))
    const v = fix(boundary + (rng.bool() ? delta : -delta))
    if (v > 0) values.add(useDecimal ? fix(Math.round(v * 10) / 10) : Math.round(v))
  }
  if (values.size < 6) return null

  const list = rng.shuffle([...values])
  const correct = list.filter((v) => satisfies(v, boundary, term)).map(fmt)
  if (correct.length < 2 || correct.length > 4) return null

  return {
    templateId: 'T1',
    params: { term, context: '순수', format: '다중선택', numberType: useDecimal ? '소수' : '자연수' },
    difficulty,
    prompt: `다음 중 ${fmt(boundary)} ${term}인 수를 모두 고르세요.`,
    choices: list.map(fmt),
    answer: correct,
    explanation:
      `${fmt(boundary)} ${term}인 수는 ${termExplain(boundary, term)}\n` +
      `그래서 ${correct.join(', ')} 입니다.`,
    standard: '6수01-02',
  }
}

function termExplain(b: number, term: Term): string {
  const s = fmt(b)
  switch (term) {
    case '이상': return `${s}${numJosa(s, '과', '와')} 같거나 ${s}보다 큰 수입니다. ${s}도 포함합니다.`
    case '이하': return `${s}${numJosa(s, '과', '와')} 같거나 ${s}보다 작은 수입니다. ${s}도 포함합니다.`
    case '초과': return `${s}보다 큰 수입니다. ${s}${numJosa(s, '은', '는')} 포함하지 않습니다.`
    case '미만': return `${s}보다 작은 수입니다. ${s}${numJosa(s, '은', '는')} 포함하지 않습니다.`
  }
}

/** OX — 실생활 기준에 경계값을 대 본다 */
function ox(rng: Rng, difficulty: Difficulty): Draft | null {
  const scenarios = [
    {
      context: '키', make: () => rng.int(120, 150), step: 1,
      subject: (n: string) => `키가 %V%cm인 ${n}`,
      rule: (b: string, t: string) => `키가 ${b}cm ${t}인 사람만 탈 수 있는 놀이기구가 있습니다.`,
      ask: '이 놀이기구를 탈 수 있을까요?', yes: '탈 수 있다', no: '탈 수 없다',
      tail: (ok: boolean) => (ok ? '탈 수 있습니다.' : '탈 수 없습니다.'),
    },
    {
      context: '인원', make: () => rng.int(20, 39), step: 1,
      subject: () => `%V%명이 온 모둠`,
      rule: (b: string, t: string) => `${b}명 ${t}인 모둠만 큰 방을 쓸 수 있습니다.`,
      ask: '큰 방을 쓸 수 있을까요?', yes: '쓸 수 있다', no: '쓸 수 없다',
      tail: (ok: boolean) => (ok ? '큰 방을 쓸 수 있습니다.' : '큰 방을 쓸 수 없습니다.'),
    },
    {
      context: '요금', make: () => rng.int(10, 40) * 100, step: 100,
      subject: () => `%V%원짜리 물건`,
      rule: (b: string, t: string) => `${b}원 ${t}인 물건은 할인을 받을 수 있습니다.`,
      ask: '할인을 받을 수 있을까요?', yes: '받을 수 있다', no: '받을 수 없다',
      tail: (ok: boolean) => (ok ? '할인을 받을 수 있습니다.' : '할인을 받을 수 없습니다.'),
    },
  ] as const
  const s = rng.pick(scenarios)
  const term = rng.pick(TERMS)
  const boundary = s.make()
  // 절반은 경계값을 그대로 물어본다. 이상/초과의 차이가 드러나는 지점이다
  const value = rng.bool(0.5) ? boundary : boundary + (rng.bool() ? 1 : -1) * s.step
  if (value <= 0) return null

  const name = s.context === '키' ? rng.pick(NAMES) : ''
  const subject = s.subject(name).replace('%V%', fmt(value))
  const ok = satisfies(value, boundary, term)
  const verb = josa(subject, '은', '는')

  return {
    templateId: 'T1',
    params: { term, context: s.context, format: 'OX' },
    difficulty,
    prompt: `${s.rule(fmt(boundary), term)}\n${subject}${verb} ${s.ask}`,
    choices: rng.shuffle([s.yes, s.no]),
    answer: ok ? s.yes : s.no,
    explanation:
      `${fmt(boundary)} ${term}인 수는 ${termExplain(boundary, term)}\n` +
      `${fmt(value)}${numJosa(value, '은', '는')} ${ok ? '여기에 속하므로' : '여기에 속하지 않으므로'} ${s.tail(ok)}`,
    standard: '6수01-02',
  }
}

/** 표 — 기록표에서 범위에 속하는 사람 찾기 (설계보고서 1.7 발견 6) */
function table(rng: Rng, difficulty: Difficulty): Draft | null {
  const term = rng.pick(TERMS)
  const kinds = [
    { noun: '키', unit: 'cm', make: () => fix(rng.int(125, 152) + rng.int(0, 9) * 0.1), bMake: (vs: number[]) => fix(Math.round(mid(vs))) },
    { noun: '몸무게', unit: 'kg', make: () => fix(rng.int(28, 52) + rng.int(0, 9) * 0.1), bMake: (vs: number[]) => fix(Math.round(mid(vs))) },
    { noun: '기록', unit: '초', make: () => fix(rng.int(9, 16) + rng.int(0, 9) * 0.1), bMake: (vs: number[]) => fix(Math.round(mid(vs) * 10) / 10) },
  ] as const
  const kind = rng.pick(kinds)
  const names = pickNames(rng, 5)
  const values = names.map(() => kind.make())
  if (new Set(values).size !== values.length) return null
  const boundary = kind.bMake(values)

  const hits = names.filter((_, i) => satisfies(values[i]!, boundary, term))
  if (hits.length < 1 || hits.length > 3 || hits.length === names.length) return null
  if (!g6_countable(hits.length)) return null

  return {
    templateId: 'T1',
    params: { term, context: kind.noun, format: '표', numberType: '소수' },
    difficulty,
    prompt: `표를 보고 ${kind.noun}${josa(kind.noun, '이', '가')} ${fmt(boundary)}${kind.unit} ${term}인 학생을 모두 고르세요.`,
    visual: {
      kind: 'table',
      spec: {
        caption: `우리 모둠 ${kind.noun}`,
        headers: ['이름', `${kind.noun}(${kind.unit})`],
        rows: names.map((n, i) => [n, fmt(values[i]!)]),
      },
    },
    choices: [...names],
    answer: hits,
    explanation:
      `${fmt(boundary)}${kind.unit} ${term}인 수는 ${termExplain(boundary, term)}\n` +
      `표에서 찾으면 ${hits.map((n) => `${n}(${fmt(values[names.indexOf(n)]!)}${kind.unit})`).join(', ')} 입니다.`,
    standard: '6수01-02',
  }
}

function mid(vs: number[]): number {
  const s = [...vs].sort((a, b) => a - b)
  return s[Math.floor(s.length / 2)]!
}

export const T1: Template = {
  id: 'T1',
  name: '범위 판별',
  supports: [1, 2],
  family: 'range',
  generate(rng, difficulty) {
    const formats: Format[] = difficulty === 1 ? ['다중선택', 'OX', '다중선택'] : ['표', 'OX', '다중선택']
    const format = rng.pick(formats)
    if (format === 'OX') return ox(rng, difficulty)
    if (format === '표') return table(rng, difficulty)
    return multi(rng, difficulty)
  },
}

