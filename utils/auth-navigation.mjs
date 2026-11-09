export function accountReturnPath(value) {
  if (typeof value !== 'string' || !/^\/(dashboard|generate|analytics|edit)(\/|$)/.test(value)) return '/dashboard'
  if (/[\\%?#\s\x00-\x1f\x7f]/.test(value) || value.includes('//') || value.includes('/.') || value.length > 200) return '/dashboard'
  if (!/^\/(dashboard|generate|analytics)$/.test(value) && !/^\/(analytics|edit)\/[A-Za-z0-9_-]+$/.test(value)) return '/dashboard'
  return value
}
