import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL only auto-registers its cleanup under `globals: true`; this project keeps explicit imports,
// so unmount between tests must be registered by hand or renders pile up across tests.
afterEach(cleanup)

// jsdom implements no matchMedia; components that check prefers-reduced-motion would throw on
// mount. Everything is reported as not matching, i.e. motion is allowed.
if (!window.matchMedia) {
  window.matchMedia = (media: string) =>
    ({
      media,
      matches: false,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as MediaQueryList
}
