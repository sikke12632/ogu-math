/**
 * 게임 레지스트리.
 * 새 게임 추가 = 폴더 하나 + 여기에 한 줄.
 */

import type { GameModule } from './_types'
import drawDuel from './draw-duel'

const registry = new Map<string, GameModule>()

export function registerGame(g: GameModule): void {
  if (registry.has(g.id)) throw new Error(`게임 id 중복: ${g.id}`)
  registry.set(g.id, g)
}

registerGame(drawDuel)

export function getGame(id: string): GameModule {
  const g = registry.get(id)
  if (!g) throw new Error(`등록되지 않은 게임: ${id}`)
  return g
}

export function listGames(): GameModule[] {
  return [...registry.values()]
}

export * from './_types'
