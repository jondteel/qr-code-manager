import type { H3Event } from 'h3'

type HttpErrorFactory = (statusCode: number, statusMessage: string) => Error

interface KeepAliveLogger {
  info(message: string): void
  warn(message: string): void
  error(message: string): void
}

interface KeepAliveDependencies {
  getSecret(): string | undefined
  getAuthorization(event: H3Event): string | undefined
  getRequestId?(event: H3Event): string | undefined
  getDeploymentId?(): string | undefined
  setResponseHeader(event: H3Event, name: string, value: string): void
  query(): Promise<unknown>
  createHttpError: HttpErrorFactory
  logger?: KeepAliveLogger
  now?(): Date
  monotonicNow?(): number
}

export function createKeepAliveHandler(
  dependencies: KeepAliveDependencies,
): (event: H3Event) => Promise<{ success: true; checkedAt: string }>
