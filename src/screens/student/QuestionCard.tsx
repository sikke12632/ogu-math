/** 문항 카드. 선택형(하나 고르기 / 모두 고르기), 단답형, 그림 보기를 모두 여기서 그린다 */

import { VisualView } from '../../components/visuals/VisualView'
import type { Answer } from '../../session/grade'
import type { Problem } from '../../units/_types'

type Props = {
  problem: Problem
  index: number
  total: number
  given: Answer
  onChange: (a: Answer) => void
  /** 결과 화면에서 다시 볼 때 true — 입력을 막고 정답을 표시한다 */
  readOnly?: boolean
}

export function QuestionCard({ problem, index, total, given, onChange, readOnly }: Props) {
  const multi = Array.isArray(problem.answer)
  const selected = given === null ? [] : Array.isArray(given) ? given : [given]

  const toggle = (choice: string) => {
    if (readOnly) return
    if (!multi) {
      onChange(choice)
      return
    }
    const next = selected.includes(choice) ? selected.filter((c) => c !== choice) : [...selected, choice]
    onChange(next.length ? next : null)
  }

  const answerSet = new Set(Array.isArray(problem.answer) ? problem.answer : [problem.answer])

  return (
    <article className="card">
      <header className="card-head">
        <span className="qno">{index + 1} / {total}</span>
        <span className="badge">{problem.points}점</span>
      </header>

      <p className="prompt">{problem.prompt}</p>
      {multi && !readOnly && <p className="hint">답이 여러 개입니다. 모두 고르세요.</p>}

      {problem.visual && (
        <div className="visual">
          <VisualView visual={problem.visual} />
        </div>
      )}

      {problem.choices ? (
        <ul className={problem.choiceVisuals ? 'choices grid' : 'choices'}>
          {problem.choices.map((c, i) => {
            const on = selected.includes(c)
            const isAnswer = answerSet.has(c)
            const cls = [
              'choice',
              on ? 'on' : '',
              readOnly && isAnswer ? 'right' : '',
              readOnly && on && !isAnswer ? 'wrong' : '',
            ].filter(Boolean).join(' ')
            return (
              <li key={c}>
                <button type="button" className={cls} onClick={() => toggle(c)} disabled={readOnly}>
                  <span className="mark">{multi ? (on ? '☑' : '☐') : String(i + 1)}</span>
                  <span className="label">{c}</span>
                  {problem.choiceVisuals?.[i] && (
                    <span className="choice-visual">
                      <VisualView visual={problem.choiceVisuals[i]!} />
                    </span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      ) : (
        <div className="shortanswer">
          <input
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="답을 쓰세요"
            value={typeof given === 'string' ? given : ''}
            onChange={(e) => onChange(e.target.value === '' ? null : e.target.value)}
            disabled={readOnly}
          />
        </div>
      )}
    </article>
  )
}
