/**
 * T3 — 범위 안 개수 세기. 경계 포함 여부를 판단한다. [6수01-02]
 * params: numberType(자연수·소수) / bounds(한쪽 열림·양쪽 닫힘) / extra(없음·홀짝·배수·교집합·역산)
 *
 * 설계보고서 1.7 발견 5: 실제 문항은 단순 개수 세기가 거의 없고 부가조건이 붙는다.
 */

import type { Rng } from '../../lib/rng'
import type { Draft, Difficulty, Template } from '../_types'
import { fix, fmt, g6_countable } from '../_guards'
import { satisfies, type Term } from '../_helpers'

type Extra = '없음' | '홀짝' | '배수' | '교집합' | '역산'

const LOW: Term[] = ['이상', '초과']
const HIGH: Term[] = ['이하', '미만']

/** 두 조건을 만족하는 자연수를 실제로 세어 본다(무식하게 세는 쪽) */
function countBrute(lo: number, loT: Term, hi: number, hiT: Term, filter: (n: number) => boolean): number {
  let c = 0
  for (let n = Math.floor(lo) - 2; n <= Math.ceil(hi) + 2; n++) {
    if (satisfies(n, lo, loT) && satisfies(n, hi, hiT) && filter(n)) c++
  }
  return c
}

/** 같은 개수를 식으로 구하는 쪽(독립 검산) */
function countFormula(lo: number, loT: Term, hi: number, hiT: Term): number {
  const first = loT === '이상' ? Math.ceil(lo) : Math.floor(lo) + 1
  const last = hiT === '이하' ? Math.floor(hi) : Math.ceil(hi) - 1
  return Math.max(0, last - first + 1)
}

function basic(rng: Rng, difficulty: Difficulty, extra: Extra): Draft | null {
  const lo = rng.int(8, 60)
  // 하 난이도에서는 세는 개수를 줄인다. 계산이 아니라 세다가 시간이 가면 안 된다
  const span = difficulty === 1 ? rng.int(4, 10) : rng.int(4, 16)
  const hi = lo + span
  const loT = rng.pick(LOW)
  const hiT = rng.pick(HIGH)

  let filter: (n: number) => boolean = () => true
  let extraText = ''
  let extraExplain = ''
  const params: Record<string, string> = { numberType: '자연수', bounds: `${loT}·${hiT}`, extra }

  if (extra === '홀짝') {
    const odd = rng.bool()
    filter = (n) => (odd ? n % 2 === 1 : n % 2 === 0)
    extraText = odd ? ' 중 홀수' : ' 중 짝수'
    extraExplain = odd ? '그중 홀수만 세면' : '그중 짝수만 세면'
    params['parity'] = odd ? '홀수' : '짝수'
  } else if (extra === '배수') {
    const k = rng.pick([3, 4, 5, 6])
    filter = (n) => n % k === 0
    extraText = ` 중 ${k}의 배수`
    extraExplain = `그중 ${k}의 배수만 세면`
    params['multiple'] = String(k)
  }

  const answer = countBrute(lo, loT, hi, hiT, filter)
  if (!g6_countable(answer)) return null
  if (extra === '없음' && countFormula(lo, loT, hi, hiT) !== answer) return null

  const rangeText = `${lo} ${loT} ${hi} ${hiT}인 자연수`
  const first = loT === '이상' ? lo : lo + 1
  const last = hiT === '이하' ? hi : hi - 1

  return {
    templateId: 'T3',
    params,
    difficulty,
    prompt: `${rangeText}${extraText}는 모두 몇 개인가요?`,
    answer: String(answer),
    explanation:
      `${lo} ${loT}이므로 ${first}부터, ${hi} ${hiT}이므로 ${last}까지입니다.\n` +
      (extraExplain ? `${first}부터 ${last}까지 중 ${extraExplain} ${answer}개입니다.` : `${first}부터 ${last}까지는 ${answer}개입니다.`),
    standard: '6수01-02',
  }
}

/** 두 범위의 교집합 */
function overlap(rng: Rng, difficulty: Difficulty): Draft | null {
  const aLo = rng.int(8, 30)
  const aHi = aLo + rng.int(8, 16)
  const bLo = aLo + rng.int(3, 8)
  const bHi = bLo + rng.int(6, 14)
  const aLoT = rng.pick(LOW)
  const aHiT = rng.pick(HIGH)
  const bLoT = rng.pick(LOW)
  const bHiT = rng.pick(HIGH)

  let answer = 0
  const hit: number[] = []
  for (let n = 0; n <= 100; n++) {
    const inA = satisfies(n, aLo, aLoT) && satisfies(n, aHi, aHiT)
    const inB = satisfies(n, bLo, bLoT) && satisfies(n, bHi, bHiT)
    if (inA && inB) { answer++; hit.push(n) }
  }
  if (!g6_countable(answer)) return null

  return {
    templateId: 'T3',
    params: { numberType: '자연수', bounds: '두 범위', extra: '교집합' },
    difficulty,
    prompt:
      `가 상자에는 ${aLo} ${aLoT} ${aHi} ${aHiT}인 수, 나 상자에는 ${bLo} ${bLoT} ${bHi} ${bHiT}인 수를 넣습니다.\n` +
      `두 상자에 모두 넣을 수 있는 자연수는 몇 개인가요?`,
    answer: String(answer),
    explanation:
      `가 상자에 들어가는 자연수는 ${aLoT === '이상' ? aLo : aLo + 1}부터 ${aHiT === '이하' ? aHi : aHi - 1}까지,\n` +
      `나 상자는 ${bLoT === '이상' ? bLo : bLo + 1}부터 ${bHiT === '이하' ? bHi : bHi - 1}까지입니다. ` +
      `겹치는 수는 ${hit[0]}부터 ${hit[hit.length - 1]}까지 ${answer}개입니다.`,
    standard: '6수01-02',
  }
}

/** 개수를 주고 경계를 역산 */
function inverse(rng: Rng, difficulty: Difficulty): Draft | null {
  const lo = rng.int(10, 50)
  const loT = rng.pick(LOW)
  const count = rng.int(4, 12)
  const hiT = rng.pick(HIGH)
  const first = loT === '이상' ? lo : lo + 1
  const last = first + count - 1
  const hi = hiT === '이하' ? last : last + 1
  if (!g6_countable(count)) return null
  // 실제로 그 개수가 나오는지 확인
  if (countBrute(lo, loT, hi, hiT, () => true) !== count) return null

  return {
    templateId: 'T3',
    params: { numberType: '자연수', bounds: `${loT}·${hiT}`, extra: '역산' },
    difficulty,
    prompt: `${lo} ${loT} ☐ ${hiT}인 자연수가 ${count}개입니다.\n☐에 알맞은 자연수를 구하세요.`,
    answer: String(hi),
    explanation:
      `${lo} ${loT}이므로 ${first}부터 시작합니다. ${count}개이면 ${first}부터 ${last}까지입니다.\n` +
      `${last}가 마지막이 되려면 ☐는 ${hi}여야 합니다(${hi} ${hiT}).`,
    standard: '6수01-02',
  }
}

/** 소수 한 자리 수 세기 */
function decimalCount(rng: Rng, difficulty: Difficulty): Draft | null {
  const whole = rng.int(1, 12)
  const loD = rng.int(0, 5)
  const span = rng.int(3, 12)
  const lo = fix(whole + loD * 0.1)
  const hi = fix(lo + span * 0.1)
  const loT = rng.pick(LOW)
  const hiT = rng.pick(HIGH)

  let answer = 0
  for (let i = 0; i <= 300; i++) {
    const v = fix(i * 0.1)
    if (satisfies(v, lo, loT) && satisfies(v, hi, hiT)) answer++
  }
  if (!g6_countable(answer)) return null

  return {
    templateId: 'T3',
    params: { numberType: '소수', bounds: `${loT}·${hiT}`, extra: '없음' },
    difficulty,
    prompt: `${fmt(lo)} ${loT} ${fmt(hi)} ${hiT}인 소수 한 자리 수는 모두 몇 개인가요?`,
    answer: String(answer),
    explanation:
      `${fmt(lo)}부터 ${fmt(hi)}까지 0.1씩 뛰어 세면서, ` +
      `${fmt(lo)}는 ${loT === '이상' ? '포함하고' : '포함하지 않고'} ${fmt(hi)}는 ${hiT === '이하' ? '포함합니다' : '포함하지 않습니다'}.\n` +
      `그래서 ${answer}개입니다.`,
    standard: '6수01-02',
  }
}

export const T3: Template = {
  id: 'T3',
  name: '범위 안 개수 세기',
  supports: [1, 2, 3],
  family: 'range',
  generate(rng, difficulty) {
    if (difficulty === 1) return basic(rng, difficulty, '없음')
    if (difficulty === 2) {
      const kind = rng.pick(['홀짝', '배수', '소수'] as const)
      if (kind === '소수') return decimalCount(rng, difficulty)
      return basic(rng, difficulty, kind)
    }
    return rng.bool(0.5) ? overlap(rng, difficulty) : inverse(rng, difficulty)
  },
}
