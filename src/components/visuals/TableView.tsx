/** 표 렌더러. 1단원의 기록표·기준표, 나중에 6단원까지 이걸 쓴다. 5행 이내로만 만든다 */

import type { TableSpec } from '../../units/_types'

export function TableView({ spec }: { spec: TableSpec }) {
  return (
    <div className="tablewrap">
      <table className="datatable">
        {spec.caption && <caption>{spec.caption}</caption>}
        <thead>
          <tr>
            {spec.headers.map((h, i) => (
              <th key={i}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {spec.rows.map((row, r) => (
            <tr key={r} className={spec.highlightRows?.includes(r) ? 'hl' : undefined}>
              {row.map((cell, c) => (
                <td key={c}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
