import { getRequestURL, setHeader, setResponseStatus } from 'h3'
// Fixed-path recovery surface: never log or reflect query/capability material.
export default defineEventHandler(event => {
  const path = getRequestURL(event).pathname
  if (path === '/auth/recovery' || path === '/forgot-password' || path.startsWith('/api/auth/recovery-')) {
    setHeader(event,'Cache-Control','no-store')
    setHeader(event,'Referrer-Policy','no-referrer')
    setHeader(event,'X-Content-Type-Options','nosniff')
    setHeader(event,'X-Frame-Options','DENY')
    setHeader(event,'Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'")
    if (getRequestURL(event).search) {
      setResponseStatus(event,400)
      return 'Open the recovery link from your email without additional query parameters.'
    }
  }
})
