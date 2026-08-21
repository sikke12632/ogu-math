/**
 * 학생 뷰 단독 — Firebase 없이 혼자 풀고 채점받는 화면.
 * 흐름: 시작 → 풀이(타이머) → 결과 → 틀린 문제 확인
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { load, remove, save } from '../../lib/storage'
import { grade, shuffleChoices, type Answer, type Result } from '../../session/grade'
import { getUnit, listUnitsByGrade } from '../../units'
import type { Problem } from '../../units/_types'
import { QuestionCard } from './QuestionCard'

type Phase = 'intro' | 'quiz' | 'result' | 'review'

const DEFAULT_COUNTS = { easy: 3, mid: 4, hard: 2 }
const DEFAULT_MINUTES = 8

/** 새로고침해도 같은 세트가 나오도록 시드를 저장해 둔다 */
type Saved = { seed: string; name: string; answers: Record<string, Answer>; startedAt: number; minutes: number }

function newSeed(): string {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

function fmtTime(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0')
}

export function Practice() {
  const grades = useMemo(() => listUnitsByGrade(), [])
  const [unitId, setUnitId] = useState('5-2-1')
  const [name, setName] = useState(() => load<string>('name', ''))
  const [minutes, setMinutes] = useState(DEFAULT_MINUTES)

  const [phase, setPhase] = useState<Phase>('intro')
  const [seed, setSeed] = useState('')
  const [problems, setProblems] = useState<Problem[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [cursor, setCursor] = useState(0)
  const [startedAt, setStartedAt] = useState(0)
  const [now, setNow] = useState(Date.now())
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deadline = startedAt + minutes * 60_000
  const left = Math.max(0, deadline - now)

  /* 타이머는 각자 세지 않고 startedAt 에서 계산해 표시만 한다 */
  useEffect(() => {
    if (phase !== 'quiz') return
    const t = setInterval(() => setNow(Date.now()), 250)
    return () => clearInterval(t)
  }, [phase])

  const submit = useCallback(() => {
    setResult(grade(problems, answers))
    setPhase('result')
    remove('progress')
  }, [problems, answers])

  const submitRef = useRef(submit)
  submitRef.current = submit

  /* 시간이 다 되면 저장된 답으로 자동 마감한다. 미제출자도 채점된다 */
  useEffect(() => {
    if (phase === 'quiz' && left === 0 && startedAt > 0) submitRef.current()
  }, [phase, left, startedAt])

  /* 답을 고칠 때마다 localStorage 에 미러링. 새로고침해도 살아남는다 */
  useEffect(() => {
    if (phase !== 'quiz') return
    const id = setTimeout(() => {
      const snapshot: Saved = { seed, name, answers, startedAt, minutes }
      save('progress', snapshot)
    }, 500)
    return () => clearTimeout(id)
  }, [answers, phase, seed, name, startedAt, minutes])

  const build = useCallback(
    (s: string, saved?: Saved) => {
      try {
        const set = getUnit(unitId).generate(s, { unit: unitId, counts: DEFAULT_COUNTS })
        const studentSeed = s + '|' + (name || '학생')
        setProblems(set.map((p) => shuffleChoices(p, studentSeed)))
        setAnswers(saved ? saved.answers : {})
        setStartedAt(saved ? saved.startedAt : Date.now())
        setSeed(s)
        setCursor(0)
        setNow(Date.now())
        setPhase('quiz')
        setError(null)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    },
    [unitId, name],
  )

  const resume = useCallback(() => {
    const saved = load<Saved | null>('progress', null)
    if (!saved) return
    setName(saved.name)
    setMinutes(saved.minutes)
    build(saved.seed, saved)
  }, [build])

  const savedRun = load<Saved | null>('progress', null)

  if (phase === 'intro') {
    return (
      <div className="wrap intro">
        <header className="site-head">
          <p className="eyebrow">혼자 풀기 · 로컬 연습</p>
          <h1>수학 문제 풀기</h1>
          <p className="sub">문제는 풀 때마다 새로 만들어집니다. 같은 문제가 반복되지 않습니다.</p>
        </header>

        {error && <p className="notice error">{error}</p>}

        <div className="form">
          <label>
            <span>이름</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                save('name', e.target.value)
              }}
              placeholder="이름을 쓰세요"
            />
          </label>

          <label>
            <span>단원</span>
            <select value={unitId} onChange={(e) => setUnitId(e.target.value)}>
              {grades.map((g) => (
                <optgroup key={g.grade} label={g.grade + '학년'}>
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
            <span>풀이 시간</span>
            <select value={minutes} onChange={(e) => setMinutes(Number(e.target.value))}>
              {[5, 6, 8, 10, 15].map((m) => (
                <option key={m} value={m}>{m}분</option>
              ))}
            </select>
          </label>
        </div>

        <div className="row">
          <button className="primary big" onClick={() => build(newSeed())}>
            시작하기
          </button>
          {savedRun && (
            <button className="ghost" onClick={resume}>
              풀던 것 이어서 하기
            </button>
          )}
        </div>

        <p className="foot">9문항 · 17점 만점 (1점 3문항, 2점 4문항, 3점 2문항)</p>
      </div>
    )
  }

  if (phase === 'quiz') {
    const p = problems[cursor]!
    const answered = problems.filter((q) => answers[q.id] != null).length
    const warn = left <= 30_000
    return (
      <div className="wrap">
        <div className="topbar">
          <span className={warn ? 'timer warn' : 'timer'}>{fmtTime(left)}</span>
          <span className="progresstext">{answered} / {problems.length} 답함</span>
        </div>
        <div className="progress">
          <div className="progress-fill" style={{ width: (answered / problems.length) * 100 + '%' }} />
        </div>
        {warn && <p className="notice">마감까지 30초 남았습니다. 지금까지 쓴 답으로 채점됩니다.</p>}

        <QuestionCard
          problem={p}
          index={cursor}
          total={problems.length}
          given={answers[p.id] ?? null}
          onChange={(a) => setAnswers((prev) => ({ ...prev, [p.id]: a }))}
        />

        <nav className="pager">
          <button className="ghost" onClick={() => setCursor((c) => Math.max(0, c - 1))} disabled={cursor === 0}>
            이전
          </button>
          <ul className="dots">
            {problems.map((q, i) => (
              <li key={q.id}>
                <button
                  className={[i === cursor ? 'here' : '', answers[q.id] != null ? 'done' : ''].filter(Boolean).join(' ')}
                  onClick={() => setCursor(i)}
                  aria-label={i + 1 + '번으로'}
                >
                  {i + 1}
                </button>
              </li>
            ))}
          </ul>
          <button
            className="ghost"
            onClick={() => setCursor((c) => Math.min(problems.length - 1, c + 1))}
            disabled={cursor === problems.length - 1}
          >
            다음
          </button>
        </nav>

        <button className="primary big" onClick={submit}>
          다 풀었어요 · 제출하기
        </button>
      </div>
    )
  }

  if (phase === 'result' && result) {
    const wrong = result.items.filter((i) => !i.correct)
    return (
      <div className="wrap">
        <div className="scorebox">
          <p className="eyebrow">{name || '학생'}</p>
          <p className="score">
            <strong>{result.score}</strong> / {result.total}점
          </p>
          <p className="sub">{result.count}문항 중 {result.correctCount}문항 맞았습니다.</p>
        </div>
        <div className="row">
          {wrong.length > 0 && (
            <button className="primary big" onClick={() => setPhase('review')}>
              틀린 문제 {wrong.length}개 보기
            </button>
          )}
          <button className="ghost" onClick={() => build(newSeed())}>
            새 문제로 다시 풀기
          </button>
          <button className="ghost" onClick={() => setPhase('intro')}>
            처음으로
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'review' && result) {
    const wrong = result.items.filter((i) => !i.correct)
    return (
      <div className="wrap">
        <header className="site-head">
          <p className="eyebrow">틀린 문제</p>
          <h1>다시 보기</h1>
        </header>
        {wrong.map((item) => (
          <section key={item.problem.id} className="reviewitem">
            <QuestionCard
              problem={item.problem}
              index={problems.indexOf(item.problem)}
              total={problems.length}
              given={item.given}
              onChange={() => {}}
              readOnly
            />
            <div className="explain">
              <p className="mine">
                내가 쓴 답: {item.given === null ? '(안 씀)' : Array.isArray(item.given) ? item.given.join(', ') : item.given}
              </p>
              <p className="right">
                정답: {Array.isArray(item.problem.answer) ? item.problem.answer.join(', ') : item.problem.answer}
              </p>
              {item.problem.explanation.split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </section>
        ))}
        <button className="ghost" onClick={() => setPhase('result')}>
          결과로 돌아가기
        </button>
      </div>
    )
  }

  return null
}
