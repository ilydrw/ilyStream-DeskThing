import type { Logger } from './logger.js'
import type { IlyStreamClient } from './ilystream-client.js'
import type { IlyStreamEventStream } from './event-stream.js'
import type { Catalog, ConnectionState } from '../shared/messages.js'

export interface RuntimeState {
  host: string | null
  token: string | null
  lastCatalog: Catalog | null
  lastFetchAt: string | null
  lastError: string | null
  liveStream: boolean
}

export interface ServerAppContext {
  logger: Logger
  runtime: RuntimeState
  client: IlyStreamClient
  events: IlyStreamEventStream
  /** Push the current connection state to the client. */
  broadcastStatus: () => void
  /** Push the cached catalog (or fetch + push) to the client. */
  broadcastCatalog: (refresh?: boolean) => Promise<void>
  /** Open the SSE bridge using the saved host + token. No-op if missing. */
  startEventStream: () => void
  /** Tear down the SSE bridge. */
  stopEventStream: () => void
  /** Push the PC wall clock to the client. */
  syncTime: () => void
}

export function createRuntimeState(): RuntimeState {
  return {
    host: null,
    token: null,
    lastCatalog: null,
    lastFetchAt: null,
    lastError: null,
    liveStream: false
  }
}

export function buildConnectionState(runtime: RuntimeState): ConnectionState {
  if (!runtime.host || !runtime.token) {
    return {
      status: 'unconfigured',
      host: runtime.host || '',
      hasToken: !!runtime.token
    }
  }
  if (runtime.lastError) {
    return {
      status: 'error',
      host: runtime.host,
      hasToken: true,
      errorMessage: runtime.lastError,
      lastFetchAt: runtime.lastFetchAt || undefined
    }
  }
  return {
    status: runtime.lastCatalog ? 'connected' : 'connecting',
    host: runtime.host,
    hasToken: true,
    lastFetchAt: runtime.lastFetchAt || undefined,
    liveStream: runtime.liveStream
  }
}
