/**
 * 골든 스냅샷. 회귀 검사용.
 *
 *   npm run snapshot:save   — 지금 뽑히는 문항을 기준으로 저장 (STEP 4 검수를 통과한 뒤에만)
 *   npm run snapshot:check  — 코드를 고친 뒤, 문항이 달라졌는지 확인
 *
 * 달라졌다고 해서 무조건 잘못은 아니다. "의도한 변경인가"를 사람이 판단한다.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { generateSet } from '../src/units/5-2-1'
import type { Problem } from '../src/units/_types'

const FILE = 'snapshot/golden.json'
const SEEDS = Array.from({ length: 12 }, (_, i) => `golden-${i}`)
const CONFIG = { unit: '5-2-1', counts: { easy: 3, mid: 4, hard: 2 } }

function build(): Record<string, Problem[]> {
  const out: Record<string, Problem[]> = {}
  for (const s of SEEDS) out[s] = generateSet(s, CONFIG)
  return out
}

const mode = process.argv[2]

if (mode === 'save') {
  mkdirSync('snapshot', { recursive: true })
  writeFileSync(FILE, JSON.stringify(build(), null, 2), 'utf8')
  const count = SEEDS.length * (CONFIG.counts.easy + CONFIG.counts.mid + CONFIG.counts.hard)
  console.log(`${FILE} 에 ${SEEDS.length}세트 ${count}문항을 저장했습니다.`)
  console.log('이제부터 코드를 고치면 npm run snapshot:check 로 달라진 곳을 볼 수 있습니다.')
} else if (mode === 'check') {
  if (!existsSync(FILE)) {
    console.log(`${FILE} 이 없습니다. 먼저 npm run snapshot:save 를 하세요.`)
    process.exit(1)
  }
  const before = JSON.parse(readFileSync(FILE, 'utf8')) as Record<string, Problem[]>
  const after = build()
  let changed = 0
  for (const seed of SEEDS) {
    const a = before[seed] ?? []
    const b = after[seed] ?? []
    for (let i = 0; i < Math.max(a.length, b.length); i++) {
      const x = a[i]
      const y = b[i]
      if (JSON.stringify(x) === JSON.stringify(y)) continue
      changed++
      console.log(`\n[${seed} · ${i + 1}번] 달라졌습니다`)
      console.log(`  전: ${x ? x.prompt.replace(/\n/g, ' ⏎ ') : '(없음)'}`)
      console.log(`      정답 ${x ? x.answer : '-'}`)
      console.log(`  후: ${y ? y.prompt.replace(/\n/g, ' ⏎ ') : '(없음)'}`)
      console.log(`      정답 ${y ? y.answer : '-'}`)
    }
  }
  if (changed === 0) {
    console.log('스냅샷과 같습니다. 회귀 없음.')
  } else {
    console.log(`\n${changed}문항이 달라졌습니다. 의도한 변경이면 npm run snapshot:save 로 갱신하세요.`)
    process.exitCode = 1
  }
} else {
  console.log('사용법: npm run snapshot:save  |  npm run snapshot:check')
  process.exitCode = 1
}
