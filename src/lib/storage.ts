/**
 * 브라우저 저장은 localStorage 만 쓴다 (학생 이름, 답안 미러링).
 * 세션이 붙으면 서버가 단일 소스이고 여기는 재접속 복구용 미러가 된다.
 */

const PREFIX = 'ogu-math:'

export function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key)
    if (raw === null) return fallback
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function save(key: string, value: unknown): void {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value))
  } catch {
    // 저장에 실패해도 풀이는 계속되어야 한다. 조용히 넘어간다
  }
}

export function remove(key: string): void {
  try {
    localStorage.removeItem(PREFIX + key)
  } catch {
    /* 무시 */
  }
}
