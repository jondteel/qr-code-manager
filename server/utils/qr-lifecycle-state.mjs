export const QR_LIFECYCLES = Object.freeze(['active', 'archived', 'retired'])
export const liveQrLifecycle = state => state === 'active' || state === 'archived'

export function lifecycleTransition(from, to) {
  if (!QR_LIFECYCLES.includes(from) || !QR_LIFECYCLES.includes(to)) return false
  return from === to || (from === 'active' && ['archived', 'retired'].includes(to)) ||
    (from === 'archived' && ['active', 'retired'].includes(to))
}
