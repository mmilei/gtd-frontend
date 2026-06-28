import { defineConfig, loadEnv } from 'vite'
import { fileURLToPath } from 'url'
import { dirname, resolve } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const isMock = env.VITE_MOCK === 'true'

  return {
    base: command === 'build' ? '/gtd-frontend/' : '/',
    resolve: {
      alias: isMock
        ? [{ find: /^.*\/api\.js$/, replacement: resolve(__dirname, 'src/api.mock.js') }]
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
