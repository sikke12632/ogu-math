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
  /**
   * 성취기준. 검수용 덤프(#dump)에만 찍힌다. 학생·교사 화면에는 안 나온다.
   *
   * 단원마다 번호가 다르므로 여기서 타입으로 묶지 않는다.
   * 처음에는 1단원 것만 나열했는데, 2단원(6수01-09)을 넣으려니 코어를 고쳐야 했다.
   */
  standard: string
}

export type SetConfig = {
  unit: string
  counts: { easy: number; mid: number; hard: number }
  /**
   * 낼 유형만 골라 쓴다. 비어 있거나 없으면 단원 전체.
   * 예를 들어 '이상·이하·초과·미만' 만 배운 날은 T1 하나만 넣는다.
   */
  templateIds?: string[]
}

/* ── 단원 모듈 계약 ────────────────────────────────────────── */

/** 교사 화면이 출제 범위를 그릴 때 쓰는 정보 */
export type TopicInfo = {
  id: string
  name: string
  description: string
  topic: Topic
  /** 이 유형이 낼 수 있는 난이도 */
  levels: Difficulty[]
}

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
  /** 출제 범위 목록. 교사 화면이 체크박스를 그리는 데 쓴다 */
  topics(): TopicInfo[]
  /** 미리보기용 예시 한 문항. 교사가 '이런 게 나옵니다' 를 볼 수 있게 */
  sample(templateId: string, seed: string): Problem | null
}

/* ── 템플릿 내부 계약 (단원 모듈 안에서만 씀) ──────────────── */

/** id 와 points 는 세트 조립 단계에서 붙인다 */
export type Draft = Omit<Problem, 'id' | 'points'>

/**
 * 교사 화면에서 출제 범위를 고를 때 묶는 갈래.
 *
 * **단원마다 다르므로 여기서 값을 못박지 않는다.**
 * 처음에는 1단원 갈래만 나열했는데, 2단원(분수 × 자연수 …)을 넣으려니
 * 코어를 고쳐야 했다. 갈래 이름은 교사에게 보여 줄 글자일 뿐이고,
 * 타입으로 묶어서 얻는 게 없다.
 */
export type Topic = string

export type Template = {
  id: string
  name: string
  /**
   * 교사가 읽을 한 줄 설명.
   * 'T1' 같은 부호만 보고는 무엇을 내는 것인지 알 수 없다.
   */
  description: string
  /** 갈래 */
  topic: Topic
  /** 이 템플릿이 만들 수 있는 난이도 */
  supports: Difficulty[]
  /**
   * 세트 안에서 계열 균형을 맞추는 데 쓰는 꼬리표. **단원이 알아서 정한다.**
   * 1단원은 'range' / 'estimate' 로 나누고, 2단원은 '계산' / '활용' 으로 나눈다.
   * 이름은 자유지만 값은 반드시 넣는다 — 빈 채로 두면 균형 계산이 조용히 어긋난다.
   */
  family: string
  /** 가드를 못 맞추면 null 을 돌려준다. 호출한 쪽이 재시도한다 */
  generate(rng: import('../lib/rng').Rng, difficulty: Difficulty): Draft | null
}
