/**
 * 채점. Firebase 를 모른다 — 학생 혼자 푸는 화면과 세션 화면이 같은 함수를 쓴다.
 */

import { makeRng } from '../lib/rng'
import type { Problem, Visual } from '../units/_types'

export type Answer = string | string[] | null

/** 단답형 비교용 정리. 공백·쉼표·단위를 떼고, 숫자면 숫자로 견준다 */
function normalize(s: string): string {
  const t = s
    .trim()
    .replace(/\s+/g, '')
    .replace(/,/g, '')
    .replace(/(개|명|대|장|상자|원|권|묶음|cm|kg|km|초)$/u, '')
  const n = Number(t)
  return Number.isFinite(n) && t !== '' ? String(n) : t
}

export function isCorrect(problem: Problem, given: Answer): boolean {
  if (given === null) return false
  if (Array.isArray(problem.answer)) {
    const g = Array.isArray(given) ? given : [given]
    const a = new Set(problem.answer.map(normalize))
    const b = new Set(g.map(normalize))
    if (a.size !== b.size) return false
    for (const v of a) if (!b.has(v)) return false
    return true
  }
  const g = Array.isArray(given) ? given[0] ?? '' : given
  return normalize(g) === normalize(problem.answer)
}

export type GradedItem = {
  problem: Problem
  given: Answer
  correct: boolean
  earned: number
}

export type Result = {
  items: GradedItem[]
  score: number
  total: number
  correctCount: number
  count: number
}

export function grade(problems: Problem[], answers: Record<string, Answer>): Result {
  const items = problems.map((p) => {
    const given = answers[p.id] ?? null
    const correct = isCorrect(p, given)
    return { problem: p, given, correct, earned: correct ? p.points : 0 }
  })
  return {
    items,
    score: items.reduce((s, i) => s + i.earned, 0),
    total: problems.reduce((s, p) => s + p.points, 0),
    correctCount: items.filter((i) => i.correct).length,
    count: problems.length,
  }
}

/**
 * 보기 순서를 학생마다 섞는다 (설계보고서 1.8).
 * 문제 자체는 반 전체가 같고, 보기 순서만 다르다. 옆자리 답 베끼기를 이걸로 막는다.
 */
export function shuffleChoices(problem: Problem, studentSeed: string): Problem {
  if (!problem.choices) return problem
  const rng = makeRng(`${studentSeed}|${problem.id}`)
  const idx = rng.shuffle(problem.choices.map((_, i) => i))
  const choices = idx.map((i) => problem.choices![i]!)
  const choiceVisuals: Visual[] | undefined = problem.choiceVisuals
    ? idx.map((i) => problem.choiceVisuals![i]!)
    : undefined
  return choiceVisuals ? { ...problem, choices, choiceVisuals } : { ...problem, choices }
}
