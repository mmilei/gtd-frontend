import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isMock = env.VITE_MOCK === 'true'

  return {
    base: command === 'build' ? '/gtd-frontend/' : '/',
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: isMock
        ? [{ find: /^.*\/lib\/api$/, replacement: resolve(__dirname, 'src/lib/api.mock.ts') }]
        : [],
    },
    server: {
      proxy: {
        '/api': {
          target: 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
