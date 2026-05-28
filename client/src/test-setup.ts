import '@testing-library/jest-dom';

// Mock window.matchMedia for jsdom
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},  // deprecated
    removeListener: () => {}, // deprecated
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
});

// Mock navigator.storage.persist if not available
if (!navigator.storage) {
  Object.defineProperty(navigator, 'storage', {
    value: {
      persist: () => Promise.resolve(false),
    },
    writable: true,
  });
} else if (!navigator.storage.persist) {
  navigator.storage.persist = () => Promise.resolve(false);
}
