/**
 * 글 안에 섞인 분수를 **세로 분수로** 그린다.
 *
 * 왜 필요한가 — 5학년에게 `3/4` 는 나눗셈으로 읽힌다. 교과서는 예외 없이 세로 분수다.
 * 그런데 분수는 문장 한가운데에 나온다.
 *
 *   "전체의 [3/4]의 [2/5]는 얼마인가요?"
 *
 * 그래서 그림(`visual`)으로는 안 되고 **글자 사이에 끼워 넣어야** 한다.
 * 문항 생성기는 글자만 만들고, 그리는 일은 여기서 한다.
 *
 * ── 쓰는 법 ──────────────────────────────────────────
 *   [3/4]     진분수  3/4
 *   [1_2/3]   대분수  1과 2/3
 *   그 밖의 대괄호는 건드리지 않는다. 숫자 모양이 정확히 맞을 때만 바꾼다.
 */

import type { ReactNode } from 'react'

/** `[3/4]` 또는 `[1_2/3]` 만 골라낸다. 다른 대괄호는 그냥 글자로 둔다 */
const FRACTION = /\[(?:(\d+)_)?(\d+)\/(\d+)\]/g

function Fraction({ whole, num, den }: { whole?: string; num: string; den: string }) {
  // 소리로 읽을 때도 뜻이 통해야 한다 (화면 낭독기)
  // 자연수를 소리 내어 읽었을 때 받침이 있으면 '과', 없으면 '와'
  //   2 이·4 사·5 오·9 구 → 와,  나머지 → 과
  const wa = whole && [true, true, false, true, false, false, true, true, true, false][Number(whole) % 10]
  const label = whole ? `${whole}${wa ? '과' : '와'} ${den}분의 ${num}` : `${den}분의 ${num}`
  return (
    <span className="frac" role="math" aria-label={label}>
      {whole && <span className="frac-whole">{whole}</span>}
      <span className="frac-stack" aria-hidden="true">
        <span className="frac-num">{num}</span>
        <span className="frac-den">{den}</span>
      </span>
    </span>
  )
}

/** 글자를 조각내어 분수만 바꿔 끼운다 */
export function mathNodes(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let m: RegExpExecArray | null
  FRACTION.lastIndex = 0
  while ((m = FRACTION.exec(text)) !== null) {
    if (m.index > last) out.push(text.slice(last, m.index))
    out.push(<Fraction key={m.index} whole={m[1]} num={m[2]!} den={m[3]!} />)
    last = m.index + m[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/** 분수가 섞인 글. 발문·보기·해설 어디서나 이걸로 그린다 */
export function MathText({ text }: { text: string }) {
  return <>{mathNodes(text)}</>
}

/** 분수 표시를 걷어낸 맨 글자. 채점·비교처럼 글자만 필요한 곳에서 쓴다 */
export function plainMath(text: string): string {
  return text.replace(FRACTION, (_, w: string | undefined, n: string, d: string) =>
    w ? `${w}과 ${d}분의 ${n}` : `${d}분의 ${n}`,
  )
}
