import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

const DEFAULT_GOOGLE_WEB_CLIENT_ID =
  '609254164052-81mv1bn2kegd4nmic386q1fdv3o5oviq.apps.googleusercontent.com'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const googleClientId =
    env.VITE_GOOGLE_CLIENT_ID?.trim() || DEFAULT_GOOGLE_WEB_CLIENT_ID

  return {
    plugins: [react()],
    define: {
      'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(googleClientId),
    },
  }
})
