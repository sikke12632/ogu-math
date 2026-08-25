/**
 * 낙서장 — 문제 옆에서 펜으로 계산하는 곳.
 *
 * 아이들이 종이를 꺼내는 걸 번거로워해서 만들었다.
 * **종이의 진짜 장점은 "그냥 거기 있다" 는 것**이므로, 버튼을 눌러야 나오면
 * 종이보다 나을 게 없다. 그래서 문제 옆에 늘 펼쳐 둔다.
 *
 * ── 지켜야 할 것 ─────────────────────────────────────
 *
 * 1. **문제마다 따로 저장한다.** 3번으로 돌아가면 3번에 쓴 계산이 그대로 있어야 한다.
 * 2. **기기 안에만 둔다.** 서버로 안 보낸다 — 사용량도 0이고, 아이가 남 눈치 안 보고 쓴다.
 * 3. **손바닥이 닿아도 안 그려져야 한다.** 펜을 한 번이라도 쓴 기기에서는
 *    그 뒤로 펜만 받는다. 이게 없으면 글씨를 쓸 때마다 손바닥 자국이 남는다.
 * 4. **화면 크기가 바뀌어도 글씨가 찌그러지면 안 된다.** 그래서 좌표를
 *    가로폭 기준으로만 0~1 로 바꿔 저장한다. 세로로만 늘어나도 글씨는 그대로다.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { load, save } from '../../lib/storage'

/** 획 하나. 좌표는 가로폭으로 나눈 값이다 (위 4번 참고) */
type Stroke = {
  /** [x, y, x, y, …] 로 납작하게 담는다. 점이 많아 객체로 두면 저장이 무거워진다 */
  p: number[]
  /** 지우개로 그은 획인가 */
  e?: 1
}

type Saved = { t: number; s: Stroke[] }

/** 한 문제에 이만큼까지만 받는다. 무한정 쌓여 저장이 터지는 걸 막는다 */
const MAX_STROKES = 600
/** 오래된 낙서는 지운다 (7일) */
const KEEP_MS = 7 * 24 * 60 * 60 * 1000

const PEN_W = 0.0038
const ERASER_W = 0.045

const keyOf = (id: string): string => `scratch:${id}`

/** 지난 수업 낙서가 기기에 계속 쌓이지 않게 한 번 훑어 지운다 */
function sweepOld(): void {
  try {
    const now = Date.now()
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i)
      if (!k || !k.includes(':scratch:')) continue
      try {
        const v = JSON.parse(localStorage.getItem(k) ?? '{}') as Saved
        if (!v.t || now - v.t > KEEP_MS) localStorage.removeItem(k)
      } catch {
        localStorage.removeItem(k)
      }
    }
  } catch {
    /* 저장소를 못 읽어도 낙서장은 돌아야 한다 */
  }
}

type Props = {
  /** 문제마다 다른 값. 이 값이 바뀌면 그 문제의 낙서를 불러온다 */
  id: string
}

export function Scratchpad({ id }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const strokesRef = useRef<Stroke[]>([])
  const drawingRef = useRef<{ pointerId: number; stroke: Stroke } | null>(null)
  /** 펜을 한 번이라도 봤나. 봤으면 그 뒤로 손가락은 무시한다 (손바닥 막기) */
  const penSeenRef = useRef(false)
  const [erasing, setErasing] = useState(false)
  const [askClear, setAskClear] = useState(false)
  /** 되돌리기 버튼을 켤지 끌지 정하려고만 쓴다 */
  const [count, setCount] = useState(0)

  useEffect(() => sweepOld(), [])

  /* ── 그리기 ─────────────────────────────────────── */

  const redraw = useCallback(() => {
    const cv = canvasRef.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return
    const w = cv.clientWidth
    const h = cv.clientHeight
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, w, h)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    for (const s of strokesRef.current) {
      if (s.p.length < 2) continue
      ctx.globalCompositeOperation = s.e ? 'destination-out' : 'source-over'
      ctx.strokeStyle = '#16202b'
      ctx.lineWidth = (s.e ? ERASER_W : PEN_W) * w
      ctx.beginPath()
      ctx.moveTo(s.p[0]! * w, s.p[1]! * w)
      for (let i = 2; i < s.p.length; i += 2) ctx.lineTo(s.p[i]! * w, s.p[i + 1]! * w)
      // 점 하나만 찍은 경우에도 자국이 남아야 한다
      if (s.p.length === 2) ctx.lineTo(s.p[0]! * w + 0.01, s.p[1]! * w)
      ctx.stroke()
    }
    ctx.globalCompositeOperation = 'source-over'
  }, [])

  const persist = useCallback(() => {
    save(keyOf(id), { t: Date.now(), s: strokesRef.current } satisfies Saved)
  }, [id])

  /* 문제가 바뀌면 그 문제의 낙서를 불러온다 */
  useEffect(() => {
    const v = load<Saved | null>(keyOf(id), null)
    strokesRef.current = v?.s ?? []
    setCount(strokesRef.current.length)
    setErasing(false)
    setAskClear(false)
    redraw()
  }, [id, redraw])

  /* 창 크기가 바뀌면 다시 그린다 */
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(box)
    return () => ro.disconnect()
  }, [redraw])

  /* ── 펜 다루기 ──────────────────────────────────── */

  const pointOf = (e: React.PointerEvent<HTMLCanvasElement>): [number, number] => {
    const cv = canvasRef.current!
    const r = cv.getBoundingClientRect()
    const w = r.width || 1
    return [(e.clientX - r.left) / w, (e.clientY - r.top) / w]
  }

  /** 펜 뒤쪽 지우개로 그으면 버튼을 안 눌러도 지워진다 */
  const isEraserEnd = (e: React.PointerEvent): boolean =>
    e.pointerType === 'pen' && (e.buttons & 32) !== 0

  const onDown = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    if (e.pointerType === 'pen') penSeenRef.current = true
    // 펜을 쓰는 기기라면 손가락·손바닥은 무시한다
    if (penSeenRef.current && e.pointerType === 'touch') return
    if (strokesRef.current.length >= MAX_STROKES) return

    e.currentTarget.setPointerCapture(e.pointerId)
    const stroke: Stroke = { p: pointOf(e) }
    if (erasing || isEraserEnd(e)) stroke.e = 1
    strokesRef.current.push(stroke)
    drawingRef.current = { pointerId: e.pointerId, stroke }
    setAskClear(false)
    redraw()
  }

  const onMove = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const d = drawingRef.current
    if (!d || d.pointerId !== e.pointerId) return
    const [x, y] = pointOf(e)
    const p = d.stroke.p
    // 아주 조금 움직인 건 버린다. 점이 잘게 쌓이면 저장이 무거워진다
    const dx = x - p[p.length - 2]!
    const dy = y - p[p.length - 1]!
    if (dx * dx + dy * dy < 0.000004) return
    p.push(x, y)
    redraw()
  }

  const onUp = (e: React.PointerEvent<HTMLCanvasElement>): void => {
    const d = drawingRef.current
    if (!d || d.pointerId !== e.pointerId) return
    drawingRef.current = null
    setCount(strokesRef.current.length)
    persist()
  }

  const undo = (): void => {
    strokesRef.current.pop()
    setCount(strokesRef.current.length)
    persist()
    redraw()
  }

  const clearAll = (): void => {
    // 한 번에 지우지 않는다. 애써 쓴 계산이 손끝 실수로 날아가면 안 된다
    if (!askClear) {
      setAskClear(true)
      window.setTimeout(() => setAskClear(false), 3000)
      return
    }
    strokesRef.current = []
    setCount(0)
    setAskClear(false)
    persist()
    redraw()
  }

  const full = count >= MAX_STROKES

  return (
    <div className="pad" ref={boxRef}>
      <div className="pad-tools">
        <span className="pad-title">계산해 보기</span>
        <button
          className={`pad-btn${erasing ? ' on' : ''}`}
          onClick={() => setErasing((v) => !v)}
          aria-pressed={erasing}
        >
          지우개
        </button>
        <button className="pad-btn" onClick={undo} disabled={count === 0}>
          되돌리기
        </button>
        <button className={`pad-btn${askClear ? ' warn' : ''}`} onClick={clearAll} disabled={count === 0}>
          {askClear ? '정말 지울까요?' : '전체 지우기'}
        </button>
      </div>

      <canvas
        ref={canvasRef}
        className="pad-canvas"
        onPointerDown={onDown}
        onPointerMove={onMove}
        onPointerUp={onUp}
        onPointerCancel={onUp}
      />

      {full && <p className="pad-full">이 문제 낙서장이 가득 찼어요. 전체 지우기를 눌러 주세요.</p>}
    </div>
  )
}
