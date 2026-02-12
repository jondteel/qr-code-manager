/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './app.vue',
    './error.vue',
    './components/**/*.{vue,js,ts}',
    './layouts/**/*.vue',
    './pages/**/*.vue',
    './plugins/**/*.{js,ts}',
    './composables/**/*.{js,ts}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
  // Optional safety net if you want:
  safelist: ['md:flex', 'gap-x-8', 'gap-8', 'mr-8'],
}