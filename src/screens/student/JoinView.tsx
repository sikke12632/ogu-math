/**
 * 코드로 들어가기.
 * QR 이 주 경로지만 6자리 코드도 반드시 있어야 한다 —
 * 크롬북 카메라는 화면 위쪽에 붙어 있어 종이나 칠판을 조준하기가 불편하다.
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { codeToSessionId } from '../../session/api'

export function JoinView() {
  const nav = useNavigate()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const go = async (): Promise<void> => {
    const c = code.trim().toUpperCase()
    if (c.length !== 6) {
      setError('코드는 6자리예요.')
      return
    }
    setBusy(true)
    setError(null)
    const id = await codeToSessionId(c)
    setBusy(false)
    if (id) nav(`/play/${c}`)
    else setError('그런 코드가 없어요. 칠판을 다시 봐 주세요.')
  }

  return (
    <div className="wrap play-center">
      <header className="site-head">
        <p className="eyebrow">학생용</p>
        <h1>코드 넣기</h1>
        <p className="sub">칠판에 뜬 6자리를 그대로 쓰세요. QR을 찍어도 됩니다.</p>
      </header>

      {error && <p className="notice error">{error}</p>}

      <input
        className="codeinput"
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase().slice(0, 6))}
        onKeyDown={(e) => {
          if (e.key === 'Enter') void go()
        }}
        placeholder="ABC123"
        autoFocus
        autoComplete="off"
        spellCheck={false}
        maxLength={6}
        aria-label="6자리 코드"
      />

      <button className="primary big" onClick={() => void go()} disabled={busy}>
        {busy ? '찾는 중…' : '들어가기'}
      </button>

      <p className="foot">
        <Link to="/practice">혼자 연습하기</Link> · <Link to="/review">내 오답 보기</Link>
        <br />
        <Link to="/check">안 들어가지면 여기를 눌러 확인</Link>
      </p>
    </div>
  )
}
