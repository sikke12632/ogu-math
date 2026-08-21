/**
 * 무대 렌더링 확인용 페이지 (#/stage). 수업에서는 쓰지 않는다.
 * 공과 통이 제대로 보이는지 크게 띄워 놓고 고치기 위한 화면이다.
 */

import { useEffect, useRef, useState } from 'react'
import { DuelStage } from '../../games/draw-duel/stage'
import type { Card } from '../../games/draw-duel/engine'

export function StageLab() {
  const ref = useRef<HTMLCanvasElement>(null)
  const stageRef = useRef<DuelStage | null>(null)
  const [note, setNote] = useState('')

  useEffect(() => {
    if (!ref.current) return
    const st = new DuelStage(ref.current)
    stageRef.current = st
    st.start()
    st.fill([1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as Card[])
    st.fly(11, 'meHidden')
    st.fly('?', 'oppHidden')
    const onResize = (): void => st.fit()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      st.stop()
    }
  }, [])

  const act = (name: string, fn: (s: DuelStage) => void) => () => {
    const s = stageRef.current
    if (!s) return
    fn(s)
    setNote(name)
  }

  return (
    <div style={{ padding: 12, width: 1480, margin: '0 auto' }}>
      <div className="duel-stage">
        <canvas ref={ref} />
      </div>
      <div className="row" style={{ marginTop: 10 }}>
        <button className="ghost" onClick={act('흔들기', (s) => s.shake(50))}>흔들기</button>
        <button className="ghost" onClick={act('숫자 뽑기', (s) => s.drawOut(7, 'meDraw'))}>숫자 뽑기</button>
        <button className="ghost" onClick={act('꽝 뽑기', (s) => s.drawOut('X', 'oppDraw'))}>꽝 뽑기</button>
        <button className="ghost" onClick={act('꽝 넣기', (s) => s.add(['X', 'X']))}>꽝 2장 넣기</button>
        <button
          className="ghost"
          onClick={act('가라앉히기', (s) => {
            s.fill([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 'X', 'X'] as Card[])
            s.shake(0)
          })}
        >
          가득 채우기
        </button>
      </div>
      <p className="hint">{note}</p>
    </div>
  )
}
