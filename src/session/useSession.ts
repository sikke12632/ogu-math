/** 세 화면이 함께 쓰는 훅. 세션 구독, 남은 시간 계산, 팀 점수 집계 */

import { useEffect, useMemo, useState } from 'react'
import { getGame } from '../games'
import type { MatchResult, TeamScore } from '../games/_types'
import { watchSession } from './api'
import { tallyTeamWins } from './teams'
import type { MatchRecord, Session, StudentId, TeamRecord } from './types'

export function useSession(sessionId: string | undefined): {
  session: Session | null
  loading: boolean
  error: string | null
} {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!sessionId) return
    setLoading(true)
    let stop = (): void => {}
    try {
      stop = watchSession(sessionId, (s) => {
        if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__session = s
        setSession(s)
        setLoading(false)
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setLoading(false)
    }
    return () => stop()
  }, [sessionId])

  return { session, loading, error }
}

/**
 * 주기적으로 다시 그리게 하는 시계.
 * 배경 탭에서는 브라우저가 setInterval 을 늦춘다. 그래서 화면이 다시 보일 때
 * 곧바로 맞는 시간이 나오도록 visibilitychange 에서도 한 번 갱신한다.
 */
export function useTick(ms = 500): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const bump = (): void => setNow(Date.now())
    const t = setInterval(bump, ms)
    document.addEventListener('visibilitychange', bump)
    window.addEventListener('focus', bump)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', bump)
      window.removeEventListener('focus', bump)
    }
  }, [ms])
  return now
}

/**
 * 남은 풀이 시간. **각자 세지 않고 meta.quizStartedAt 에서 계산한다.**
 * 클라이언트마다 시계가 1초 달라도 같은 값이 나오게.
 *
 * 시각은 인자로 받은 값이 아니라 **그릴 때마다 Date.now() 로 다시 읽는다.**
 * 브라우저는 배경 탭의 setInterval 을 늦추거나 멈추기 때문에, 인자만 믿으면
 * 교사가 전자칠판 창으로 옮겼다 돌아왔을 때 시간이 어긋난다.
 * `_tick` 은 다시 그리게 하는 용도로만 쓴다.
 */
export function quizTimeLeft(session: Session | null, _tick?: number): number {
  const m = session?.meta
  if (!m || !m.quizStartedAt) return 0
  const total = (m.quizSeconds + (m.extraSeconds ?? 0)) * 1000
  const at = m.paused && m.pausedAt ? m.pausedAt : Date.now()
  return Math.min(total, Math.max(0, total - (at - m.quizStartedAt)))
}

export function fmtClock(ms: number): string {
  const s = Math.ceil(ms / 1000)
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

export const teamList = (session: Session | null): TeamRecord[] =>
  Object.values(session?.teams ?? {}).sort((a, b) => a.id.localeCompare(b.id))

export function allMatches(session: Session | null): MatchRecord[] {
  const rounds = session?.game?.rounds ?? {}
  return Object.values(rounds).flatMap((r) => Object.values(r.matches ?? {}))
}

export function roundMatches(session: Session | null, round: number): MatchRecord[] {
  const r = session?.game?.rounds?.[String(round)]
  return Object.values(r?.matches ?? {})
}

export function myMatch(session: Session | null, round: number, me: StudentId): MatchRecord | null {
  return roundMatches(session, round).find((m) => m.players.includes(me)) ?? null
}

export function isCheerleader(session: Session | null, round: number, me: StudentId): boolean {
  const r = session?.game?.rounds?.[String(round)]
  return (r?.cheerleaders ?? []).includes(me)
}

/** 팀 점수. 게임 모듈의 resolve() 를 통해 나온다 */
export function useTeamScores(session: Session | null): TeamScore[] {
  return useMemo(() => {
    const teams = teamList(session)
    if (teams.length === 0) return []
    const results: MatchResult[] = allMatches(session)
      .filter((m) => m.winner)
      .map((m) => ({
        matchId: m.id,
        round: m.round,
        participants: [...m.players],
        winner: m.winner === 'draw' ? null : (m.winner as StudentId),
        byDisconnect: Boolean(m.forfeit),
      }))
    try {
      const game = getGame(session?.meta.gameId ?? 'draw-duel')
      return game.resolve(results, teams)
    } catch {
      return tallyTeamWins(teams, allMatches(session)).map((t) => ({ teamId: t.teamId, wins: t.wins }))
    }
  }, [session])
}

/**
 * 화면에 보여 줄 이름. 별명이 있으면 별명, 없으면 실제 이름.
 * 칠판·친구 화면·게임에서 쓴다.
 */
export const nameOf = (session: Session | null, id: StudentId): string => {
  const r = session?.roster?.[id]
  if (!r) return '학생'
  return r.nickname && r.nickname.trim() ? r.nickname : r.name
}

/**
 * 명단에 적힌 실제 이름. **교사 화면과 오답 기록은 반드시 이걸 쓴다.**
 * 누가 냈고 누가 뭘 틀렸는지는 별명이 아니라 실명으로 알아야 한다.
 */
export const realNameOf = (session: Session | null, id: StudentId): string =>
  session?.roster?.[id]?.name ?? '학생'
