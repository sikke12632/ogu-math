/**
 * QR 코드. 라이브러리를 번들에 넣어 쓴다 — 학교 크롬북에서 외부 CDN 이
 * 막혀 있어도 떠야 하기 때문이다.
 */

import { useEffect, useRef } from 'react'
import QRCode from 'qrcode'

export function Qr({ value, size = 320 }: { value: string; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    void QRCode.toCanvas(el, value, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#10151d', light: '#ffffff' },
    })
  }, [value, size])

  return <canvas ref={ref} className="qr" width={size} height={size} aria-label="입장 QR 코드" />
}
