/**
 * 수직선 렌더러. docs/수직선_렌더러_검증.html 의 drawNumberLine() 을 React 로 옮긴 것.
 * 파라미터 다섯 개(min·max·step·점 위치·화살표)만으로 그린다. 이미지 파일이 없다.
 */

import type { NumberLineSpec } from '../../units/_types'

const W = 640
const H = 88
const PAD = 44
const Y = 46

export function NumberLine({ spec }: { spec: NumberLineSpec }) {
  const { min, max, step, marks, ray } = spec
  const x = (v: number) => PAD + ((v - min) / (max - min)) * (W - PAD * 2)
  const dec = (String(step).split('.')[1] ?? '').length

  const ticks: number[] = []
  for (let v = min; v <= max + 1e-9; v = v + step) ticks.push(Math.round(v * 1e6) / 1e6)

  return (
    <svg className="numberline" viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" role="img">
      {/* 범위 띠 */}
      {marks.length === 2 && (
        <line x1={x(marks[0]!.at)} y1={Y} x2={x(marks[1]!.at)} y2={Y} stroke="var(--band)" strokeWidth={7} />
      )}
      {marks.length === 1 && ray === 'right' && (
        <line x1={x(marks[0]!.at)} y1={Y} x2={W - PAD + 18} y2={Y} stroke="var(--band)" strokeWidth={7} />
      )}
      {marks.length === 1 && ray === 'left' && (
        <line x1={PAD - 18} y1={Y} x2={x(marks[0]!.at)} y2={Y} stroke="var(--band)" strokeWidth={7} />
      )}

      {/* 축 + 양끝 화살표 */}
      <line x1={PAD - 26} y1={Y} x2={W - PAD + 26} y2={Y} stroke="var(--ink)" strokeWidth={1.4} />
      <path d={`M${W - PAD + 26} ${Y} l-8 -4 v8 z`} fill="var(--ink)" />
      <path d={`M${PAD - 26} ${Y} l8 -4 v8 z`} fill="var(--ink)" />

      {/* 눈금 + 숫자 */}
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x(v)} y1={Y - 6} x2={x(v)} y2={Y + 6} stroke="var(--ink)" strokeWidth={1.2} />
          <text x={x(v)} y={Y + 26} textAnchor="middle" fontSize={12} fill="var(--ink-soft)" fontFamily="ui-monospace, monospace">
            {v.toFixed(dec)}
          </text>
        </g>
      ))}

      {/* 경계점 — ● 포함 / ○ 포함하지 않음 */}
      {marks.map((m, i) => (
        <circle
          key={i}
          cx={x(m.at)}
          cy={Y}
          r={6.5}
          fill={m.type === 'filled' ? 'var(--mark)' : '#fff'}
          stroke="var(--mark)"
          strokeWidth={2.2}
        />
      ))}
    </svg>
  )
}
