/**
 * 단원 모듈 공통 타입.
 * 이 파일은 Firebase 를 몰라야 한다. 단독으로 실행해서 문항을 뽑아볼 수 있어야 검수가 가능하다.
 */

export type Difficulty = 1 | 2 | 3

/* ── 그림 스펙 ───────────────────────────────────────────────
 * 처음부터 판별 유니온으로 둔다. 5-2-1 은 numberline/table 만 쓰지만
 * 2단원은 분수, 3·5단원은 도형이 필요하다. 여기서 못박으면 나중에 전면 수정이 된다.
 * (아키텍처 설계서 9.2)
 */

/** 수직선 — 1단원 */
export type NumberLineSpec = {
  min: number
  max: number
  step: number
  /** ● filled = 그 수를 포함, ○ hollow = 포함하지 않음 */
  marks: { at: number; type: 'filled' | 'hollow' }[]
  /** 한쪽으로 끝없이 뻗는 범위 */
  ray?: 'left' | 'right' | 'both'
}

/** 표 — 1단원(습도표·기록표·기준표)과 6단원 */
export type TableSpec = {
  caption?: string
  headers: string[]
  rows: string[][]
  /** 강조할 행 인덱스 (없으면 강조 없음) */
  highlightRows?: number[]
}

/** 분수 — 2·4단원. 타입만 선언, 렌더러는 아직 없음 */
export type FractionSpec = {
  items: { whole?: number; numerator: number; denominator: number; label?: string }[]
  operator?: '+' | '-' | '×' | '÷'
}

/** 도형 — 3·5단원. 타입만 선언, 렌더러는 아직 없음 */
export type FigureSpec = {
  /** banked 방식으로 미리 그려 둔 도형의 id */
  bankId: string
  labels?: { at: string; text: string }[]
}

export type Visual =
  | { kind: 'numberline'; spec: NumberLineSpec }
  | { kind: 'fraction'; spec: FractionSpec }
  | { kind: 'figure'; spec: FigureSpec }
  | { kind: 'table'; spec: TableSpec }

/* ── 문항 ─────────────────────────────────────────────────── */

export type Problem = {
  id: string
  /** 'T1' ~ 'T7' */
  templateId: string
  /** 어떤 변주로 생성됐는지. 검수·통계용 */
  params: Record<string, string>
  difficulty: Difficulty
  /** 1 | 2 | 3 */
  points: number
  /** 발문. 2줄 이내 */
  prompt: string
  /** 그림이 필요한 문항만 */
  visual?: Visual
  /** 없으면 단답 입력형 */
  choices?: string[]
  /**
   * 보기가 그림인 문항(예: 말 → 수직선 고르기)에서 각 보기에 딸린 그림.
   * choices[i] 와 choiceVisuals[i] 가 짝이다.
   */
  choiceVisuals?: Visual[]
  /** 배열이면 '모두 고르기' 문항 — 순서와 무관하게 집합이 일치해야 정답 */
  answer: string | string[]
  /** 필수. 게임 후 오답 해설에 쓴다 */
  explanation: string
  /** 성취기준 */
  standard: '6수01-02' | '6수01-03' | '6수01-02·03'
}

export type SetConfig = {
  unit: string
  counts: { easy: number; mid: number; hard: number }
}

/* ── 단원 모듈 계약 ────────────────────────────────────────── */

export type UnitModule = {
  /** '5-2-1' — 학년-학기-단원 */
  id: string
  name: string
  grade: number
  semester: number
  unit: number
  /**
   * generated = 수치를 랜덤 생성 (1·2·4·6단원)
   * banked    = 미리 그려 둔 도형 은행에서 조합 (3·5단원)
   */
  mode: 'generated' | 'banked'
  generate(seed: string, config: SetConfig): Problem[]
}

/* ── 템플릿 내부 계약 (단원 모듈 안에서만 씀) ──────────────── */

/** id 와 points 는 세트 조립 단계에서 붙인다 */
export type Draft = Omit<Problem, 'id' | 'points'>

export type Template = {
  id: string
  name: string
  /** 이 템플릿이 만들 수 있는 난이도 */
  supports: Difficulty[]
  /** 범위 계열인지 어림 계열인지. 세트의 성취기준 균형을 맞추는 데 쓴다 */
  family: 'range' | 'estimate' | 'both'
  /** 가드를 못 맞추면 null 을 돌려준다. 호출한 쪽이 재시도한다 */
  generate(rng: import('../lib/rng').Rng, difficulty: Difficulty): Draft | null
}
