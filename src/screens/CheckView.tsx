/**
 * 연결 진단 화면 (#/check).
 *
 * 학교마다 막는 것이 달라서, "안 돼요" 만으로는 원인을 알 수 없다.
 * 학생 크롬북에서 이 화면을 열면 **무엇이 막혔는지 한 줄씩** 보여 준다.
 *
 * 두 가지가 중요하다.
 *   1. **첫 실패에서 멈추지 않는다.** 정보부에 허용 요청을 넣으려면
 *      "무엇 무엇이 막혔는지" 목록이 다 있어야 한다. 하나만 알면 허용받고 나서
 *      또 막히고, 또 요청하고를 반복하게 된다.
 *   2. **도메인을 하나씩 따로 두드린다.** Firebase 로그인이 안 되는 것과
 *      데이터 서버가 막힌 것은 정보부 입장에서 완전히 다른 요청이다.
 */

import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, ref, remove, set } from 'firebase/database'
import {
  ensureSignedIn, firebaseHosts, firebaseSocketUrl, getDb, isFirebaseConfigured,
} from '../lib/firebase'

type Status = 'wait' | 'run' | 'ok' | 'fail'

type Row = {
  key: string
  name: string
  /** 정보부에 넘길 실제 주소. 없으면 도메인과 무관한 항목 */
  host?: string
  /** 실패했을 때 사람이 읽을 뜻 */
  meaning: string
  status: Status
  detail?: string
}

type Probe = { ok: boolean; detail: string }

/**
 * 주소 하나를 두드려 본다.
 *
 * 두 번 시도하는 이유가 있다. 필터가 도메인을 아예 끊어 버리는 경우와,
 * 차단 안내 페이지로 돌려보내는 경우는 증상이 다르다.
 * 정보부에 설명할 때 이 차이가 중요하다.
 */
async function probeHttps(url: string, ms = 8000): Promise<Probe> {
  const withTimeout = async (mode: RequestMode): Promise<Response> => {
    const ac = new AbortController()
    const t = setTimeout(() => ac.abort(), ms)
    try {
      return await fetch(url, { mode, cache: 'no-store', signal: ac.signal })
    } finally {
      clearTimeout(t)
    }
  }

  try {
    const r = await withTimeout('cors')
    // 401·403 이 와도 "닿았다" 는 뜻이다. 권한은 여기서 볼 게 아니다
    return { ok: true, detail: `응답 ${r.status}` }
  } catch {
    /* 아래에서 한 번 더 */
  }

  try {
    await withTimeout('no-cors')
    return { ok: false, detail: '응답은 오지만 내용을 읽을 수 없음 — 차단 페이지로 돌려진 것으로 보임' }
  } catch {
    return { ok: false, detail: '연결 자체가 안 됨 — 도메인이 막힌 것으로 보임' }
  }
}

/** 실시간 연결(WebSocket). HTTPS 는 열어 주면서 이것만 막는 필터가 있다 */
function probeWs(url: string, ms = 8000): Promise<Probe> {
  return new Promise((resolve) => {
    if (!url) return resolve({ ok: false, detail: '주소를 만들 수 없음' })
    let ws: WebSocket
    try {
      ws = new WebSocket(url)
    } catch {
      return resolve({ ok: false, detail: '연결을 시작조차 못 함' })
    }
    let done = false
    const finish = (p: Probe): void => {
      if (done) return
      done = true
      clearTimeout(timer)
      try {
        ws.close()
      } catch {
        /* 이미 닫혔으면 그만 */
      }
      resolve(p)
    }
    const timer = setTimeout(
      () => finish({ ok: false, detail: `${ms / 1000}초 안에 연결되지 않음` }),
      ms,
    )
    ws.onopen = () => finish({ ok: true, detail: '연결됨' })
    ws.onerror = () => finish({ ok: false, detail: '연결이 거부됨' })
  })
}

const two = (n: number): string => String(n).padStart(2, '0')
const stamp = (d: Date): string =>
  `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`

export function CheckView() {
  const [rows, setRows] = useState<Row[]>([])
  const [running, setRunning] = useState(false)
  const [copied, setCopied] = useState(false)

  const run = useCallback(async () => {
    setRunning(true)
    setCopied(false)

    const hosts = firebaseHosts()
    const base: Row[] = [
      { key: 'page', name: '이 화면이 열림', host: location.host, meaning: '앱 주소가 막혔습니다.', status: 'wait' },
      { key: 'online', name: '인터넷 연결', meaning: '와이파이가 끊겼습니다.', status: 'wait' },
      { key: 'config', name: '접속 설정값', meaning: '앱에 Firebase 설정이 안 들어갔습니다. 선생님께 말해 주세요.', status: 'wait' },
      ...hosts.map((h) => ({
        key: h.key,
        name: h.label,
        host: h.host,
        meaning: h.effect,
        status: 'wait' as Status,
      })),
      { key: 'ws', name: '실시간 연결 (WebSocket)', meaning: '문제는 뜨는데 다음 화면으로 안 넘어갑니다.', status: 'wait' },
      { key: 'auth', name: '실제로 로그인해 보기', meaning: '로그인 서버가 막혔거나, 이 주소가 Firebase 승인 목록에 없습니다.', status: 'wait' },
      { key: 'read', name: '실제로 읽어 보기', meaning: '데이터 서버가 막혔거나, 데이터베이스 규칙이 읽기를 막고 있습니다.', status: 'wait' },
      { key: 'write', name: '실제로 써 보기', meaning: '읽기는 되는데 쓰기가 막혔습니다. 데이터베이스 규칙을 확인하세요.', status: 'wait' },
    ]
    setRows(base)

    const mark = (key: string, status: Status, detail?: string): void =>
      setRows((prev) => prev.map((r) => (r.key === key ? { ...r, status, detail } : r)))
    const skip = (key: string, why: string): void => mark(key, 'fail', `앞이 막혀서 확인 못 함 — ${why}`)

    // 이 화면이 보이면 앱 주소는 안 막힌 것이다
    mark('page', 'ok')
    mark('online', navigator.onLine ? 'ok' : 'fail')
    mark('config', isFirebaseConfigured() ? 'ok' : 'fail')

    if (!navigator.onLine || !isFirebaseConfigured()) {
      setRunning(false)
      return
    }

    // 도메인은 하나씩 따로, 동시에. 하나가 막혀도 나머지는 끝까지 본다
    for (const h of hosts) mark(h.key, 'run')
    mark('ws', 'run')
    const probes = await Promise.all([
      ...hosts.map((h) => probeHttps(h.probe)),
      probeWs(firebaseSocketUrl()),
    ])
    hosts.forEach((h, i) => mark(h.key, probes[i]!.ok ? 'ok' : 'fail', probes[i]!.detail))
    const wsProbe = probes[hosts.length]!
    mark('ws', wsProbe.ok ? 'ok' : 'fail', wsProbe.detail)

    // 여기부터는 앞이 되어야 뒤가 된다
    mark('auth', 'run')
    try {
      await ensureSignedIn()
      mark('auth', 'ok')
    } catch (e) {
      mark('auth', 'fail', e instanceof Error ? e.message : String(e))
      skip('read', '로그인이 안 됨')
      skip('write', '로그인이 안 됨')
      setRunning(false)
      return
    }

    mark('read', 'run')
    try {
      await get(ref(getDb(), 'codes'))
      mark('read', 'ok')
    } catch (e) {
      mark('read', 'fail', e instanceof Error ? e.message : String(e))
      skip('write', '읽기가 안 됨')
      setRunning(false)
      return
    }

    // 흔적을 남기지 않도록 바로 지운다
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

  const done = rows.length > 0 && !running
  const blockedHosts = rows.filter((r) => r.status === 'fail' && r.host && r.key !== 'page')
  const allOk = done && rows.every((r) => r.status === 'ok')

  /** 정보부에 그대로 넘길 수 있는 글. 사진보다 글자가 낫다 — 주소를 옮겨 적다 틀리지 않는다 */
  const report = [
    '[수학 수업용 웹앱 연결 확인 결과]',
    `확인 시각: ${stamp(new Date())}`,
    `확인한 주소: ${location.href}`,
    '',
    ...rows.map((r) => {
      const m = r.status === 'ok' ? 'O' : r.status === 'fail' ? 'X' : '-'
      return `${m} ${r.name}${r.host ? ` (${r.host})` : ''}${r.detail ? ` — ${r.detail}` : ''}`
    }),
    '',
    blockedHosts.length > 0
      ? `허용이 필요한 주소: ${blockedHosts.map((r) => r.host).join(', ')}`
      : '막힌 주소 없음',
    ...(rows.find((r) => r.key === 'ws')?.status === 'fail'
      ? ['', '※ 데이터 서버 주소는 WebSocket(wss://, 443 포트) 연결도 함께 허용되어야 합니다.']
      : []),
  ].join('\n')

  const copy = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(report)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="wrap">
      <header className="site-head">
        <p className="eyebrow">연결 확인</p>
        <h1>어디까지 되는지 봅니다</h1>
        <p className="sub">끝까지 다 확인합니다. 중간에 ✗ 가 떠도 멈추지 않습니다.</p>
      </header>

      {allOk && <p className="checkverdict ok">전부 됩니다. 이 기기는 문제가 없습니다.</p>}
      {done && blockedHosts.length > 0 && (
        <p className="checkverdict bad">
          <b>{blockedHosts.length}곳이 막혔습니다.</b>
          <br />
          아래 &lt;정보부에 보낼 내용&gt; 을 복사해서 그대로 보내세요.
        </p>
      )}

      <ul className="checklist">
        {rows.map((r) => (
          <li key={r.key} className={`check ${r.status}`}>
            <span className="check-mark">
              {r.status === 'ok' ? '✓' : r.status === 'fail' ? '✗' : r.status === 'run' ? '…' : '·'}
            </span>
            <span className="check-body">
              <b>{r.name}</b>
              {r.host && <span className="check-host">{r.host}</span>}
              {r.status === 'fail' && <span className="check-why">{r.meaning}</span>}
              {r.detail && <span className="check-detail">{r.detail}</span>}
            </span>
          </li>
        ))}
      </ul>

      {done && (
        <section className="panel">
          <h2>정보부에 보낼 내용</h2>
          <p className="sub">아래 글을 복사해서 메신저나 메일로 보내면 됩니다.</p>
          <textarea className="checkreport" readOnly rows={rows.length + 8} value={report} />
          <div className="row">
            <button className="primary" onClick={() => void copy()}>
              {copied ? '복사했습니다' : '복사하기'}
            </button>
          </div>
        </section>
      )}

      <div className="row">
        <button className="primary" onClick={() => void run()} disabled={running}>
          {running ? '확인 중…' : '다시 확인'}
        </button>
        <Link className="ghost" to="/join">돌아가기</Link>
      </div>
    </div>
  )
}
