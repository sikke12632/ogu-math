/**
 * 출제 범위 고르기.
 *
 * 'T1' 같은 부호는 교사에게 아무 뜻이 없다. **이름과 한 줄 설명**을 보여 주고,
 * 눌러서 **실제 문항 예시**까지 볼 수 있게 한다. 그래야 뭘 고르는지 안다.
 */

import { useMemo, useState } from 'react'
import { VisualView } from '../../components/visuals/VisualView'
import type { Difficulty, TopicInfo } from '../../units/_types'
import { getUnit } from '../../units'

const LEVEL_LABEL: Record<Difficulty, string> = { 1: '하', 2: '중', 3: '상' }

type Props = {
  unitId: string
  topics: TopicInfo[]
  selected: string[]
  onChange: (next: string[]) => void
}

export function TopicPicker({ unitId, topics, selected, onChange }: Props) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [nonce, setNonce] = useState(0)

  const groups = useMemo(() => {
    const map = new Map<string, TopicInfo[]>()
    for (const t of topics) {
      const arr = map.get(t.topic) ?? []
      arr.push(t)
      map.set(t.topic, arr)
    }
    return [...map.entries()]
  }, [topics])

  const toggle = (id: string): void => {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  const sample = useMemo(() => {
    if (!openId) return null
    try {
      return getUnit(unitId).sample(openId, `${openId}-${nonce}`)
    } catch {
      return null
    }
  }, [openId, unitId, nonce])

  return (
    <div className="topicpicker">
      <div className="topicbar">
        <button type="button" className="tiny" onClick={() => onChange(topics.map((t) => t.id))}>
          전체 선택
        </button>
        <button type="button" className="tiny" onClick={() => onChange([])}>
          전체 해제
        </button>
        {groups.map(([g, list]) => (
          <button
            key={g}
            type="button"
            className="tiny"
            onClick={() => onChange(list.map((t) => t.id))}
          >
            {g}만
          </button>
        ))}
      </div>

      {groups.map(([g, list]) => (
        <div key={g} className="topicgroup">
          <p className="topicgroup-name">{g}</p>
          <ul className="topiclist">
            {list.map((t) => {
              const on = selected.includes(t.id)
              return (
                <li key={t.id} className={on ? 'topic on' : 'topic'}>
                  <label className="topic-main">
                    <input type="checkbox" checked={on} onChange={() => toggle(t.id)} />
                    <span className="topic-text">
                      <b>{t.name}</b>
                      <span className="topic-desc">{t.description}</span>
                    </span>
                  </label>
                  <span className="topic-levels">
                    {t.levels.map((l) => LEVEL_LABEL[l]).join('·')}
                  </span>
                  <button
                    type="button"
                    className="tiny"
                    onClick={() => setOpenId(openId === t.id ? null : t.id)}
                  >
                    {openId === t.id ? '닫기' : '예시 보기'}
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      ))}

      {openId && (
        <div className="samplebox">
          {sample ? (
            <>
              <div className="samplehead">
                <span className="eyebrow">예시 문항</span>
                <button type="button" className="tiny" onClick={() => setNonce((n) => n + 1)}>
                  다른 예시
                </button>
              </div>
              <p className="prompt">{sample.prompt}</p>
              {sample.visual && (
                <div className="visual">
                  <VisualView visual={sample.visual} />
                </div>
              )}
              {sample.choices && (
                <ul className={sample.choiceVisuals ? 'choices grid' : 'choices'}>
                  {sample.choices.map((c, i) => {
                    const isAnswer = (Array.isArray(sample.answer) ? sample.answer : [sample.answer]).includes(c)
                    return (
                      <li key={c}>
                        <div className={isAnswer ? 'choice right' : 'choice'}>
                          <span className="mark">{i + 1}</span>
                          <span className="label">{c}</span>
                          {sample.choiceVisuals?.[i] && (
                            <span className="choice-visual">
                              <VisualView visual={sample.choiceVisuals[i]!} />
                            </span>
                          )}
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              <div className="explain">
                <p className="right">
                  정답: {Array.isArray(sample.answer) ? sample.answer.join(', ') : sample.answer}
                </p>
                {sample.explanation.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>
            </>
          ) : (
            <p className="hint">예시를 만들지 못했습니다.</p>
          )}
        </div>
      )}
    </div>
  )
}
