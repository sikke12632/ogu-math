/**
 * 세션 만들기 — 단원 → 게임 → 세부 설정 → 명단.
 *
 * 단원·게임이 지금은 각 1개뿐이지만 선택 UI 를 처음부터 만든다.
 * 나중에 추가할 때 화면을 고칠 일이 없게.
 */

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { listGames } from '../../games'
import { isFirebaseConfigured } from '../../lib/firebase'
import { load, save } from '../../lib/storage'
import { createSession } from '../../session/api'
import { getUnit, listUnitsByGrade } from '../../units'

const DEFAULT_NAMES = Array.from({ length: 25 }, (_, i) => `${i + 1}번`).join('\n')

export function TeacherHome() {
  const nav = useNavigate()
  const grades = listUnitsByGrade()
  const games = listGames()

  const [unitId, setUnitId] = useState('5-2-1')
  const [gameId, setGameId] = useState(games[0]?.id ?? 'draw-duel')
  const [minutes, setMinutes] = useState(8)
  const [rounds, setRounds] = useState(3)
  const [roster, setRoster] = useState(() => load<string>('roster', DEFAULT_NAMES))
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const names = roster
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)

  const start = async (): Promise<void> => {
    setError(null)
    if (names.length < 2) {
      setError('명단에 이름이 2명 이상 있어야 합니다.')
      return
    }
    if (new Set(names).size !== names.length) {
      setError('명단에 같은 이름이 두 번 있습니다. 이름 뒤에 번호를 붙여 구분해 주세요.')
      return
    }
    setBusy(true)
    try {
      save('roster', roster)
      const seed = `${unitId}-${Date.now()}`
      const problems = getUnit(unitId).generate(seed, {
        unit: unitId,
        counts: { easy: 3, mid: 4, hard: 2 },
      })
      const { sessionId } = await createSession({
        unitId,
        gameId,
        quizSeconds: minutes * 60,
        rounds,
        problems,
        names,
      })
      nav(`/teacher/s/${sessionId}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setBusy(false)
    }
  }

  if (!isFirebaseConfigured()) {
    return (
      <div className="wrap">
        <h1>설정이 필요합니다</h1>
        <p className="notice error">
          Firebase 설정값이 없습니다. 프로젝트 폴더의 <code>.env.local</code> 을 확인하세요
          (<code>.env.example</code> 참고). 값을 넣은 뒤 개발 서버를 다시 켜야 반영됩니다.
        </p>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="site-head">
        <p className="eyebrow">교사용</p>
        <h1>수업 시작하기</h1>
        <p className="sub">단원과 게임을 고르고 세션을 만듭니다. 학생에게는 QR과 6자리 코드가 나갑니다.</p>
      </header>

      {error && <p className="notice error">{error}</p>}

      <div className="form">
        <label>
          <span>1. 단원</span>
          <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
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
          <select value={gameId} onChange={(e) => setGameId(e.target.value)}>
            {games.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        </label>
        <p className="hint">{games.find((g) => g.id === gameId)?.tagline}</p>

        <div className="form-row">
          <label>
            <span>풀이 시간</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[5, 6, 8, 10, 12, 15].map((m) => (
                <option key={m} value={m}>
                  {m}분
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>게임 판 수</span>
            <select value={rounds} onChange={(e) => setRounds(Number(e.target.value))}>
              {[2, 3, 4].map((r) => (
                <option key={r} value={r}>
                  {r}판
                </option>
              ))}
            </select>
          </label>
        </div>

        <label>
          <span>3. 명단 — 한 줄에 한 명 ({names.length}명)</span>
          <textarea
            rows={8}
            value={roster}
            onChange={(e) => setRoster(e.target.value)}
            spellCheck={false}
          />
        </label>
        <p className="hint">
          한 번 넣으면 이 컴퓨터에 저장됩니다. 다음 수업부터는 그대로 씁니다.
          <br />
          학생은 이 명단에서 <b>자기 이름을 골라</b> 들어오고, 들어온 뒤
          <b> 그날 쓸 별명</b>을 따로 정합니다. 칠판과 친구들 화면에는 별명이,
          선생님 화면과 오답 기록에는 <b>실제 이름</b>이 나옵니다.
        </p>
      </div>

      <button className="primary big" onClick={() => void start()} disabled={busy}>
        {busy ? '만드는 중…' : '세션 만들기'}
      </button>
    </div>
  )
}
