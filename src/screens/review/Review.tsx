/**
 * 오답 기록 조회 — 이름 선택 → 회차별 목록 → 문항 / 내 답 / 정답 / 해설
 *
 * 개인정보 최소화: 저장하는 건 이름과 회차별 점수·답안뿐이다.
 * 학번·생년월일·연락처를 넣지 않는다. 학년말 일괄 삭제도 여기 있다.
 */

import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { VisualView } from '../../components/visuals/VisualView'
import { clearArchive, loadArchive } from '../../session/api'
import { rememberedName } from '../../session/api'
import type { ArchiveEntry } from '../../session/types'

const fmtDate = (t: number): string => {
  const d = new Date(t)
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

export function Review() {
  const [all, setAll] = useState<Record<string, ArchiveEntry> | null>(null)
  const [name, setName] = useState<string | null>(null)
  const [openKey, setOpenKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)

  useEffect(() => {
    loadArchive()
      .then((v) => {
        setAll(v)
        const remembered = rememberedName()
        if (remembered && Object.values(v).some((e) => e.name === remembered)) setName(remembered)
      })
      .catch((e) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const names = useMemo(() => {
    if (!all) return []
    return [...new Set(Object.values(all).map((e) => e.name))].sort((a, b) => a.localeCompare(b, 'ko'))
  }, [all])

  const mine = useMemo(() => {
    if (!all || !name) return []
    return Object.entries(all)
      .filter(([, e]) => e.name === name)
      .sort((a, b) => b[1].date - a[1].date)
  }, [all, name])

  if (error) return <div className="wrap"><p className="notice error">{error}</p></div>
  if (!all) return <div className="wrap"><p>불러오는 중…</p></div>

  if (names.length === 0) {
    return (
      <div className="wrap play-center">
        <h1>아직 기록이 없어요</h1>
        <p className="sub">수업이 끝나고 선생님이 저장하면 여기에 나옵니다.</p>
        <Link className="ghost" to="/join">돌아가기</Link>
      </div>
    )
  }

  if (!name) {
    return (
      <div className="wrap">
        <header className="site-head">
          <p className="eyebrow">기록 보기</p>
          <h1>이름을 고르세요</h1>
        </header>
        <ul className="seatgrid">
          {names.map((n) => (
            <li key={n}>
              <button className="seat" onClick={() => setName(n)}>{n}</button>
            </li>
          ))}
        </ul>
        <details className="dangerzone">
          <summary>학년말 정리 (선생님용)</summary>
          <p className="hint">모든 학생의 기록을 지웁니다. 되돌릴 수 없습니다.</p>
          {confirmClear ? (
            <div className="row">
              <button
                className="danger"
                onClick={() => {
                  void clearArchive().then(() => setAll({}))
                  setConfirmClear(false)
                }}
              >
                정말 전부 지우기
              </button>
              <button className="ghost" onClick={() => setConfirmClear(false)}>그만두기</button>
            </div>
          ) : (
            <button className="ghost" onClick={() => setConfirmClear(true)}>기록 전부 지우기</button>
          )}
        </details>
      </div>
    )
  }

  const open = openKey ? all[openKey] : null

  if (open) {
    const wrong = open.items.filter((i) => !i.correct)
    return (
      <div className="wrap">
        <header className="site-head">
          <p className="eyebrow">{open.name} · {fmtDate(open.date)}</p>
          <h1>{open.score} / {open.total}점</h1>
        </header>
        {wrong.length === 0 ? (
          <p className="sub">다 맞았어요.</p>
        ) : (
          wrong.map((it, i) => (
            <section key={i} className="card">
              <p className="prompt">{it.prompt}</p>
              {it.visual && (
                <div className="visual">
                  <VisualView visual={it.visual} />
                </div>
              )}
              {it.choices && (
                <ul className={it.choiceVisuals ? 'choices grid' : 'choices'}>
                  {it.choices.map((c, ci) => (
                    <li key={c}>
                      <div className={c === it.answer ? 'choice right' : 'choice'}>
                        <span className="mark">{ci + 1}</span>
                        <span className="label">{c}</span>
                        {it.choiceVisuals?.[ci] && (
                          <span className="choice-visual">
                            <VisualView visual={it.choiceVisuals[ci]!} />
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              <div className="explain">
                <p className="mine">내가 쓴 답: {it.given || '(안 씀)'}</p>
                <p className="right">정답: {it.answer}</p>
                {it.explanation.split('\n').map((line, j) => <p key={j}>{line}</p>)}
              </div>
            </section>
          ))
        )}
        <button className="ghost" onClick={() => setOpenKey(null)}>회차 목록으로</button>
      </div>
    )
  }

  return (
    <div className="wrap">
      <header className="site-head">
        <p className="eyebrow">{name}</p>
        <h1>내 기록</h1>
      </header>
      <ul className="historylist">
        {mine.map(([key, e]) => {
          const wrong = e.items.filter((i) => !i.correct).length
          return (
            <li key={key}>
              <button onClick={() => setOpenKey(key)}>
                <span className="hdate">{fmtDate(e.date)}</span>
                <span className="hscore">{e.score} / {e.total}점</span>
                <span className="hwrong">{wrong === 0 ? '다 맞음' : `틀린 문제 ${wrong}개`}</span>
              </button>
            </li>
          )
        })}
      </ul>
      <button className="ghost" onClick={() => setName(null)}>다른 이름 고르기</button>
    </div>
  )
}
