/**
 * 라우팅. HashRouter 를 쓴다 —
 * GitHub Pages 는 서버 라우팅을 못 해서 /play/ABC123 을 새로고침하면 404 가 난다.
 * 해시(#/play/ABC123)면 리포 이름이 무엇이든 그대로 돈다.
 */

import { lazy, Suspense } from 'react'
import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { Practice } from './screens/student/Practice'

/*
 * **Firebase 를 쓰는 화면은 따로 떼어 나중에 받는다.**
 *
 * Firebase 묶음은 압축해도 200KB 가 넘는다. 처음 화면과 혼자 풀기는
 * Firebase 가 전혀 필요 없는데, 한 덩어리로 묶으면 그것까지 다 받고서야 화면이 뜬다.
 *
 * 학교 와이파이가 느릴 때 이 차이가 크다. 그리고 학교 필터에 막혀
 * 세션 기능을 못 쓰는 날에도 **혼자 풀기는 가볍게 열려야 한다.**
 */
const BoardView = lazy(() => import('./screens/board/BoardView').then((m) => ({ default: m.BoardView })))
const CheckView = lazy(() => import('./screens/CheckView').then((m) => ({ default: m.CheckView })))
const Review = lazy(() => import('./screens/review/Review').then((m) => ({ default: m.Review })))
const JoinView = lazy(() => import('./screens/student/JoinView').then((m) => ({ default: m.JoinView })))
const PlayView = lazy(() => import('./screens/student/PlayView').then((m) => ({ default: m.PlayView })))
const TeacherHome = lazy(() => import('./screens/teacher/TeacherHome').then((m) => ({ default: m.TeacherHome })))
const TeacherConsole = lazy(() =>
  import('./screens/teacher/TeacherConsole').then((m) => ({ default: m.TeacherConsole })),
)
const StageLab = lazy(() => import('./screens/dev/StageLab').then((m) => ({ default: m.StageLab })))

function Loading() {
  return (
    <div className="wrap play-center">
      <p>불러오는 중…</p>
    </div>
  )
}

/**
 * QR 로 들어온 학생 받기.
 *
 * QR 에는 `?c=ABC123` 형태로 넣고 **`#` 을 넣지 않는다.**
 * 크롬북 카메라·QR 앱 중에 주소에 `#` 이 있으면 못 여는 것들이 있어서,
 * 찍어도 빈 화면만 뜨는 일이 생긴다. 여기서 `?c=` 를 해시 주소로 바꿔 준다.
 */
function redirectFromQr(): void {
  const code = new URLSearchParams(location.search).get('c')
  if (!code) return
  const clean = code.trim().toUpperCase().slice(0, 6)
  if (clean.length !== 6) return
  // 주소창에서 ?c= 를 지워 둔다. 새로고침해도 같은 자리로 돌아오게
  history.replaceState(null, '', `${location.pathname}#/play/${clean}`)
}
redirectFromQr()

function Landing() {
  return (
    <div className="wrap play-center">
      <header className="site-head">
        <p className="eyebrow">5학년 수학</p>
        <h1>수의 범위와 어림하기</h1>
      </header>
      <div className="landing">
        <Link className="landing-card" to="/join">
          <b>학생</b>
          <span>코드 넣고 들어가기</span>
        </Link>
        <Link className="landing-card" to="/teacher">
          <b>선생님</b>
          <span>수업 세션 만들기</span>
        </Link>
        <Link className="landing-card" to="/practice">
          <b>혼자 연습</b>
          <span>인터넷 없이 풀어보기</span>
        </Link>
        <Link className="landing-card" to="/review">
          <b>기록 보기</b>
          <span>지난 오답 확인</span>
        </Link>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <HashRouter>
      <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<JoinView />} />
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/teacher/s/:id" element={<TeacherConsole />} />
        <Route path="/board/:code" element={<BoardView />} />
        <Route path="/play/:code" element={<PlayView />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/review" element={<Review />} />
        {/* 학교에서 뭐가 막혔는지 확인하는 화면 */}
        <Route path="/check" element={<CheckView />} />
        {/* 무대 렌더링 확인용. 수업에서는 안 쓴다 */}
        <Route path="/stage" element={<StageLab />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </Suspense>
    </HashRouter>
  )
}
