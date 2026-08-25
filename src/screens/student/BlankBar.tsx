/**
 * "아직 안 푼 문제가 있어요" 알림 줄. 누르면 첫 빈 문제로 간다.
 *
 * 세션 풀이 화면과 혼자 풀기가 **같은 규칙으로 보여야** 한다.
 * 한쪽만 고치면 아이들이 화면마다 다르게 배우게 된다.
 *
 * 번호를 언제 늘어놓을지가 이 파일의 전부다.
 *   - 아직 하나도 안 풀었으면 번호를 안 쓴다. 1번부터 끝번까지 다 적히면 시끄럽기만 하다
 *   - 몇 개 안 남았을 때만 번호를 적는다. 그때가 정말 필요한 순간이다
 *   - 많이 남았으면 개수만 알려 준다
 */

/** 번호를 늘어놓을 최대 개수 */
const LIST_MAX = 6

type Props = {
  /** 안 푼 문제들의 자리 번호(0부터) */
  blanks: number[]
  total: number
  onGo: () => void
}

export function BlankBar({ blanks, total, onGo }: Props) {
  if (blanks.length === 0) return null

  const none = blanks.length === total
  const list = !none && blanks.length <= LIST_MAX

  return (
    <button className="blankbar" onClick={onGo}>
      <span>
        {none ? (
          <>아직 <b>한 문제도</b> 안 풀었어요</>
        ) : (
          <>
            아직 <b>{blanks.length}문제</b>가 비었어요
            {list && <> · {blanks.map((i) => i + 1).join(', ')}번</>}
          </>
        )}
      </span>
      <span className="blankbar-go">안 푼 문제로 가기</span>
    </button>
  )
}
