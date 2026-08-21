/**
 * T7 — 어림 방법 간 결과 비교. 세 방법의 결과가 같아지는 조건을 이해한다. [6수01-03]
 * params: pair(올림↔반올림·버림↔반올림·세 방법 전부) / format(같은 것·다른 것)
 *
 * T4 는 어림을 '실행'하는 것이고, T7 은 "어떤 수일 때 결과가 같아지는가" 를 알아야 풀린다.
 *
 * G8 — 여기서는 G1 을 역으로 적용한다. 어림 자리 아래가 전부 0 인 수(Z)를 후보로 쓴다.
 * 다만 Z 는 **어떤 방법으로 어림해도 결과가 같은 수**라서, 넣는 자리를 가려야 한다.
 *
 *   · 세 방법 전부 + '같은 것'  → Z 가 정답 (세 방법이 같아지는 수는 Z 뿐이다)
 *   · 두 방법 + '다른 것'        → Z 는 오답 보기
 *   · 두 방법 + '같은 것'        → **Z 를 넣지 않는다.** 넣으면 정답이 둘이 되고,
 *                                  넣어서 정답으로 삼으면 "동그란 수 고르기" 가 되어 문제가 죽는다.
 *                                  여기서는 "반올림이 올라가느냐" 를 진짜로 판단해야 풀린다.
 */

import type { Draft, Template } from '../_types'
import { estimate, fmt, g8_allBelowZero, PLACE_LABEL, type Method, type PlaceName } from '../_guards'
import { numJosa } from '../_helpers'

type Pair = '올림↔반올림' | '버림↔반올림' | '세 방법 전부'

const PAIR_METHODS: Record<Pair, Method[]> = {
  '올림↔반올림': ['올림', '반올림'],
  '버림↔반올림': ['버림', '반올림'],
  '세 방법 전부': ['올림', '버림', '반올림'],
}

const PLACE_SET: { name: PlaceName; place: number }[] = [
  { name: '십', place: 10 },
  { name: '백', place: 100 },
  { name: '천', place: 1000 },
]

/** 이 수에 대해 해당 방법들의 결과가 모두 같은가 */
function allSame(n: number, place: number, methods: Method[]): boolean {
  const vs = methods.map((m) => estimate(n, place, m))
  return vs.every((v) => v === vs[0])
}

export const T7: Template = {
  id: 'T7',
  name: '어림 방법 간 결과 비교',
  supports: [2, 3],
  family: 'estimate',
  generate(rng, difficulty) {
    const pair = rng.pick(Object.keys(PAIR_METHODS) as Pair[])
    const methods = PAIR_METHODS[pair]
    const po = rng.pick(difficulty === 2 ? PLACE_SET.slice(0, 2) : PLACE_SET.slice(1))

    // 세 방법 전부를 물을 때 '같은' 수는 아래가 모두 0 인 수뿐이다.
    // 이때 '다른 것 고르기' 로 내면 "동그란 수만 빼면 된다" 가 되어 문제가 죽는다.
    const format = pair === '세 방법 전부' ? '같은 것' : rng.pick(['같은 것', '다른 것'] as const)

    const above = rng.int(12, 89)
    const sub = po.place / 10
    const zero = above * po.place // 아래가 모두 0 인 수

    const pool = new Set<number>()
    for (let i = 0; i < 60 && pool.size < 10; i++) {
      const a = above + rng.int(-2, 2)
      if (a < 10) continue
      const d = rng.int(1, 9)
      const n = a * po.place + d * sub + (sub > 1 ? rng.int(0, sub - 1) : 0)
      if (n > 0 && !g8_allBelowZero(n, po.place)) pool.add(n)
    }

    const list = [...pool]
    const same = list.filter((n) => allSame(n, po.place, methods))
    const diff = list.filter((n) => !allSame(n, po.place, methods))

    let correct: number
    let others: number[]
    if (format === '같은 것' && pair === '세 방법 전부') {
      // 세 방법이 모두 같아지는 수는 아래가 모두 0 인 수뿐이다
      if (diff.length < 3) return null
      correct = zero
      others = rng.shuffle(diff).slice(0, 3)
    } else if (format === '같은 것') {
      // 두 방법만 비교할 때는 Z 를 넣으면 정답이 둘이 된다(Z 도 늘 '같은' 수다).
      // 여기서는 Z 를 빼고, "반올림이 올라가느냐/내려가느냐" 를 진짜로 판단하게 한다.
      if (same.length < 1 || diff.length < 3) return null
      correct = rng.pick(same)
      others = rng.shuffle(diff).slice(0, 3)
    } else {
      // '다른 것 고르기' — Z 는 오답 보기로 들어간다 (G8)
      if (same.length < 2 || diff.length < 1) return null
      correct = rng.pick(diff)
      others = [zero, ...rng.shuffle(same).slice(0, 2)]
    }

    const choices = rng.shuffle([correct, ...others]).map(fmt)
    if (new Set(choices).size !== 4) return null

    const methodText =
      pair === '세 방법 전부'
        ? '올림, 버림, 반올림한 결과가 모두'
        : `${methods[0]}한 결과와 ${methods[1]}한 결과가`

    const values = methods.map((m) => `${m} ${fmt(estimate(correct, po.place, m))}`).join(', ')
    const belowDigit = Math.floor((correct % po.place) / sub)

    const subj = `${fmt(correct)}${numJosa(correct, '은', '는')}`
    const roundGoesUp = belowDigit >= 5
    const explanation =
      g8_allBelowZero(correct, po.place)
        ? `${subj} ${PLACE_LABEL[po.name]} 아래가 모두 0입니다.\n` +
          `어림할 것이 없으므로 어떤 방법으로 어림해도 ${fmt(correct)} 그대로입니다.`
        : format === '같은 것'
          ? `${subj} ${values}입니다.\n` +
            `${PLACE_LABEL[po.name]} 바로 아래 자리 숫자가 ${belowDigit}이라서 반올림하면 ${roundGoesUp ? '올라갑니다' : '내려갑니다'}. ` +
            `${methods[0]}${methods[0] === '올림' ? '도 올라가므로' : '도 내려가므로'} 결과가 같습니다.`
          : `${subj} ${values}입니다.\n` +
            `${PLACE_LABEL[po.name]} 바로 아래 자리 숫자가 ${belowDigit}이라서 반올림하면 ${roundGoesUp ? '올라가지만' : '내려가지만'}, ` +
            `${methods[0]}은 ${methods[0] === '올림' ? '무조건 올라가므로' : '무조건 내려가므로'} 결과가 달라집니다.`

    return {
      templateId: 'T7',
      params: { pair, format, place: po.name },
      difficulty,
      prompt:
        `다음 수를 ${PLACE_LABEL[po.name]}까지 나타내려고 합니다.\n` +
        `${methodText} ${format === '같은 것' ? '같은' : '다른'} 수는 어느 것인가요?`,
      choices,
      answer: fmt(correct),
      explanation,
      standard: '6수01-03',
    } satisfies Draft
  },
}
