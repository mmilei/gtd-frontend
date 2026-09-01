import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach } from 'vitest'

// RTL only auto-registers its cleanup under `globals: true`; this project keeps explicit imports,
// so unmount between tests must be registered by hand or renders pile up across tests.
afterEach(cleanup)

// jsdom implements no layout, so `Range` has no getClientRects/getBoundingClientRect. CodeMirror
// measures line geometry through them inside a requestAnimationFrame, which surfaces as an
// *unhandled* error rather than a test failure. Empty/zero geometry is the documented way to run
// CodeMirror headless: it falls back to its default character metrics, which is fine because
// nothing here asserts on pixels.
if (!Range.prototype.getClientRects) {
  Range.prototype.getClientRects = () => Object.assign([] as DOMRect[], { item: () => null }) as unknown as DOMRectList
  Range.prototype.getBoundingClientRect = () => new DOMRect()
}

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
