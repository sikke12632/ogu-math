/**
 * 게임 모듈 계약.
 * 지켜야 할 것은 하나뿐이다 — **입력은 팀 배정, 출력은 팀별 점수.**
 * 그 사이는 게임 마음대로. 이러면 완전히 다른 장르를 붙여도 세션 흐름은 그대로다.
 *
 * 이번 단계에서는 타입만 확정한다. 게임 구현은 STEP 8.
 */

import type { ComponentType } from 'react'

export type StudentId = string
export type TeamId = string

/**
 * 세션 레이어가 인원을 어떻게 묶어야 하는지.
 * coop 이면 매칭·응원단장 로직이 통째로 건너뛰어진다.
 */
export type Grouping = 'duel' | 'freeforall' | 'teamwise' | 'coop'

export type Team = {
  id: TeamId
  name: string
  members: StudentId[]
}

/** 한 판의 결과 */
export type MatchResult = {
  matchId: string
  round: number
  /** duel 이면 2명 */
  participants: StudentId[]
  /** 무승부면 null */
  winner: StudentId | null
  /** 끊김으로 진 경우 */
  byDisconnect?: boolean
}

export type TeamScore = {
  teamId: TeamId
  /** 팀 승수 합계 */
  wins: number
  /** 보드 뷰에 띄울 한 줄 요약 */
  summary?: string
}

export type GameStudentProps = {
  selfId: StudentId
  teams: Team[]
  round: number
}

export type GameBoardProps = {
  teams: Team[]
  scores: TeamScore[]
  round: number
}

export type GameModule = {
  id: string
  name: string
  /** 룰 한 줄 설명. 교사 콘솔의 게임 선택 화면에 뜬다 */
  tagline: string
  grouping: Grouping
  /** duel 이면 2 */
  matchSize: number
  /** 판 수 */
  rounds: number
  Component: ComponentType<GameStudentProps>
  BoardComponent: ComponentType<GameBoardProps>
  resolve(matchResults: MatchResult[], teams: Team[]): TeamScore[]
}
