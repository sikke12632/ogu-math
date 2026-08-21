/** 템플릿들이 함께 쓰는 잡다한 도우미. 수학 규칙이 아니라 문장·보기 조립용이다. */

import type { Rng } from '../lib/rng'
import { g4_choicesDistinct } from './_guards'

/** 받침 여부에 따라 조사를 고른다. '서연이는' / '지호는' */
export function josa(word: string, withBatchim: string, withoutBatchim: string): string {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return withoutBatchim
  return (last - 0xac00) % 28 !== 0 ? withBatchim : withoutBatchim
}

/**
 * 숫자 뒤에 붙는 조사. **읽는 소리**의 받침으로 정해진다.
 *   47 → 사십칠 → 받침 ㄹ → "47과", "47은"
 *   44 → 사십사 → 받침 없음 → "44와", "44는"
 * 끝자리가 0이면 십·백·천·만으로 읽히므로 모두 받침이 있다.
 */
export function numJosa(n: number | string, withBatchim: string, withoutBatchim: string): string {
  const digits = String(n).replace(/[^0-9]/g, '')
  const last = digits.slice(-1)
  return '013678'.includes(last) ? withBatchim : withoutBatchim
}

/** '(으)로' 조사. ㄹ 받침이면 '로' 를 쓴다 — 대기실로, 서울로 */
export function josaRo(word: string): string {
  const last = word.charCodeAt(word.length - 1)
  if (last < 0xac00 || last > 0xd7a3) return '로'
  const jong = (last - 0xac00) % 28
  return jong === 0 || jong === 8 ? '로' : '으로'
}

export const NAMES = [
  '지호', '서연', '민준', '하윤', '도윤',
  '시우', '예은', '지우', '하준', '수아',
  '유주', '건우', '나은', '태윤', '소율',
] as const

export function pickNames(rng: Rng, n: number): string[] {
  return rng.shuffle(NAMES).slice(0, n)
}

/**
 * 정답 1개 + 오답 후보로 보기 4개를 만든다.
 * 값이 겹치면(G4) null 을 돌려주고 호출한 쪽이 재시도한다.
 */
export function buildChoices(
  rng: Rng,
  correct: string,
  distractors: string[],
  count = 4,
): string[] | null {
  const pool = [...new Set(distractors)].filter((d) => d !== correct)
  if (pool.length < count - 1) return null
  const all = rng.shuffle([correct, ...rng.shuffle(pool).slice(0, count - 1)])
  return g4_choicesDistinct(all) ? all : null
}

export const TERMS = ['이상', '이하', '초과', '미만'] as const
export type Term = (typeof TERMS)[number]

/** 어떤 수가 그 범위에 속하는지 */
export function satisfies(v: number, boundary: number, term: Term): boolean {
  switch (term) {
    case '이상': return v >= boundary
    case '이하': return v <= boundary
    case '초과': return v > boundary
    case '미만': return v < boundary
  }
}

/** 수직선 표기 → 말. filled=● 는 포함, hollow=○ 는 포함하지 않음 */
export function termOf(side: 'left' | 'right', type: 'filled' | 'hollow'): Term {
  if (side === 'right') return type === 'filled' ? '이상' : '초과'
  return type === 'filled' ? '이하' : '미만'
}

export function markOf(term: Term): 'filled' | 'hollow' {
  return term === '이상' || term === '이하' ? 'filled' : 'hollow'
}
