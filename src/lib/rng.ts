/**
 * 시드 기반 난수. 같은 시드면 항상 같은 결과가 나온다(재현성).
 * Math.random() 을 쓰면 같은 세션을 다시 열 때 문제가 달라져 검수가 불가능해진다.
 */

function hashSeed(str: string): number {
  let h = 1779033703 ^ str.length
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
    h = (h << 13) | (h >>> 19)
  }
  return (h ^ (h >>> 16)) >>> 0
}

export type Rng = {
  /** 0 이상 1 미만 */
  next(): number
  /** min 이상 max 이하의 정수 */
  int(min: number, max: number): number
  /** 배열에서 하나 고르기 */
  pick<T>(arr: readonly T[]): T
  /** 가중치를 준 선택. [값, 가중치] 목록 */
  weighted<T>(entries: readonly (readonly [T, number])[]): T
  /** 원본을 건드리지 않는 셔플 */
  shuffle<T>(arr: readonly T[]): T[]
  /** 확률 p 로 true */
  bool(p?: number): boolean
}

export function makeRng(seed: string): Rng {
  let a = hashSeed(seed)
  const next = (): number => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  const rng: Rng = {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => {
      if (arr.length === 0) throw new Error('pick: 빈 배열')
      return arr[Math.floor(next() * arr.length)]!
    },
    weighted: (entries) => {
      const total = entries.reduce((s, [, w]) => s + w, 0)
      let r = next() * total
      for (const [v, w] of entries) {
        r -= w
        if (r <= 0) return v
      }
      return entries[entries.length - 1]![0]
    },
    shuffle: (arr) => {
      const out = [...arr]
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1))
        ;[out[i], out[j]] = [out[j]!, out[i]!]
      }
      return out
    },
    bool: (p = 0.5) => next() < p,
  }
  return rng
}
