import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL only auto-registers its cleanup under `globals: true`; this project keeps explicit imports,
// so unmount between tests must be registered by hand or renders pile up across tests.
afterEach(cleanup)
