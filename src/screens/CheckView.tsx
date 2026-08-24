/**
 * 연결 진단 화면 (#/check).
 *
 * 학교마다 막는 것이 달라서, "안 돼요" 만으로는 원인을 알 수 없다.
 * 학생 크롬북에서 이 화면을 열면 **무엇이 막혔는지 한 줄씩** 보여 준다.
 * 선생님은 이 화면을 사진 찍어 정보부에 그대로 보여 주면 된다.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, ref, remove, set } from 'firebase/database'
import { ensureSignedIn, getDb, isFirebaseConfigured } from '../lib/firebase'

type Status = 'wait' | 'run' | 'ok' | 'fail'

type Step = {
  key: string
  name: string
  /** 실패했을 때 사람이 읽을 뜻 */
  meaning: string
  status: Status
  detail?: string
}

const STEPS: Omit<Step, 'status' | 'detail'>[] = [
  {
    key: 'page',
    name: '이 화면이 열림',
    meaning: '앱 주소(github.io)는 막히지 않았습니다.',
  },
  {
    key: 'online',
    name: '인터넷 연결',
    meaning: '와이파이가 끊겼습니다. 오른쪽 아래 와이파이를 확인하세요.',
  },
  {
    key: 'config',
    name: '접속 설정값',
    meaning: '앱에 Firebase 설정이 안 들어갔습니다. 선생님께 말해 주세요.',
  },
  {
    key: 'auth',
    name: 'Firebase 로그인',
    meaning: 'identitytoolkit.googleapis.com 이 막혔거나, 이 주소가 Firebase 승인 목록에 없습니다.',
  },
  {
    key: 'read',
    name: '데이터 읽기',
    meaning: 'firebasedatabase.app 이 막혔거나, 데이터베이스 규칙이 읽기를 막고 있습니다.',
  },
  {
    key: 'write',
    name: '데이터 쓰기',
    meaning: '읽기는 되는데 쓰기가 막혔습니다. 데이터베이스 규칙을 확인하세요.',
  },
]

export function CheckView() {
  const [steps, setSteps] = useState<Step[]>(
    STEPS.map((s) => ({ ...s, status: 'wait' as Status })),
  )
  const [running, setRunning] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    const mark = (key: string, status: Status, detail?: string): void =>
      setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, status, detail } : s)))

    setSteps(STEPS.map((s) => ({ ...s, status: 'wait' as Status })))

    // 1. 이 화면이 보이면 앱 주소는 안 막힌 것이다
    mark('page', 'ok', location.host)

    // 2. 인터넷
    mark('online', navigator.onLine ? 'ok' : 'fail')
    if (!navigator.onLine) {
      setRunning(false)
      return
    }

    // 3. 설정값
    if (!isFirebaseConfigured()) {
      mark('config', 'fail')
      setRunning(false)
      return
    }
    mark('config', 'ok')

    // 4. 로그인
    mark('auth', 'run')
    try {
      await ensureSignedIn()
      mark('auth', 'ok')
    } catch (e) {
      mark('auth', 'fail', e instanceof Error ? e.message : String(e))
      setRunning(false)
      return
    }

    // 5. 읽기
    mark('read', 'run')
    try {
      await get(ref(getDb(), 'codes'))
      mark('read', 'ok')
    } catch (e) {
      mark('read', 'fail', e instanceof Error ? e.message : String(e))
      setRunning(false)
      return
    }

    // 6. 쓰기 — 흔적을 남기지 않도록 바로 지운다
    mark('write', 'run')
    const probe = `sessions/_check_${Math.random().toString(36).slice(2, 8)}`
    try {
      await set(ref(getDb(), `${probe}/meta/phase`), 'lobby')
      await remove(ref(getDb(), probe))
      mark('write', 'ok')
    } catch (e) {
      mark('write', 'fail', e instanceof Error ? e.message : String(e))
    }
    setRunning(false)
  }, [])

  useEffect(() => {
    void run()
  }, [run])

  const failed = steps.find((s) => s.status === 'fail')
  const allOk = steps.every((s) => s.status === 'ok')

  return (
    <div className="wrap">
      <header className="site-head">
        <p className="eyebrow">연결 확인</p>
        <h1>어디까지 되는지 봅니다</h1>
        <p className="sub">이 화면을 그대로 사진 찍어 선생님께 보여 주세요.</p>
      </header>

      {allOk && (
        <p className="checkverdict ok">
          전부 됩니다. 이 크롬북은 문제가 없습니다.
        </p>
      )}
      {failed && (
        <p className="checkverdict bad">
          <b>{failed.name}</b> 에서 막혔습니다.
          <br />
          {failed.meaning}
        </p>
      )}

      <ul className="checklist">
        {steps.map((s) => (
          <li key={s.key} className={`check ${s.status}`}>
            <span className="check-mark">
              {s.status === 'ok' ? '✓' : s.status === 'fail' ? '✗' : s.status === 'run' ? '…' : '·'}
            </span>
            <span className="check-body">
              <b>{s.name}</b>
              {s.status === 'fail' && <span className="check-why">{s.meaning}</span>}
              {s.detail && <span className="check-detail">{s.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      <div className="checkinfo">
        <p><b>지금 주소</b> {location.href}</p>
        <p><b>화면 크기</b> {window.innerWidth} × {window.innerHeight}</p>
      </div>

      <div className="row">
        <button className="primary" onClick={() => void run()} disabled={running}>
          {running ? '확인 중…' : '다시 확인'}
        </button>
        <Link className="ghost" to="/join">돌아가기</Link>
      </div>
    </div>
  )
}
