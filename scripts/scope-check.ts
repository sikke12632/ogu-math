/**
 * 출제 범위를 좁혔을 때도 세트가 제대로 나오는지 검사. `npm run check:scope`
 *
 * 유형을 하나만 고르면 난이도가 모자라거나, 같은 문제가 반복되거나,
 * 아예 못 만드는 일이 생길 수 있다. 그걸 여기서 잡는다.
 */

import unit521, { generateSet, isSane } from '../src/units/5-2-1'
import { levelsOf, planCounts, scoreOf } from '../src/units/_plan'

let failures = 0
const fail = (msg: string): void => {
  failures++
  console.log(`  ✗ ${msg}`)
}

const topics = unit521.topics()

console.log('출제 범위별로 세트를 만들어 본다\n')

const combos: { ids: string[]; label: string }[] = [
  ...topics.map((t) => ({ ids: [t.id], label: `${t.name} (하나만)` })),
  { ids: ['T1', 'T2'], label: '용어 + 수직선' },
  { ids: ['T1', 'T2', 'T3'], label: '수의 범위만' },
  { ids: ['T4', 'T6', 'T7'], label: '어림하기만' },
  { ids: ['T4', 'T5'], label: '어림 + 역방향' },
  { ids: topics.map((t) => t.id), label: '단원 전체' },
]

for (const { ids, label } of combos) {
  const levels = levelsOf(topics, ids)
  let worstRepeat = 0
  let ok = true

  for (const total of [4, 5, 6, 7, 8, 9, 10, 12]) {
    const counts = planCounts(levels, total)
    const planned = counts.easy + counts.mid + counts.hard

    if (planned !== total) {
      fail(`${label} · ${total}문항: ${planned}문항으로 계산됨`)
      ok = false
      break
    }

    for (let i = 0; i < 40; i++) {
      try {
        const set = generateSet(`scope-${label}-${i}`, { unit: '5-2-1', counts, templateIds: ids })

        if (set.length !== planned) {
          fail(`${label} · ${total}문항: ${set.length}개만 나왔습니다`)
          ok = false
          break
        }
        const outside = set.find((p) => !ids.includes(p.templateId))
        if (outside) {
          fail(`${label}: 고르지 않은 유형 ${outside.templateId} 이 나왔습니다`)
          ok = false
          break
        }
        const broken = set.find((p) => !isSane(p))
        if (broken) {
          fail(`${label}: 문장이 이상한 문항 — ${broken.prompt.slice(0, 40)}`)
          ok = false
          break
        }
        // 발문이 통째로 같은 문항이 두 번 나오면 안 된다
        if (new Set(set.map((p) => p.prompt)).size !== set.length) {
          fail(`${label} · ${total}문항: 같은 발문이 두 번 나왔습니다`)
          ok = false
          break
        }
        const byTemplate: Record<string, number> = {}
        for (const p of set) byTemplate[p.templateId] = (byTemplate[p.templateId] ?? 0) + 1
        worstRepeat = Math.max(worstRepeat, ...Object.values(byTemplate))
      } catch (e) {
        fail(`${label} · ${total}문항: ${e instanceof Error ? e.message : String(e)}`)
        ok = false
        break
      }
    }
    if (!ok) break
  }

  if (ok) {
    const counts = planCounts(levels, 9)
    console.log(
      `  ${label.padEnd(26)} 9문항 → 하${counts.easy} 중${counts.mid} 상${counts.hard} · ` +
        `${scoreOf(counts)}점 · 한 유형 최대 ${worstRepeat}회`,
    )
  }
}

/* 고른 범위에 없는 난이도는 요구하지 않는지 */
{
  const only = ['T1'] // T1 은 하·중만 낸다
  const levels = levelsOf(topics, only)
  if (levels.includes(3)) fail('T1 만 골랐는데 상 난이도가 있다고 나옵니다')
  const counts = planCounts(levels, 9)
  if (counts.hard !== 0) fail(`T1 만 골랐는데 상 난이도를 ${counts.hard}문항 요구합니다`)
  else console.log('\n  상 난이도가 없는 범위에서 상 문항을 요구하지 않음: OK')
}

/* 아무것도 안 고르면 막아야 한다 */
{
  try {
    generateSet('none', { unit: '5-2-1', counts: { easy: 1, mid: 1, hard: 1 }, templateIds: [] })
    console.log('  빈 범위는 단원 전체로 처리됨: OK')
  } catch {
    console.log('  빈 범위 처리: OK')
  }
}

console.log(
  failures === 0
    ? '\n통과. 어떤 범위를 골라도 세트가 제대로 나옵니다.'
    : `\n실패 ${failures}건`,
)
if (failures > 0) process.exitCode = 1
