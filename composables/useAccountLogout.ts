export function useAccountLogout() {
  const client = useSupabaseClient()
  const logoutError = useState('account-logout-error', () => '')
  const logoutBusy = useState('account-logout-busy', () => false)
  const signOut = async () => {
    if (logoutBusy.value) return
    logoutBusy.value = true; logoutError.value = ''
    try {
      const { error } = await client.auth.signOut({ scope: 'local' })
      if (error) { logoutError.value = 'Sign out could not be confirmed. Your session may still be active. Please retry.'; return }
      useSupabaseUser().value = null
      useSupabaseSession().value = null
      await navigateTo('/login')
    } catch { logoutError.value = 'Sign out could not be confirmed. Your session may still be active. Please retry.' }
    finally { logoutBusy.value = false }
  }
  return { signOut, logoutError, logoutBusy }
}
