/**
 * T2 — 수직선 ↔ 범위. 시각 표현과 언어 표현을 서로 옮긴다. [6수01-02]
 * params: direction(수직선→말·말→수직선) / boundary(한쪽·양쪽)
 *
 * 경계값은 **반드시 눈금 위에 놓여야 한다.** 눈금 간격을 한 번 정한 뒤
 * 그 배수로만 경계값을 잡는다. (docs/수직선_렌더러_검증.html 의 검수 기준)
 */

import type { Rng } from '../../lib/rng'
import type { Draft, Difficulty, NumberLineSpec, Template, Visual } from '../_types'
import { fmt } from '../_guards'
import { markOf, numJosa, TERMS, type Term } from '../_helpers'

type Axis = { min: number; max: number; step: number }

/** 눈금이 11개를 넘지 않게 축을 잡는다. 교실 뒤에서도 읽혀야 한다 */
function axis(step: number, lo: number, hi: number): Axis {
  return {
    min: Math.floor((lo - step * 2) / step) * step,
    max: Math.ceil((hi + step * 2) / step) * step,
    step,
  }
}

function oneSide(a: number, term: Term, ax: Axis): NumberLineSpec {
  return {
    ...ax,
    marks: [{ at: a, type: markOf(term) }],
    ray: term === '이상' || term === '초과' ? 'right' : 'left',
  }
}

function bothSides(a: number, b: number, t1: Term, t2: Term, ax: Axis): NumberLineSpec {
  return {
    ...ax,
    marks: [
      { at: a, type: markOf(t1) },
      { at: b, type: markOf(t2) },
    ],
  }
}

const LOW_TERMS: Term[] = ['이상', '초과']
const HIGH_TERMS: Term[] = ['이하', '미만']

/** 눈금 간격과 그 배수인 경계값을 함께 뽑는다 */
function pickBase(rng: Rng): { step: number; base: number } {
  const step = rng.pick([1, 1, 2, 5, 10])
  const scale = step === 1 ? rng.pick([1, 1, 10]) : 1
  return { step, base: rng.int(3, 14) * step * scale }
}

/** 수직선을 보고 말로 고르기 */
function lineToWords(rng: Rng, difficulty: Difficulty): Draft {
  const { step, base } = pickBase(rng)

  if (difficulty === 1) {
    const term = rng.pick(TERMS)
    const ax = axis(step, base, base)
    const label = (t: Term) => `${fmt(base)} ${t}인 수`
    return {
      templateId: 'T2',
      params: { direction: '수직선→말', boundary: '한쪽' },
      difficulty,
      prompt: '수직선에 나타낸 수의 범위를 바르게 말한 것은 어느 것인가요?',
      visual: { kind: 'numberline', spec: oneSide(base, term, ax) },
      choices: rng.shuffle(TERMS.map(label)),
      answer: label(term),
      explanation:
        `점이 ${fmt(base)}에 ${markOf(term) === 'filled' ? '색칠되어(●) 있으므로 ' + fmt(base) + numJosa(base, '을', '를') + ' 포함하고' : '색칠되지 않아(○) 있으므로 ' + fmt(base) + numJosa(base, '을', '를') + ' 포함하지 않고'}, ` +
        `선이 ${term === '이상' || term === '초과' ? '오른쪽' : '왼쪽'}으로 뻗어 있습니다.\n따라서 ${label(term)}입니다.`,
      standard: '6수01-02',
    }
  }

  const a = base
  const b = base + rng.int(2, 5) * step
  const t1 = rng.pick(LOW_TERMS)
  const t2 = rng.pick(HIGH_TERMS)
  const ax = axis(step, a, b)
  const label = (x: Term, y: Term) => `${fmt(a)} ${x} ${fmt(b)} ${y}인 수`
  const all: string[] = []
  for (const x of LOW_TERMS) for (const y of HIGH_TERMS) all.push(label(x, y))

  return {
    templateId: 'T2',
    params: { direction: '수직선→말', boundary: '양쪽' },
    difficulty,
    prompt: '수직선에 나타낸 수의 범위를 바르게 말한 것은 어느 것인가요?',
    visual: { kind: 'numberline', spec: bothSides(a, b, t1, t2, ax) },
    choices: rng.shuffle(all),
    answer: label(t1, t2),
    explanation:
      `${fmt(a)} 쪽 점은 ${markOf(t1) === 'filled' ? '●라서 포함합니다(이상)' : '○라서 포함하지 않습니다(초과)'}. ` +
      `${fmt(b)} 쪽 점은 ${markOf(t2) === 'filled' ? '●라서 포함합니다(이하)' : '○라서 포함하지 않습니다(미만)'}.\n` +
      `따라서 ${label(t1, t2)}입니다.`,
    standard: '6수01-02',
  }
}

/** 말을 보고 수직선 고르기. 보기가 그림이라 choiceVisuals 를 쓴다 */
function wordsToLine(rng: Rng, difficulty: Difficulty): Draft {
  const { step, base } = pickBase(rng)
  const labels = ['가', '나', '다', '라']
  const two = difficulty >= 2 && rng.bool(0.5)

  let specs: NumberLineSpec[]
  let correctIndex: number
  let text: string

  if (!two) {
    const ax = axis(step, base, base)
    const order = rng.shuffle(TERMS)
    specs = order.map((t) => oneSide(base, t, ax))
    const term = rng.pick(TERMS)
    correctIndex = order.indexOf(term)
    text = `${fmt(base)} ${term}인 수`
  } else {
    const a = base
    const b = base + rng.int(2, 4) * step
    const ax = axis(step, a, b)
    const combos: [Term, Term][] = []
    for (const x of LOW_TERMS) for (const y of HIGH_TERMS) combos.push([x, y])
    const order = rng.shuffle(combos)
    specs = order.map(([x, y]) => bothSides(a, b, x, y, ax))
    correctIndex = rng.int(0, 3)
    const [x, y] = order[correctIndex]!
    text = `${fmt(a)} ${x} ${fmt(b)} ${y}인 수`
  }

  const choiceVisuals: Visual[] = specs.map((spec) => ({ kind: 'numberline', spec }))
  return {
    templateId: 'T2',
    params: { direction: '말→수직선', boundary: two ? '양쪽' : '한쪽' },
    difficulty,
    prompt: `${text}를 수직선에 바르게 나타낸 것은 어느 것인가요?`,
    choices: labels,
    choiceVisuals,
    answer: labels[correctIndex]!,
    explanation:
      '포함하는 수에는 색칠한 점(●), 포함하지 않는 수에는 색칠하지 않은 점(○)을 찍습니다.\n' +
      `${text}를 바르게 나타낸 것은 ${labels[correctIndex]}입니다.`,
    standard: '6수01-02',
  }
}

export const T2: Template = {
  id: 'T2',
  name: '수직선 ↔ 범위',
  supports: [1, 2],
  family: 'range',
  generate(rng, difficulty) {
    return rng.bool(0.55) ? lineToWords(rng, difficulty) : wordsToLine(rng, difficulty)
  },
}
