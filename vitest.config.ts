import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts on purpose: the app config swaps lib/api for the in-memory
// mock when VITE_MOCK=true, while tests always import the real module shape and stub it with
// vi.mock — mixing the two alias strategies in one file invites confusing test doubles.
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['src/test/setup.ts'],
  },
})
