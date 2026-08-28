import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      // Measure the unit-testable logic. The browser-integration layer
      // (content.js / popup.js / background.js) depends on CSS.highlights,
      // caret hit-testing, and the chrome.* APIs, none of which exist under
      // jsdom; those are verified manually per docs/VERIFY.md.
      include: ['src/patterns.js', 'src/detect.js', 'src/meta.js'],
      reporter: ['text', 'text-summary'],
    },
  },
});
