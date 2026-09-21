/**
 * 세트 구성 계산.
 *
 * 출제 범위를 좁히면 난이도 구성이 그대로일 수 없다.
 * 예를 들어 '이상·이하·초과·미만' 만 고르면 그 유형에는 상 난이도가 없어서
 * 하3·중4·상2 를 채울 수가 없다. 고른 유형이 낼 수 있는 난이도만 가지고
 * 비율을 다시 나눈다.
 */

import type { Difficulty, TopicInfo } from './_types'

/** 기본 비율 하3 : 중4 : 상2 (설계보고서 1.5) */
const WEIGHT: Record<Difficulty, number> = { 1: 3, 2: 4, 3: 2 }

/**
 * 난이도 구성 — 교사가 세션을 만들 때 고른다.
 *
 * 비율이 0 인 난이도는 **아예 안 낸다.** '아주 어렵게' 에 하 문항이 없는 것이 그래서다.
 * 다만 고른 출제 범위가 그 난이도밖에 못 내면(하만 있는 유형 하나를 골랐을 때)
 * 0 을 무시하고 낼 수 있는 것으로 채운다 — 빈 세트보다는 낫다.
 */
export type Mix = 'easy' | 'normal' | 'hard' | 'hardest'

export const MIXES: { id: Mix; label: string; weight: Record<Difficulty, number> }[] = [
  { id: 'easy', label: '쉽게', weight: { 1: 5, 2: 3, 3: 1 } },
  { id: 'normal', label: '보통', weight: WEIGHT },
  { id: 'hard', label: '어렵게', weight: { 1: 1, 2: 3, 3: 5 } },
  { id: 'hardest', label: '아주 어렵게 (하 없음)', weight: { 1: 0, 2: 1, 3: 3 } },
]

export const weightOf = (mix: Mix): Record<Difficulty, number> =>
  MIXES.find((m) => m.id === mix)?.weight ?? WEIGHT

export type Counts = { easy: number; mid: number; hard: number }

/** 난이도별 배점 — 하 1점, 중 2점, 상 3점 */
export const POINTS: Record<Difficulty, number> = { 1: 1, 2: 2, 3: 3 }

/**
 * 낼 수 있는 난이도와 총 문항 수로 구성을 정한다.
 * 낼 수 있는 난이도는 최소 1문항씩 넣는다 — 한 난이도만 몰리면 세트가 밋밋해진다.
 */
export function planCounts(
  available: Difficulty[],
  total: number,
  weight: Record<Difficulty, number> = WEIGHT,
): Counts {
  const can = ([1, 2, 3] as Difficulty[]).filter((d) => available.includes(d))
  // 비율이 0 인 난이도는 뺀다. 그랬더니 아무것도 안 남으면 낼 수 있는 것을 그대로 쓴다
  const wanted = can.filter((d) => weight[d] > 0)
  const active = wanted.length > 0 ? wanted : can
  const w: Record<Difficulty, number> = wanted.length > 0 ? weight : { 1: 1, 2: 1, 3: 1 }
  const out: Record<Difficulty, number> = { 1: 0, 2: 0, 3: 0 }
  if (active.length === 0 || total <= 0) return { easy: 0, mid: 0, hard: 0 }

  if (total <= active.length) {
    // 문항이 난이도 수보다 적으면 쉬운 쪽부터 한 개씩
    active.slice(0, total).forEach((d) => (out[d] = 1))
    return { easy: out[1], mid: out[2], hard: out[3] }
  }

  // 먼저 한 개씩 깔고, 남은 것을 비율대로 나눈다 (최대 잔여법)
  active.forEach((d) => (out[d] = 1))
  const rest = total - active.length
  const sum = active.reduce((s, d) => s + w[d], 0)
  const exact = active.map((d) => ({ d, v: (rest * w[d]) / sum }))
  exact.forEach(({ d, v }) => (out[d] += Math.floor(v)))
  let left = rest - exact.reduce((s, { v }) => s + Math.floor(v), 0)
  exact
    .slice()
    .sort((a, b) => (b.v - Math.floor(b.v)) - (a.v - Math.floor(a.v)))
    .forEach(({ d }) => {
      if (left > 0) {
        out[d]++
        left--
      }
    })

  return { easy: out[1], mid: out[2], hard: out[3] }
}

export const totalOf = (c: Counts): number => c.easy + c.mid + c.hard

/** 만점 */
export const scoreOf = (c: Counts): number =>
  c.easy * POINTS[1] + c.mid * POINTS[2] + c.hard * POINTS[3]

/** 고른 유형들이 낼 수 있는 난이도를 모은다 */
export function levelsOf(topics: TopicInfo[], selected: string[]): Difficulty[] {
  const picked = topics.filter((t) => selected.includes(t.id))
  const set = new Set<Difficulty>()
  for (const t of picked) for (const d of t.levels) set.add(d)
  return [...set].sort()
}

/**
 * 한 유형이 한 세트에 몇 번까지 나와도 되는지.
 * 유형을 하나만 골랐으면 어쩔 수 없이 전부 그 유형이다.
 */
export function maxPerTemplate(poolSize: number, total: number): number {
  if (poolSize <= 0) return total
  return Math.max(2, Math.ceil(total / poolSize))
}
