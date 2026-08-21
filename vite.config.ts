import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages 배포용. 리포 이름을 몰라도 되도록 상대 경로를 쓴다.
// 리포 이름이 정해지면 './' 대신 '/리포이름/' 으로 바꿔도 된다.
export default defineConfig({
  plugins: [react()],
  base: './',
})
