/**
 * 라우팅. HashRouter 를 쓴다 —
 * GitHub Pages 는 서버 라우팅을 못 해서 /play/ABC123 을 새로고침하면 404 가 난다.
 * 해시(#/play/ABC123)면 리포 이름이 무엇이든 그대로 돈다.
 */

import { HashRouter, Link, Navigate, Route, Routes } from 'react-router-dom'
import { BoardView } from './screens/board/BoardView'
import { StageLab } from './screens/dev/StageLab'
import { Review } from './screens/review/Review'
import { JoinView } from './screens/student/JoinView'
import { PlayView } from './screens/student/PlayView'
import { Practice } from './screens/student/Practice'
import { TeacherConsole } from './screens/teacher/TeacherConsole'
import { TeacherHome } from './screens/teacher/TeacherHome'

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
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/join" element={<JoinView />} />
        <Route path="/teacher" element={<TeacherHome />} />
        <Route path="/teacher/s/:id" element={<TeacherConsole />} />
        <Route path="/board/:code" element={<BoardView />} />
        <Route path="/play/:code" element={<PlayView />} />
        <Route path="/practice" element={<Practice />} />
        <Route path="/review" element={<Review />} />
        {/* 무대 렌더링 확인용. 수업에서는 안 쓴다 */}
        <Route path="/stage" element={<StageLab />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </HashRouter>
  )
}
