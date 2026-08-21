/**
 * Firebase 초기화. 설정값은 .env.local 에 있다(.env.example 참고).
 *
 * 값이 비어 있으면 여기서 바로 에러를 낸다 —
 * 조용히 연결이 안 된 채로 화면이 도는 게 제일 찾기 어렵다.
 */

import { initializeApp, getApp, getApps, type FirebaseApp } from 'firebase/app'
import { getAuth, signInAnonymously, onAuthStateChanged, type Auth } from 'firebase/auth'
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
  auth = getAuth(app)
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
