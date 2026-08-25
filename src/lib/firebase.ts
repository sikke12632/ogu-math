/**
 * Firebase 초기화. 설정값은 .env.local 에 있다(.env.example 참고).
 *
 * 값이 비어 있으면 여기서 바로 에러를 낸다 —
 * 조용히 연결이 안 된 채로 화면이 도는 게 제일 찾기 어렵다.
 */

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app'
import {
  browserLocalPersistence, browserSessionPersistence, getAuth, inMemoryPersistence,
  indexedDBLocalPersistence, initializeAuth, onAuthStateChanged, signInAnonymously, type Auth,
} from 'firebase/auth'
import { getDatabase, type Database } from 'firebase/database'

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY as string,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN as string,
  databaseURL: import.meta.env.VITE_FB_DATABASE_URL as string,
  projectId: import.meta.env.VITE_FB_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FB_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FB_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FB_APP_ID as string,
}

export function isFirebaseConfigured(): boolean {
  return Object.values(cfg).every((v) => typeof v === 'string' && v.length > 0)
}

/**
 * 이 앱이 실제로 접속하는 주소들.
 * 학교 필터(웹키퍼 등)에 허용 요청을 넣으려면 이 목록이 정확해야 한다.
 * 진단 화면(#/check)이 하나씩 따로 두드려 본다.
 */
export type FirebaseHost = {
  key: string
  /** 사람이 읽는 이름 */
  label: string
  host: string
  /** 두드려 볼 주소 */
  probe: string
  /** 막히면 무슨 일이 벌어지나 */
  effect: string
}

export function firebaseHosts(): FirebaseHost[] {
  let dbHost = ''
  try {
    dbHost = new URL(cfg.databaseURL).host
  } catch {
    dbHost = ''
  }
  return [
    {
      key: 'idtoolkit',
      label: '로그인 서버',
      host: 'identitytoolkit.googleapis.com',
      probe: 'https://identitytoolkit.googleapis.com/v1/projects',
      effect: '학생이 접속 자체를 못 합니다. 이름 고르는 화면에서 멈춥니다.',
    },
    {
      key: 'securetoken',
      label: '로그인 유지 서버',
      host: 'securetoken.googleapis.com',
      // 실제 토큰 주소(/v1/token)는 POST 전용이라 그냥 두드리면 막히지 않았는데도 실패로 보인다.
      // 가짜 경보를 내면 정보부에 엉뚱한 주소를 보내게 되므로, 응답이 제대로 오는 주소를 쓴다
      probe: 'https://securetoken.googleapis.com/$discovery/rest?version=v1',
      effect: '처음엔 되다가 한 시간쯤 뒤에 갑자기 끊깁니다.',
    },
    {
      key: 'db',
      label: '데이터 서버',
      host: dbHost,
      probe: `https://${dbHost}/.json?shallow=true`,
      effect:
        '접속은 되는데 문제가 안 뜨고 답도 저장되지 않습니다. ' +
        '실시간 연결은 s-gke-... 로 시작하는 다른 이름에 붙으므로, ' +
        '허용 요청은 *.firebasedatabase.app 으로 해야 합니다.',
    },
  ]
}

/** 실시간 연결(WebSocket)용 주소. HTTPS 는 되는데 이것만 막히는 학교가 있다 */
export function firebaseSocketUrl(): string {
  try {
    const host = new URL(cfg.databaseURL).host
    const ns = host.split('.')[0] ?? ''
    return `wss://${host}/.ws?v=5&ns=${ns}`
  } catch {
    return ''
  }
}

let app: FirebaseApp | null = null
let db: Database | null = null
let auth: Auth | null = null

function init(): void {
  if (app) return
  if (!isFirebaseConfigured()) {
    throw new Error('Firebase 설정값이 없습니다. .env.local 을 확인하세요 (.env.example 참고).')
  }
  app = getApps().length ? getApp() : initializeApp(cfg)
  db = getDatabase(app)
  auth = makeAuth(app)
}

/**
 * 로그인 준비.
 *
 * **`getAuth()` 를 쓰지 않는 이유가 있다.** 그걸 쓰면 Firebase 가
 * 팝업·리다이렉트 로그인용 준비를 같이 한다. 우리는 익명 로그인만 쓰는데도
 * `apis.google.com` 에서 스크립트를 받아오고 `firebaseapp.com` 에 숨은 프레임을 만든다.
 *
 * 학교 필터(웹키퍼)가 그 두 주소를 막으면 **탭이 통째로 죽는다.**
 * 게다가 이 로딩은 로그인이 끝난 뒤에 뒤늦게 일어나서,
 * "다 되는 것처럼 보이다가 몇 초 뒤에 하얘지는" 증상이 된다.
 *
 * `initializeAuth` 로 팝업 준비를 빼면 접속하는 주소가 둘 줄어든다.
 * 익명 로그인에는 아무 영향이 없다 — 팝업 로그인을 쓰게 되면 그때 되살려야 한다.
 */
function makeAuth(a: FirebaseApp): Auth {
  try {
    return initializeAuth(a, {
      persistence: [
        indexedDBLocalPersistence,
        browserLocalPersistence,
        browserSessionPersistence,
        inMemoryPersistence,
      ],
    })
  } catch {
    // 이미 한 번 준비된 경우(개발 중 새로고침 등). 그때는 있는 것을 쓴다
    return getAuth(a)
  }
}

export function getDb(): Database {
  init()
  return db!
}

/** 익명 로그인. 학생 계정·비밀번호는 만들지 않는다 */
let signInPromise: Promise<string> | null = null

export function ensureSignedIn(): Promise<string> {
  init()
  if (signInPromise) return signInPromise
  signInPromise = new Promise<string>((resolve, reject) => {
    const a = auth!
    if (a.currentUser) return resolve(a.currentUser.uid)
    const stop = onAuthStateChanged(a, (u) => {
      if (u) {
        stop()
        resolve(u.uid)
      }
    })
    signInAnonymously(a).catch((e) => {
      stop()
      signInPromise = null
      reject(e)
    })
  })
  return signInPromise
}
