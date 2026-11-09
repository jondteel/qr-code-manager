export function useAccountReadiness() {
  const request = useRequestFetch()
  return async () => {
    try { return await request<{ state: string }>('/api/auth/readiness', { retry: 0 }) }
    catch (error: any) { return { state: error?.data?.state ?? 'temporarily-unavailable' } }
  }
}
