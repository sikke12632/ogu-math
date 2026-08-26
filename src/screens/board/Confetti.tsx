/**
 * 색종이. 결과 화면에서 우승 팀이 나올 때 한 번 뿌린다.
 *
 * 캔버스로 그린다 — 조각이 수백 개라 DOM 으로 만들면 전자칠판이 버벅인다.
 * 라이브러리를 쓰지 않는다. 학교 필터가 무엇을 막을지 모르므로
 * 밖에서 받아 오는 것은 하나도 두지 않는다.
 *
 * 몇 초 뒤 저절로 멈춘다. 결과를 보는 동안 계속 흩날리면 이름을 읽기 어렵다.
 */

import { useEffect, useRef } from 'react'

type Piece = {
  x: number
  y: number
  vx: number
  vy: number
  rot: number
  vr: number
  w: number
  h: number
  color: string
}

/** 팀 색을 섞어 쓴다. 우승 팀 색이 조금 더 많이 나오게 한다 */
const COLORS = ['#ef5350', '#42a5f5', '#ffca28', '#66bb6a', '#ab47bc', '#ffa726']

export function Confetti({ accent }: { accent?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const cv = ref.current
    const ctx = cv?.getContext('2d')
    if (!cv || !ctx) return

    // 움직임을 줄여 달라고 한 기기에서는 뿌리지 않는다
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const resize = (): void => {
      cv.width = Math.round(cv.clientWidth * dpr)
      cv.height = Math.round(cv.clientHeight * dpr)
    }
    resize()

    const palette = accent ? [accent, accent, ...COLORS] : COLORS
    const w = () => cv.clientWidth
    const h = () => cv.clientHeight

    const pieces: Piece[] = Array.from({ length: 160 }, () => ({
      x: Math.random() * w(),
      // 화면 위쪽 바깥에서 시작해 쏟아져 들어오게
      y: -Math.random() * h() * 0.8 - 20,
      vx: (Math.random() - 0.5) * 1.6,
      vy: 1.6 + Math.random() * 2.6,
      rot: Math.random() * Math.PI * 2,
      vr: (Math.random() - 0.5) * 0.22,
      w: 7 + Math.random() * 9,
      h: 10 + Math.random() * 12,
      color: palette[Math.floor(Math.random() * palette.length)]!,
    }))

    let raf = 0
    const started = Date.now()
    const LIFE = 6500

    const tick = (): void => {
      const age = Date.now() - started
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w(), h())

      // 끝날 때 뚝 끊기지 않게 서서히 흐려진다
      ctx.globalAlpha = age > LIFE - 1200 ? Math.max(0, (LIFE - age) / 1200) : 1

      let alive = false
      for (const p of pieces) {
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
        p.vy += 0.012 // 조금씩 빨라진다
        if (p.y < h() + 40) alive = true

        ctx.save()
        ctx.translate(p.x, p.y)
        ctx.rotate(p.rot)
        ctx.fillStyle = p.color
        // 돌아가는 각도에 따라 납작해지게 — 종잇조각처럼 보인다
        ctx.scale(1, Math.abs(Math.cos(p.rot)) * 0.8 + 0.2)
        ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
        ctx.restore()
      }

      if (alive && age < LIFE) raf = requestAnimationFrame(tick)
      else ctx.clearRect(0, 0, w(), h())
    }
    raf = requestAnimationFrame(tick)

    window.addEventListener('resize', resize)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [accent])

  return <canvas ref={ref} className="confetti" aria-hidden="true" />
}
