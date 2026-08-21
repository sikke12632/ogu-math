/**
 * Visual 판별 유니온을 kind 로 분기해 그린다.
 * 단원을 추가할 때 여기에 분기 하나를 더하는 것으로 끝나야 한다.
 */

import type { Visual } from '../../units/_types'
import { NumberLine } from './NumberLine'
import { TableView } from './TableView'

export function VisualView({ visual }: { visual: Visual }) {
  switch (visual.kind) {
    case 'numberline':
      return <NumberLine spec={visual.spec} />
    case 'table':
      return <TableView spec={visual.spec} />
    case 'fraction':
    case 'figure':
      // 2·3·5단원에서 구현한다. 여기까지 왔다는 건 등록되지 않은 단원이 문항을 낸 것이다
      return <p className="notice">아직 그릴 수 없는 그림입니다 ({visual.kind}).</p>
  }
}
