/**
 * 검수용 덤프. `npm run dump`
 *
 * 파라미터 조합을 고루 덮는 100문항을 뽑아 out/dump.html 로 저장한다.
 * 브라우저로 열어 훑으면 된다. 수직선·표가 그대로 그려지므로 종이로 인쇄해도 학습지가 된다.
 *
 * 보는 기준 (STEP 4):
 *   - 문장이 어색하거나 두 가지로 읽히는 것
 *   - 5학년 수준에 안 맞는 수치
 *   - 정답이 애매한 것
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import { makeRng } from '../src/lib/rng'
import { TEMPLATES } from '../src/units/5-2-1'
import type { Difficulty, Draft, NumberLineSpec, TableSpec, Visual } from '../src/units/_types'

const TARGET = 100

/* ── 파라미터 조합을 고루 덮게 모은다 ─────────────────── */

type Row = Draft & { seq: number }

const seen = new Set<string>()
const picked: Draft[] = []
const slots: { t: (typeof TEMPLATES)[number]; d: Difficulty }[] = []
for (const t of TEMPLATES) for (const d of t.supports) slots.push({ t, d })

// 1차: 파라미터 조합이 새로운 것만 담는다
for (let i = 0; i < 6000 && picked.length < TARGET; i++) {
  const slot = slots[i % slots.length]!
  const rng = makeRng(`dump|${slot.t.id}|${slot.d}|${i}`)
  let d: Draft | null = null
  try {
    d = slot.t.generate(rng, slot.d)
  } catch {
    continue
  }
  if (!d) continue
  const key = `${d.templateId}|${d.difficulty}|${Object.values(d.params).join('|')}`
  if (seen.has(key)) continue
  seen.add(key)
  picked.push(d)
}

// 2차: 100개가 안 차면 조합 중복을 허용해 채운다
for (let i = 0; i < 6000 && picked.length < TARGET; i++) {
  const slot = slots[i % slots.length]!
  const rng = makeRng(`dump2|${slot.t.id}|${slot.d}|${i}`)
  try {
    const d = slot.t.generate(rng, slot.d)
    if (d) picked.push(d)
  } catch {
    /* 넘어감 */
  }
}

picked.sort((a, b) =>
  a.difficulty - b.difficulty || a.templateId.localeCompare(b.templateId),
)
const rows: Row[] = picked.map((d, i) => ({ ...d, seq: i + 1 }))

/* ── 그림을 SVG 문자열로 ─────────────────────────────── */

function numberLineSvg(spec: NumberLineSpec): string {
  const W = 640, H = 88, PAD = 44, Y = 46
  const { min, max, step, marks, ray } = spec
  const x = (v: number) => PAD + ((v - min) / (max - min)) * (W - PAD * 2)
  const p: string[] = []
  if (marks.length === 2) {
    p.push(`<line x1="${x(marks[0]!.at)}" y1="${Y}" x2="${x(marks[1]!.at)}" y2="${Y}" stroke="#93b4fd" stroke-width="7"/>`)
  } else if (ray === 'right') {
    p.push(`<line x1="${x(marks[0]!.at)}" y1="${Y}" x2="${W - PAD + 18}" y2="${Y}" stroke="#93b4fd" stroke-width="7"/>`)
  } else if (ray === 'left') {
    p.push(`<line x1="${PAD - 18}" y1="${Y}" x2="${x(marks[0]!.at)}" y2="${Y}" stroke="#93b4fd" stroke-width="7"/>`)
  }
  p.push(`<line x1="${PAD - 26}" y1="${Y}" x2="${W - PAD + 26}" y2="${Y}" stroke="#16202b" stroke-width="1.4"/>`)
  p.push(`<path d="M${W - PAD + 26} ${Y} l-8 -4 v8 z" fill="#16202b"/>`)
  p.push(`<path d="M${PAD - 26} ${Y} l8 -4 v8 z" fill="#16202b"/>`)
  const dec = (String(step).split('.')[1] ?? '').length
  for (let v = min; v <= max + 1e-9; v += step) {
    const vx = x(v)
    p.push(`<line x1="${vx}" y1="${Y - 6}" x2="${vx}" y2="${Y + 6}" stroke="#16202b" stroke-width="1.2"/>`)
    p.push(`<text x="${vx}" y="${Y + 26}" text-anchor="middle" font-family="monospace" font-size="12" fill="#5b6b7c">${v.toFixed(dec)}</text>`)
  }
  for (const m of marks) {
    p.push(`<circle cx="${x(m.at)}" cy="${Y}" r="6.5" fill="${m.type === 'filled' ? '#1d4ed8' : '#fff'}" stroke="#1d4ed8" stroke-width="2.2"/>`)
  }
  return `<svg viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">${p.join('')}</svg>`
}

function tableHtml(spec: TableSpec): string {
  return (
    `<table class="dt">${spec.caption ? `<caption>${esc(spec.caption)}</caption>` : ''}` +
    `<tr>${spec.headers.map((h) => `<th>${esc(h)}</th>`).join('')}</tr>` +
    spec.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('') +
    `</table>`
  )
}

function visualHtml(v: Visual): string {
  if (v.kind === 'numberline') return numberLineSvg(v.spec)
  if (v.kind === 'table') return tableHtml(v.spec)
  return `<em>(${v.kind} 렌더러 없음)</em>`
}

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/* ── HTML ───────────────────────────────────────────── */

const DIFF_LABEL: Record<number, string> = { 1: '하', 2: '중', 3: '상' }

const body = rows
  .map((r) => {
    const answer = Array.isArray(r.answer) ? r.answer.join(', ') : r.answer
    const params = Object.entries(r.params).map(([k, v]) => `${k}=${v}`).join(' · ')
    const choices = r.choices
      ? `<ol class="ch">${r.choices
          .map((c, i) => {
            const on = (Array.isArray(r.answer) ? r.answer : [r.answer]).includes(c)
            const vis = r.choiceVisuals?.[i] ? `<div class="cv">${visualHtml(r.choiceVisuals[i]!)}</div>` : ''
            return `<li class="${on ? 'on' : ''}">${esc(c)}${vis}</li>`
          })
          .join('')}</ol>`
      : `<p class="short">단답형</p>`
    return `<article class="q">
  <div class="qh">
    <span class="seq">${r.seq}</span>
    <span class="tag">${r.templateId} · ${DIFF_LABEL[r.difficulty]} · ${esc(r.standard)}</span>
    <span class="params">${esc(params)}</span>
  </div>
  <p class="prompt">${esc(r.prompt).replace(/\n/g, '<br>')}</p>
  ${r.visual ? `<div class="vis">${visualHtml(r.visual)}</div>` : ''}
  ${choices}
  <details><summary>정답 · 해설</summary>
    <p class="ans">정답: ${esc(answer)}</p>
    <p class="exp">${esc(r.explanation).replace(/\n/g, '<br>')}</p>
  </details>
</article>`
  })
  .join('\n')

const byTemplate: Record<string, number> = {}
const byDiff: Record<number, number> = {}
for (const r of rows) {
  byTemplate[r.templateId] = (byTemplate[r.templateId] ?? 0) + 1
  byDiff[r.difficulty] = (byDiff[r.difficulty] ?? 0) + 1
}

const html = `<!doctype html>
<html lang="ko"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>문항 검수 덤프 · 5-2-1</title>
<style>
 body{font-family:'Pretendard','IBM Plex Sans KR',system-ui,sans-serif;background:#fbfaf7;color:#16202b;margin:0;line-height:1.55}
 .wrap{max-width:860px;margin:0 auto;padding:40px 20px 80px}
 h1{font-size:28px;margin:0 0 6px}
 .sub{color:#5b6b7c;font-size:14px;margin:0 0 4px}
 .stat{font-size:13px;color:#5b6b7c;font-family:monospace;margin:12px 0 28px;padding:12px 14px;background:#fff;border:1px solid #d8dde3}
 .q{background:#fff;border:1px solid #d8dde3;padding:16px 18px;margin-bottom:14px}
 .qh{display:flex;gap:10px;align-items:center;flex-wrap:wrap;border-bottom:1px solid #eef1f4;padding-bottom:8px;margin-bottom:10px}
 .seq{font-family:monospace;font-size:12px;background:#16202b;color:#fff;padding:2px 8px}
 .tag{font-family:monospace;font-size:11px;color:#1d4ed8;letter-spacing:.05em}
 .params{font-family:monospace;font-size:11px;color:#8a97a4;margin-left:auto}
 .prompt{font-size:16.5px;margin:0 0 10px}
 .vis{margin:12px 0}
 .vis svg{display:block;width:100%;max-width:560px;height:auto;margin:0 auto}
 .ch{margin:0;padding-left:22px;font-size:15px}
 .ch li{padding:3px 0}
 .ch li.on{color:#0f766e;font-weight:700}
 .cv svg{max-width:340px;margin:2px 0}
 .short{font-size:13px;color:#8a97a4;font-family:monospace;margin:0}
 details{margin-top:10px;border-top:1px dashed #d8dde3;padding-top:6px}
 summary{font-size:12px;color:#5b6b7c;cursor:pointer;font-family:monospace}
 .ans{color:#0f766e;font-weight:700;font-size:14px;margin:8px 0 4px}
 .exp{font-size:14px;color:#334;margin:0;background:#f4f6f8;padding:10px 12px;border-left:3px solid #0f766e}
 table.dt{border-collapse:collapse;font-size:14px;margin:0 auto}
 table.dt caption{font-size:12px;color:#5b6b7c;text-align:left;padding-bottom:4px}
 table.dt th,table.dt td{border:1px solid #d8dde3;padding:6px 12px;text-align:center}
 table.dt th{background:#f4f6f8}
 .bar{position:sticky;top:0;background:#fbfaf7;padding:10px 0;border-bottom:1px solid #d8dde3;margin-bottom:16px}
 button{font:inherit;font-size:13px;padding:6px 12px;cursor:pointer}
 @media print{.bar{display:none}details{display:none}.q{break-inside:avoid}}
</style></head><body><div class="wrap">
<h1>문항 검수 덤프 · 5-2-1 수의 범위와 올림, 버림, 반올림</h1>
<p class="sub">${rows.length}문항. 파라미터 조합을 고루 덮게 뽑았습니다. 고정 시드라 다시 돌려도 같은 결과가 나옵니다.</p>
<p class="sub">문장이 어색한 것 · 5학년에 안 맞는 수치 · 정답이 애매한 것에 표시하세요.</p>
<div class="stat">
 난이도  ${Object.entries(byDiff).map(([d, c]) => `${DIFF_LABEL[Number(d)]} ${c}`).join('  ·  ')}<br>
 템플릿  ${Object.entries(byTemplate).sort().map(([t, c]) => `${t} ${c}`).join('  ·  ')}
</div>
<div class="bar"><button onclick="document.querySelectorAll('details').forEach(d=>d.open=!d.open)">정답·해설 모두 펼치기 / 접기</button></div>
${body}
</div></body></html>`

mkdirSync('out', { recursive: true })
writeFileSync('out/dump.html', html, 'utf8')
writeFileSync('out/dump.json', JSON.stringify(rows, null, 2), 'utf8')

console.log(`out/dump.html 에 ${rows.length}문항을 저장했습니다.`)
console.log(`  난이도  ${Object.entries(byDiff).map(([d, c]) => `${DIFF_LABEL[Number(d)]} ${c}`).join(' · ')}`)
console.log(`  템플릿  ${Object.entries(byTemplate).sort().map(([t, c]) => `${t} ${c}`).join(' · ')}`)
console.log(`  파라미터 조합 ${seen.size}가지`)
console.log('\n브라우저로 out/dump.html 을 열어 훑어보세요.')
