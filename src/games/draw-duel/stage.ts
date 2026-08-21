/**
 * 번호 뽑기 대전 — 무대 그리기. React 를 모르는 캔버스 코드다.
 *
 * 그림의 정체: **교실에서 발표자 뽑을 때 쓰는 통.** 뚜껑 없는 아크릴 통을
 * 흔들어 번호 공을 꺼낸다. 구형 통·받침대·배출구·송풍기는 그리지 않는다.
 *
 * 공이 화면의 주인공이라 조명을 한 방향으로 통일했다.
 *   주광  왼쪽 위          → 하이라이트와 스펙큘러
 *   반사광 오른쪽 아래      → 이게 없으면 공이 납작한 원반으로 보인다
 *   접지 그림자            → 공이 공간에 놓인 느낌을 만든다
 */

export type Card = number | 'X'

export const STAGE_W = 720
export const STAGE_H = 416

/* 통 */
const JAR_X = 360
const JAR_HW = 152
const JAR_TOP = 172
const JAR_BOT = 376
const JAR_R = 38
const MOUTH_RY = 21
/** 공 반지름. 교실에서 숫자가 읽히는 크기가 기준이다 */
const BALL_R = 21

/* 공이 날아가 앉는 자리 */
export type SlotKey = 'oppDraw' | 'meDraw' | 'oppHidden' | 'meHidden'
const SLOT: Record<SlotKey, { x: number; y: number; r: number; label: string }> = {
  oppHidden: { x: 52, y: 62, r: 27, label: '상대 히든' },
  oppDraw: { x: 140, y: 62, r: 35, label: '상대가 뽑은 공' },
  meDraw: { x: 580, y: 62, r: 35, label: '내가 뽑은 공' },
  meHidden: { x: 668, y: 62, r: 27, label: '내 히든' },
}
const MOUTH = { x: JAR_X, y: JAR_TOP + 2 }

/* 1~12 를 색상환에 고르게 흩는다. 인접한 수끼리 색이 붙지 않게 */
const HUE = [0, 6, 28, 44, 58, 96, 148, 172, 194, 214, 244, 276, 320]

type Palette = { light: string; base: string; mid: string; dark: string; bounce: string }

function paletteOf(v: Card | '?'): Palette {
  if (v === '?') {
    return { light: '#9db0c6', base: '#65788f', mid: '#3c4a5c', dark: '#1a2230', bounce: 'rgba(150,180,215,.40)' }
  }
  if (v === 'X') {
    return { light: '#ffa693', base: '#e0503f', mid: '#a02a1c', dark: '#4c0f07', bounce: 'rgba(255,150,120,.42)' }
  }
  const h = HUE[v as number] ?? 200
  return {
    light: `hsl(${h} 95% 82%)`,
    base: `hsl(${h} 80% 58%)`,
    mid: `hsl(${h} 74% 36%)`,
    dark: `hsl(${h} 70% 15%)`,
    bounce: `hsla(${h} 92% 74% / .42)`,
  }
}

type Ball = {
  v: Card | '?'
  x: number
  y: number
  vx: number
  vy: number
  r: number
  rot: number
  /** 착지 후 눌리는 정도 — 0이면 완전한 구 */
  squash: number
}

type Flying = Ball & {
  /** 날아가는 동안 도는 양 */
  spin: number
  x0: number; y0: number; x1: number; y1: number
  cx: number; cy: number
  targetR: number
  t: number
  slot: SlotKey
  done: boolean
}

export class DuelStage {
  private ctx: CanvasRenderingContext2D
  private canvas: HTMLCanvasElement
  private balls: Ball[] = []
  private flying: Flying[] = []
  private seated: Partial<Record<SlotKey, Ball | 'fold'>> = {}
  private shakeFrames = 0
  private shakeDir = 1
  private jarDX = 0
  private raf = 0
  private scale = 1

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('캔버스를 쓸 수 없습니다')
    this.ctx = ctx
    this.fit()
  }

  fit(): void {
    const dpr = Math.min(window.devicePixelRatio || 1, 2.5)
    const parent = this.canvas.parentElement
    const w = parent ? parent.clientWidth : STAGE_W
    const h = (w * STAGE_H) / STAGE_W
    this.canvas.width = Math.round(w * dpr)
    this.canvas.height = Math.round(h * dpr)
    this.canvas.style.height = `${h}px`
    this.scale = (dpr * w) / STAGE_W
    this.ctx.setTransform(this.scale, 0, 0, this.scale, 0, 0)
  }

  start(): void {
    if (this.raf) return
    const loop = (): void => {
      this.step()
      this.draw()
      this.raf = requestAnimationFrame(loop)
    }
    this.raf = requestAnimationFrame(loop)
  }

  stop(): void {
    cancelAnimationFrame(this.raf)
    this.raf = 0
  }

  /** 통 안의 공을 통째로 새로 채운다 */
  fill(values: Card[]): void {
    this.balls = values.map((v) => this.spawn(v))
    this.flying = []
    this.seated = {}
  }

  /** 판 도중 꽝 2장이 들어올 때처럼 몇 장만 더할 때 */
  add(values: Card[]): void {
    for (const v of values) this.balls.push(this.spawn(v))
  }

  /** 뽑힌 공을 통에서 빼서 자리로 날린다 */
  drawOut(v: Card, slot: SlotKey): void {
    const i = this.balls.findIndex((b) => b.v === v)
    if (i >= 0) this.balls.splice(i, 1)
    else if (this.balls.length) this.balls.pop()
    this.fly(v, slot)
  }

  /** 히든처럼 통을 거치지 않고 바로 놓는 공 */
  fly(v: Card | '?', slot: SlotKey): void {
    const t = SLOT[slot]
    // 두 사람이 동시에 뽑을 때 공이 겹쳐 보이지 않게, 갈 방향으로 출발점을 살짝 민다
    const side = t.x < MOUTH.x ? -1 : 1
    const x0 = MOUTH.x + side * 30
    this.flying.push({
      v, x: x0, y: MOUTH.y, vx: 0, vy: 0, r: BALL_R, rot: 0, squash: 0,
      spin: Math.PI * 1.4 * side,
      x0, y0: MOUTH.y, x1: t.x, y1: t.y,
      cx: (x0 + t.x) / 2, cy: MOUTH.y - 92,
      targetR: t.r, t: 0, slot, done: false,
    })
  }

  /** 스탑해서 이번 턴에 안 뽑은 자리 */
  fold(slot: SlotKey): void {
    this.seated[slot] = 'fold'
  }

  clearSlots(...slots: SlotKey[]): void {
    for (const s of slots) delete this.seated[s]
  }

  /** 앉아 있는 히든 공의 숫자를 바꾼다 (상대 히든 공개) */
  revealSlot(slot: SlotKey, v: Card): void {
    const b = this.seated[slot]
    if (b && b !== 'fold') b.v = v
  }

  shake(frames = 46): void {
    this.shakeFrames = frames
  }

  private spawn(v: Card): Ball {
    return {
      v,
      x: JAR_X + (Math.random() - 0.5) * (JAR_HW - BALL_R) * 1.8,
      y: JAR_TOP + 30 + Math.random() * 90,
      vx: (Math.random() - 0.5) * 3,
      vy: (Math.random() - 0.5) * 2,
      r: BALL_R,
      rot: Math.random() * Math.PI * 2,
      squash: 0,
    }
  }

  /* ── 물리 ───────────────────────────────────────── */

  private step(): void {
    if (this.shakeFrames > 0) {
      this.shakeFrames--
      this.shakeDir = Math.sin(this.shakeFrames * 0.52)
      this.jarDX = this.shakeDir * 12
    } else {
      this.jarDX *= 0.84
      if (Math.abs(this.jarDX) < 0.05) this.jarDX = 0
    }

    const shaking = this.shakeFrames > 0
    for (const b of this.balls) {
      b.vy += 0.34 // 중력. 흔들지 않으면 바닥에 가라앉아 가만히 있는 게 자연스럽다
      if (shaking) {
        b.vx += this.shakeDir * 2.8 + (Math.random() - 0.5) * 2.0
        b.vy -= 1.5 + Math.random() * 1.1
      }
      const sp = Math.hypot(b.vx, b.vy)
      if (sp > 9) {
        b.vx *= 9 / sp
        b.vy *= 9 / sp
      }
      b.vx *= 0.985
      b.vy *= 0.995
      b.x += b.vx
      b.y += b.vy
      b.rot += b.vx * 0.055
      b.squash *= 0.82

      const L = JAR_X + this.jarDX - JAR_HW + b.r
      const R = JAR_X + this.jarDX + JAR_HW - b.r
      const B = JAR_BOT - b.r
      const T = JAR_TOP + b.r * 0.2
      if (b.x < L) { b.x = L; b.vx = -b.vx * 0.5 }
      if (b.x > R) { b.x = R; b.vx = -b.vx * 0.5 }
      if (b.y > B) {
        b.y = B
        if (b.vy > 2) b.squash = Math.min(0.3, b.vy * 0.03)
        b.vy = -Math.abs(b.vy) * 0.42
        b.vx *= 0.9
        if (Math.abs(b.vy) < 1.1) b.vy = 0
      }
      if (b.y < T) { b.y = T; b.vy = Math.abs(b.vy) * 0.35 }

      // 둥근 바닥 모서리를 따라 굴러 내려가게
      for (const sx of [-1, 1]) {
        const cx = JAR_X + this.jarDX + sx * (JAR_HW - JAR_R)
        const cy = JAR_BOT - JAR_R
        const lim = JAR_R - b.r
        if ((sx < 0 ? b.x < cx : b.x > cx) && b.y > cy) {
          const dx = b.x - cx
          const dy = b.y - cy
          const d = Math.hypot(dx, dy)
          if (d > lim && d > 0) {
            const nx = dx / d
            const ny = dy / d
            b.x = cx + nx * lim
            b.y = cy + ny * lim
            const dot = b.vx * nx + b.vy * ny
            b.vx = (b.vx - 2 * dot * nx) * 0.5
            b.vy = (b.vy - 2 * dot * ny) * 0.5
          }
        }
      }
    }

    // 공끼리 밀어내기
    for (let i = 0; i < this.balls.length; i++) {
      for (let j = i + 1; j < this.balls.length; j++) {
        const a = this.balls[i]!
        const b = this.balls[j]!
        const dx = b.x - a.x
        const dy = b.y - a.y
        const d = Math.hypot(dx, dy)
        const m = a.r + b.r
        if (d < m && d > 0) {
          const nx = dx / d
          const ny = dy / d
          const ov = (m - d) / 2
          a.x -= nx * ov; a.y -= ny * ov
          b.x += nx * ov; b.y += ny * ov
          const p = (a.vx - b.vx) * nx + (a.vy - b.vy) * ny
          if (p > 0) {
            a.vx -= p * nx * 0.82; a.vy -= p * ny * 0.82
            b.vx += p * nx * 0.82; b.vy += p * ny * 0.82
          }
        }
      }
    }

    for (const f of this.flying) {
      f.t = Math.min(1, f.t + 0.028)
      const e = f.t < 0.5 ? 2 * f.t * f.t : 1 - (-2 * f.t + 2) ** 2 / 2 // easeInOutQuad
      const u = 1 - e
      f.x = u * u * f.x0 + 2 * u * e * f.cx + e * e * f.x1
      f.y = u * u * f.y0 + 2 * u * e * f.cy + e * e * f.y1
      f.r = BALL_R + (f.targetR - BALL_R) * e
      // 날아가는 동안만 돈다. 자리에 앉을 때는 똑바로 서야 숫자가 읽힌다
      f.rot = f.spin * u
      if (f.t >= 1 && !f.done) {
        f.done = true
        f.rot = 0
        f.squash = 0.22
        this.seated[f.slot] = f
      }
    }
    this.flying = this.flying.filter((f) => !f.done)
    for (const s of Object.values(this.seated)) {
      if (s && s !== 'fold') {
        s.squash *= 0.86
        s.rot = 0
      }
    }
  }

  /* ── 그리기 ─────────────────────────────────────── */

  private jarPath(inset = 0): void {
    const ctx = this.ctx
    const L = JAR_X + this.jarDX - JAR_HW + inset
    const R = JAR_X + this.jarDX + JAR_HW - inset
    const r = JAR_R - inset
    ctx.beginPath()
    ctx.moveTo(L, JAR_TOP)
    ctx.lineTo(L, JAR_BOT - r)
    ctx.quadraticCurveTo(L, JAR_BOT, L + r, JAR_BOT)
    ctx.lineTo(R - r, JAR_BOT)
    ctx.quadraticCurveTo(R, JAR_BOT, R, JAR_BOT - r)
    ctx.lineTo(R, JAR_TOP)
  }

  private drawBall(b: Ball): void {
    const ctx = this.ctx
    const c = paletteOf(b.v)
    const r = b.r
    const sq = b.squash
    ctx.save()
    ctx.translate(b.x, b.y)

    // 접지 그림자 — 공이 바닥에서 뜬 만큼 옅고 넓어진다
    ctx.beginPath()
    ctx.ellipse(2, r * 0.96, r * 0.74, r * 0.2, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,.32)'
    ctx.fill()

    ctx.scale(1 + sq, 1 - sq)

    // 구체 본체 — 주광은 왼쪽 위
    const g = ctx.createRadialGradient(-r * 0.36, -r * 0.42, r * 0.05, -r * 0.05, -r * 0.05, r * 1.2)
    g.addColorStop(0, c.light)
    g.addColorStop(0.22, c.base)
    g.addColorStop(0.62, c.mid)
    g.addColorStop(1, c.dark)
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.fillStyle = g
    ctx.fill()

    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.clip()

    // 반사광 — 오른쪽 아래에서 되튄 빛. 이게 있어야 원반이 아니라 구로 보인다
    const bounce = ctx.createRadialGradient(r * 0.5, r * 0.58, r * 0.02, r * 0.4, r * 0.5, r * 0.9)
    bounce.addColorStop(0, c.bounce)
    bounce.addColorStop(1, 'rgba(255,255,255,0)')
    ctx.fillStyle = bounce
    ctx.fill()

    // 명암 경계 — 오른쪽 위 가장자리를 눌러 실루엣을 둥글게 만든다
    const term = ctx.createRadialGradient(-r * 0.3, -r * 0.35, r * 0.5, 0, 0, r * 1.05)
    term.addColorStop(0, 'rgba(0,0,0,0)')
    term.addColorStop(1, 'rgba(0,0,0,.34)')
    ctx.fillStyle = term
    ctx.fill()
    ctx.restore()

    // 숫자 — 구 표면에 얹힌 느낌으로 살짝 눕히고 회전시킨다
    ctx.save()
    // 숫자는 거의 세워 둔다. 통 안에서 굴러도 몇 번인지 읽혀야 한다
    ctx.rotate((b.rot || 0) * 0.10)
    const t = b.v === 'X' ? '꽝' : b.v === '?' ? '?' : String(b.v)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.font =
      b.v === 'X' || b.v === '?'
        ? `900 ${r * 0.76}px 'Gothic A1', system-ui, sans-serif`
        : `700 ${r * 0.95}px 'IBM Plex Mono', ui-monospace, monospace`
    ctx.scale(1, 0.92)
    ctx.lineWidth = r * 0.17
    ctx.lineJoin = 'round'
    ctx.strokeStyle = 'rgba(0,0,0,.32)'
    ctx.strokeText(t, 0, r * 0.02)
    ctx.fillStyle = '#fff'
    ctx.fillText(t, 0, r * 0.02)
    ctx.restore()

    // 스펙큘러 — 작고 밝게. 크면 플라스틱이 아니라 젤리로 보인다
    ctx.save()
    ctx.beginPath()
    ctx.arc(0, 0, r, 0, Math.PI * 2)
    ctx.clip()
    ctx.beginPath()
    ctx.ellipse(-r * 0.4, -r * 0.47, r * 0.26, r * 0.17, -0.6, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.88)'
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-r * 0.17, -r * 0.64, r * 0.09, r * 0.055, -0.5, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.6)'
    ctx.fill()
    ctx.restore()

    ctx.beginPath()
    ctx.arc(0, 0, r - 0.6, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0,0,0,.2)'
    ctx.lineWidth = 1.6
    ctx.stroke()
    ctx.restore()
  }

  private drawJarBack(): void {
    const ctx = this.ctx
    ctx.save()

    // 통이 놓인 바닥 그림자
    ctx.beginPath()
    ctx.ellipse(JAR_X + this.jarDX * 0.6, JAR_BOT + 14, JAR_HW * 0.95, 14, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(0,0,0,.45)'
    ctx.fill()

    // 통 안쪽 — 뒤쪽 벽이 비쳐 보이는 어두운 면
    this.jarPath()
    const g = ctx.createLinearGradient(JAR_X - JAR_HW, 0, JAR_X + JAR_HW, 0)
    g.addColorStop(0, 'rgba(96,140,186,.20)')
    g.addColorStop(0.45, 'rgba(14,22,32,.26)')
    g.addColorStop(1, 'rgba(96,140,186,.20)')
    ctx.fillStyle = g
    ctx.fill()

    // 안쪽 바닥 타원 — 원통으로 보이게 하는 결정적인 한 줄
    ctx.beginPath()
    ctx.ellipse(JAR_X + this.jarDX, JAR_BOT - 6, JAR_HW - 9, 17, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(8,13,20,.55)'
    ctx.fill()
    ctx.restore()
  }

  private drawJarFront(): void {
    const ctx = this.ctx
    ctx.save()

    // 유리면 — 양 끝이 두껍게 보이는 반사
    this.jarPath()
    const g = ctx.createLinearGradient(JAR_X - JAR_HW, 0, JAR_X + JAR_HW, 0)
    g.addColorStop(0, 'rgba(198,226,255,.24)')
    g.addColorStop(0.14, 'rgba(255,255,255,.05)')
    g.addColorStop(0.5, 'rgba(255,255,255,0)')
    g.addColorStop(0.86, 'rgba(255,255,255,.045)')
    g.addColorStop(1, 'rgba(198,226,255,.22)')
    ctx.fillStyle = g
    ctx.fill()
    ctx.lineWidth = 3.5
    ctx.strokeStyle = 'rgba(158,196,236,.42)'
    ctx.stroke()

    // 세로 하이라이트 두 줄 — 굽은 면이라는 신호
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.moveTo(JAR_X + this.jarDX - JAR_HW + 22, JAR_TOP + 26)
    ctx.lineTo(JAR_X + this.jarDX - JAR_HW + 22, JAR_BOT - 62)
    ctx.lineWidth = 8
    ctx.strokeStyle = 'rgba(255,255,255,.15)'
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(JAR_X + this.jarDX + JAR_HW - 26, JAR_TOP + 40)
    ctx.lineTo(JAR_X + this.jarDX + JAR_HW - 26, JAR_BOT - 84)
    ctx.lineWidth = 3.5
    ctx.strokeStyle = 'rgba(255,255,255,.09)'
    ctx.stroke()

    // 입구 — 두께가 있는 테두리
    // 안쪽 구멍 — 벽 두께만큼 좁게. 이래야 통이 뚫려 보인다
    ctx.beginPath()
    ctx.ellipse(JAR_X + this.jarDX, JAR_TOP + 1, JAR_HW - 7, MOUTH_RY - 5, 0, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(7,11,17,.92)'
    ctx.fill()
    // 입구 테두리(벽 두께) — 얇은 두 줄
    ctx.beginPath()
    ctx.ellipse(JAR_X + this.jarDX, JAR_TOP, JAR_HW, MOUTH_RY, 0, 0, Math.PI * 2)
    ctx.lineWidth = 2.4
    ctx.strokeStyle = 'rgba(186,218,250,.62)'
    ctx.stroke()
    // 앞쪽 립에 걸리는 빛
    ctx.beginPath()
    ctx.ellipse(JAR_X + this.jarDX, JAR_TOP, JAR_HW - 3.5, MOUTH_RY - 2.5, 0, Math.PI * 0.1, Math.PI * 0.9)
    ctx.lineWidth = 3
    ctx.strokeStyle = 'rgba(255,255,255,.34)'
    ctx.stroke()
    ctx.restore()
  }

  private drawSlot(key: SlotKey): void {
    const ctx = this.ctx
    const s = SLOT[key]
    const seat = this.seated[key]
    ctx.save()
    ctx.beginPath()
    ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(255,255,255,.035)'
    ctx.fill()
    ctx.setLineDash([5, 6])
    ctx.lineWidth = 1.5
    ctx.strokeStyle = 'rgba(148,172,202,.34)'
    ctx.stroke()
    ctx.setLineDash([])
    ctx.font = "400 13px 'Gothic A1', system-ui, sans-serif"
    ctx.fillStyle = '#8b9db2'
    ctx.textAlign = 'center'
    ctx.fillText(s.label, s.x, s.y + s.r + 17)
    if (seat === 'fold') {
      ctx.font = "900 14px 'Gothic A1', system-ui, sans-serif"
      ctx.fillStyle = '#8b9db2'
      ctx.fillText('접음', s.x, s.y + 5)
    }
    ctx.restore()
  }

  private draw(): void {
    const ctx = this.ctx
    ctx.clearRect(0, 0, STAGE_W, STAGE_H)

    // 무대 바닥 — 통 아래로 은은한 빛
    const floor = ctx.createRadialGradient(JAR_X, JAR_BOT - 40, 20, JAR_X, JAR_BOT - 40, 330)
    floor.addColorStop(0, 'rgba(74,110,152,.20)')
    floor.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = floor
    ctx.fillRect(0, 0, STAGE_W, STAGE_H)

    for (const k of ['oppHidden', 'oppDraw', 'meDraw', 'meHidden'] as SlotKey[]) this.drawSlot(k)

    this.drawJarBack()
    ctx.save()
    this.jarPath()
    ctx.clip()
    for (const b of this.balls) this.drawBall(b)
    ctx.restore()
    this.drawJarFront()

    for (const seat of Object.values(this.seated)) {
      if (seat && seat !== 'fold') this.drawBall(seat)
    }
    for (const f of this.flying) this.drawBall(f)
  }
}
