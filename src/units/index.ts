/**
 * 단원 레지스트리.
 * 새 단원 추가 = 파일 하나 추가 + 여기에 한 줄. 다른 코드는 건드리지 않는다.
 * 단원 추가가 코어 코드 수정을 요구하면 인터페이스가 잘못된 것이다. 멈추고 보고할 것.
 */

import type { UnitModule } from './_types'
import unit521 from './5-2-1'
import unit522 from './5-2-2'

const registry = new Map<string, UnitModule>()

export function registerUnit(u: UnitModule): void {
  if (registry.has(u.id)) throw new Error(`단원 id 중복: ${u.id}`)
  registry.set(u.id, u)
}

registerUnit(unit521)
registerUnit(unit522)

export function getUnit(id: string): UnitModule {
  const u = registry.get(id)
  if (!u) throw new Error(`등록되지 않은 단원: ${id}`)
  return u
}

export function listUnits(): UnitModule[] {
  return [...registry.values()].sort((a, b) =>
    a.grade - b.grade || a.semester - b.semester || a.unit - b.unit,
  )
}

/** 교사 콘솔의 2단 드롭다운(학년 → 단원)용 */
export function listUnitsByGrade(): { grade: number; units: UnitModule[] }[] {
  const byGrade = new Map<number, UnitModule[]>()
  for (const u of listUnits()) {
    const arr = byGrade.get(u.grade) ?? []
    arr.push(u)
    byGrade.set(u.grade, arr)
  }
  return [...byGrade.entries()].sort((a, b) => a[0] - b[0]).map(([grade, units]) => ({ grade, units }))
}

export * from './_types'
