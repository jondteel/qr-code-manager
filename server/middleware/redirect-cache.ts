import { defineEventHandler, setResponseHeaders, setResponseStatus } from 'h3'

// Runs before routing, including missing /s and /s/ paths and generic errors.
export default defineEventHandler(event => {
  // Inspect the raw path: URL parsing would normalize rejected dot segments.
  const path = event.path.split('?')[0]
  if (path === '/s' || path.startsWith('/s/')) {
    setResponseHeaders(event, {
      'cache-control': 'no-store',
      'cdn-cache-control': 'no-store',
      'vercel-cdn-cache-control': 'no-store',
    })
    if (!/^\/s\/[^/]+$/.test(path)) {
      setResponseStatus(event, 404, 'Link unavailable')
      return { statusCode: 404, statusMessage: 'Link unavailable' }
    }
  }
})
