/**
 * 세션 데이터 모델. Firebase RTDB 에 이 모양 그대로 들어간다.
 *
 * phase 는 **교사 클라이언트만** 바꾼다. 학생·보드 화면은 읽기만 한다.
 * 타이머도 각자 세지 않고 meta.startedAt 에서 계산해 표시만 한다.
 */

import type { Problem, Visual } from '../units/_types'
import type { Answer } from './grade'

export type Phase = 'lobby' | 'quiz' | 'grading' | 'teaming' | 'game' | 'result'

export const PHASE_LABEL: Record<Phase, string> = {
  lobby: '대기실',
  quiz: '문제 풀이',
  grading: '채점',
  teaming: '팀 발표',
  game: '팀 대결',
  result: '결과',
}

export const PHASE_ORDER: Phase[] = ['lobby', 'quiz', 'grading', 'teaming', 'game', 'result']

export type StudentId = string

export type SessionMeta = {
  code: string
  unitId: string
  gameId: string
  phase: Phase
  createdAt: number
  /** 풀이 시작 시각. 타이머의 단일 기준 */
  quizStartedAt: number | null
  quizSeconds: number
  rounds: number
  /** 교사가 타이머를 늘렸을 때 더해지는 초 */
  extraSeconds: number
  paused: boolean
  /** 일시정지한 시각 — 다시 시작할 때 그만큼 밀어 준다 */
  pausedAt: number | null
}

export type RosterEntry = {
  name: string
  joinedAt: number
  connected: boolean
  lastSeen: number
}

export type QuizEntry = {
  answers: Record<string, Answer>
  submittedAt: number | null
  score: number | null
  correctCount: number | null
}

export type TeamRecord = {
  id: string
  name: string
  members: StudentId[]
}

/** 한 판의 매칭 하나 */
export type MatchRecord = {
  id: string
  round: number
  /** 정렬된 두 명. 항상 오름차순으로 저장한다 (덱 계산의 기준) */
  players: [StudentId, StudentId]
  /** 각 턴에 누가 무엇을 골랐는지. 이것만 있으면 판 전체가 재현된다 */
  turns?: Record<string, Record<StudentId, 'draw' | 'stop'>>
  /** 연결이 끊겨 진 사람 */
  forfeit?: StudentId
  /** 무승부면 'draw' */
  winner?: StudentId | 'draw'
  endedAt?: number
}

export type RoundRecord = {
  round: number
  matches: Record<string, MatchRecord>
  /** 상대가 없어 응원단장이 된 학생들 */
  cheerleaders: StudentId[]
}

export type Session = {
  meta: SessionMeta
  problems: Problem[]
  roster: Record<StudentId, RosterEntry>
  quiz: Record<StudentId, QuizEntry>
  teams: Record<string, TeamRecord>
  game: {
    round: number
    rounds: Record<string, RoundRecord>
    /** 응원 보내기 — 받는 사람 id → 마지막 응원 시각 */
    cheers?: Record<StudentId, number>
    /** MVP 지목 — 지목한 사람 → 지목당한 사람 */
    mvp?: Record<StudentId, StudentId>
  } | null
}

/** 세션이 끝난 뒤 /review 에서 읽는 기록 */
export type ArchiveEntry = {
  sessionId: string
  code: string
  unitId: string
  date: number
  name: string
  score: number
  total: number
  items: {
    prompt: string
    given: string
    answer: string
    explanation: string
    correct: boolean
    /** 그림 문항은 발문만 남기면 나중에 다시 볼 수가 없다 */
    visual?: Visual
    choices?: string[]
    choiceVisuals?: Visual[]
  }[]
}
