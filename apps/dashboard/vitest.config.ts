import { defineConfig } from 'vitest/config';

// Dedicated Vitest config so unit tests run in a plain Node environment without
// loading the app's React/Tailwind Vite plugins. The privacy scrubbers under test
// are pure functions and need no DOM.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
