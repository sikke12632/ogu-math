/**
 * 문제·게임 설정 — 단원, 게임, 풀이 시간, 판 수, 출제 범위, 문항 수, 난이도.
 *
 * **세션 만들기와 "한 판 더" 가 같이 쓴다.** 한 판을 끝내고 다시 시작할 때도
 * 교사는 이 값들을 전부 다시 만질 수 있어야 한다. 폼이 두 벌이면 한쪽에만
 * 항목이 생기는 날이 반드시 온다. 명단만 여기 없다 — 다시 시작할 때는 안 바뀐다.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { listGames } from '../../games'
import { load, save } from '../../lib/storage'
import { getUnit, listUnitsByGrade } from '../../units'
import { levelsOf, MIXES, planCounts, scoreOf, totalOf, weightOf, type Counts, type Mix } from '../../units/_plan'
import type { Problem, TopicInfo } from '../../units/_types'
import { TopicPicker } from './TopicPicker'

/**
 * 지난 설정을 담아 두는 곳. **기본값을 바꾸면 이 이름도 바꿔야 한다** —
 * 저장된 값이 기본값보다 앞서기 때문에, 판 수 기본을 3 에서 5 로 올렸을 때
 * 이미 3 이 저장된 컴퓨터에서는 계속 3 이 나왔다.
 */
const SETUP_KEY = 'setup2'

type Saved = {
  unitId: string
  gameId: string
  minutes: number
  rounds: number
  count: number
  mix: Mix
  topicIds: string[]
}

export type QuizSetupState = Saved & {
  topics: TopicInfo[]
  counts: Counts
  planned: number
  set: <K extends keyof Saved>(key: K, value: Saved[K]) => void
  /** 지금 설정으로 문항을 뽑는다. 못 뽑으면 이유를 던진다 */
  build: () => Problem[]
}

/**
 * @param init 이 값들이 저장된 지난 설정보다 앞선다. "한 판 더" 는 방금 끝난 판의
 *             단원·게임·시간을 그대로 이어받아야 해서 필요하다
 */
export function useQuizSetup(init?: Partial<Saved>): QuizSetupState {
  const games = listGames()
  const [v, setV] = useState<Saved>(() => ({
    unitId: '5-2-1',
    gameId: games[0]?.id ?? 'draw-duel',
    minutes: 8,
    rounds: 5,
    count: 9,
    mix: 'normal' as Mix,
    topicIds: [],
    ...load<Partial<Saved>>(SETUP_KEY, {}),
    ...init,
  }))

  const topics = useMemo(() => {
    try {
      return getUnit(v.unitId).topics()
    } catch {
      return []
    }
  }, [v.unitId])

  // 단원이 바뀌면 출제 범위를 그 단원 전체로 되돌린다.
  // **처음 한 번은 예외다** — 지난번에 고른 범위가 이 단원 것이면 그대로 살린다
  const first = useRef(true)
  useEffect(() => {
    const all = topics.map((t) => t.id)
    setV((cur) => {
      const kept = first.current ? cur.topicIds.filter((id) => all.includes(id)) : []
      first.current = false
      return { ...cur, topicIds: kept.length > 0 ? kept : all }
    })
  }, [topics])

  const counts = planCounts(levelsOf(topics, v.topicIds), v.count, weightOf(v.mix))

  return {
    ...v,
    topics,
    counts,
    planned: totalOf(counts),
    set: (key, value) => setV((cur) => ({ ...cur, [key]: value })),
    build: () => {
      if (v.topicIds.length === 0) throw new Error('출제 범위를 하나 이상 골라 주세요.')
      const problems = getUnit(v.unitId).generate(`${v.unitId}-${Date.now()}`, {
        unit: v.unitId,
        counts,
        templateIds: v.topicIds,
      })
      save(SETUP_KEY, v)
      return problems
    },
  }
}

export function QuizSetupFields({ s }: { s: QuizSetupState }) {
  const grades = listUnitsByGrade()
  const games = listGames()

  return (
    <>
      <label>
        <span>1. 단원</span>
        <select value={s.unitId} onChange={(e) => s.set('unitId', e.target.value)}>
          {grades.map((g) => (
            <optgroup key={g.grade} label={`${g.grade}학년`}>
              {g.units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.semester}-{u.unit}. {u.name}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </label>

      <label>
        <span>2. 게임</span>
        <select value={s.gameId} onChange={(e) => s.set('gameId', e.target.value)}>
          {games.map((g) => (
            <option key={g.id} value={g.id}>
              {g.name}
            </option>
          ))}
        </select>
      </label>
      <p className="hint">{games.find((g) => g.id === s.gameId)?.tagline}</p>

      <div className="form-row">
        <label>
          <span>풀이 시간</span>
          <select value={s.minutes} onChange={(e) => s.set('minutes', Number(e.target.value))}>
            {[5, 6, 8, 10, 12, 15].map((m) => (
              <option key={m} value={m}>
                {m}분
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>게임 판 수</span>
          <select value={s.rounds} onChange={(e) => s.set('rounds', Number(e.target.value))}>
            {[2, 3, 4, 5, 6].map((r) => (
              <option key={r} value={r}>
                {r}판
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="pick">
        <legend>3. 출제 범위 — 오늘 배운 것만 고르세요</legend>
        <TopicPicker
          unitId={s.unitId}
          topics={s.topics}
          selected={s.topicIds}
          onChange={(ids) => s.set('topicIds', ids)}
        />
      </fieldset>

      <div className="form-row">
        <label>
          <span>문항 수</span>
          <select value={s.count} onChange={(e) => s.set('count', Number(e.target.value))}>
            {[4, 5, 6, 7, 8, 9, 10, 12].map((n) => (
              <option key={n} value={n}>
                {n}문항
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>난이도</span>
          <select value={s.mix} onChange={(e) => s.set('mix', e.target.value as Mix)}>
            {MIXES.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="planbox">
        <span>이렇게 나옵니다</span>
        <b>
          {s.planned === 0
            ? '출제 범위를 골라 주세요'
            : `${s.planned}문항 · ${scoreOf(s.counts)}점 만점`}
        </b>
        {s.planned > 0 && (
          <span className="planmix">
            하 {s.counts.easy} · 중 {s.counts.mid} · 상 {s.counts.hard}
            {s.planned !== s.count && ' (고른 범위에 맞춰 조정됨)'}
          </span>
        )}
      </div>
    </>
  )
}
