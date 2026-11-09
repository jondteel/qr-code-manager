import { accountReturnPath } from '~/utils/auth-navigation.mjs'
export default defineNuxtRouteMiddleware(async to => {
  if (!/^\/(dashboard|generate|analytics|edit)(\/|$)/.test(to.path)) return
  const state = await useAccountReadiness()()
  if (state.state === 'ready') return
  const redirect = accountReturnPath(to.path)
  return navigateTo({ path: state.state === 'invalid-session' ? '/login' : '/onboarding', query: { redirect } })
})
