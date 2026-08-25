/**
 * 그날 쓸 별명 정하기.
 *
 * **실제 이름은 그대로 남는다.** 선생님 화면과 오답 기록은 실명을 쓰고,
 * 칠판과 친구들 화면에만 이 별명이 보인다.
 * 그래서 누가 냈고 누가 뭘 틀렸는지는 선생님이 그대로 알 수 있다.
 */

import { useState } from 'react'
import { setNickname } from '../../session/api'
import type { StudentId } from '../../session/types'
import { readableError } from '../../session/useSession'

/** 교실에서 부담 없는 것들로만. 매 수업 바꿔 쓰라고 넉넉히 둔다 */
const EMOJIS = [
  '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐶', '🐱',
  '🐰', '🐸', '🐵', '🦄', '🐢', '🐧', '🦉', '🐝',
  '🦋', '🐙', '🦖', '🐳', '🚀', '⚡', '🔥', '❄️',
  '🌈', '⭐', '🍀', '🍎', '🍩', '🎈', '🎯', '🏆',
]

type Props = {
  sessionId: string
  me: StudentId
  realName: string
  current?: string
  onDone: () => void
}

export function NicknamePicker({ sessionId, me, realName, current, onDone }: Props) {
  const startEmoji = EMOJIS.find((e) => current?.startsWith(e)) ?? ''
  const [emoji, setEmoji] = useState(startEmoji)
  const [text, setText] = useState(
    current ? current.slice(startEmoji.length).trim() : '',
  )
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const preview = `${emoji}${emoji && text ? ' ' : ''}${text}`.trim()

  const save = async (value: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await setNickname(sessionId, me, value)
      if (res.ok) onDone()
      else setError(res.reason)
    } catch (e) {
      // try 가 없으면 여기서 터질 때 setBusy(false) 에 못 가서
      // **버튼이 영원히 잠긴다.** 학생은 눌러도 아무 반응이 없다고 느낀다
      setError(readableError(e))
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="wrap">
      <header className="site-head">
        <p className="eyebrow">{realName} 님, 반가워요</p>
        <h1>오늘 쓸 별명을 정하세요</h1>
        <p className="sub">칠판과 친구들 화면에 이 별명이 보입니다. 다음 수업에 또 바꿀 수 있어요.</p>
      </header>

      {error && <p className="notice error">{error}</p>}

      <div className="nickpreview">
        <span className="nicklabel">이렇게 보여요</span>
        <span className="nickvalue">{preview || realName}</span>
      </div>

      <label className="nickinput">
        <span>별명</span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value.slice(0, 12))}
          placeholder="안 써도 돼요"
          autoComplete="off"
          maxLength={12}
        />
      </label>

      <p className="nicksection">그림 고르기</p>
      <ul className="emojigrid">
        <li>
          <button
            type="button"
            className={emoji === '' ? 'emoji on' : 'emoji'}
            onClick={() => setEmoji('')}
            aria-label="그림 없음"
          >
            없음
          </button>
        </li>
        {EMOJIS.map((e) => (
          <li key={e}>
            <button
              type="button"
              className={emoji === e ? 'emoji on' : 'emoji'}
              onClick={() => setEmoji(e)}
              aria-label={`그림 ${e}`}
            >
              {e}
            </button>
          </li>
        ))}
      </ul>

      <div className="row">
        <button className="primary big" onClick={() => void save(preview)} disabled={busy}>
          이걸로 할래요
        </button>
        <button className="ghost" onClick={() => void save('')} disabled={busy}>
          그냥 내 이름 쓸래요
        </button>
      </div>
    </div>
  )
}
