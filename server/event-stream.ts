import type { Logger } from './logger.js'

interface StartParams {
  host: string
  token: string
  /** Called once per parsed `{ type, payload }` envelope from the SSE stream. */
  onEvent: (type: string, payload: unknown) => void | Promise<void>
  /** Called whenever the live-stream connection state changes. */
  onStateChange: (live: boolean, error?: string) => void
}

const RECONNECT_DELAY_MS = 3_000
const MAX_BACKOFF_MS = 30_000

/**
 * Consumes ilyStream's `/api/v1/events` SSE channel from Node.
 *
 * Node 18+ fetch supports streaming response bodies, so we don't need an
 * `eventsource` polyfill — we just decode the byte stream and split on the
 * standard `\n\n` SSE frame terminator.
 */
export class IlyStreamEventStream {
  private abort: AbortController | null = null
  private reconnectTimer: NodeJS.Timeout | null = null
  private host: string | null = null
  private token: string | null = null
  private onEvent: ((type: string, payload: unknown) => void) | null = null
  private onStateChange: ((live: boolean, error?: string) => void) | null = null
  private backoff = RECONNECT_DELAY_MS
  private stopped = false

  constructor(private logger: Logger) {}

  start(params: StartParams): void {
    this.stop()
    this.stopped = false
    this.host = params.host
    this.token = params.token
    this.onEvent = params.onEvent
    this.onStateChange = params.onStateChange
    this.backoff = RECONNECT_DELAY_MS
    void this.connect()
  }

  stop(): void {
    this.stopped = true
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.abort) {
      try {
        this.abort.abort()
      } catch {
        /* ignore */
      }
      this.abort = null
    }
  }

  private async connect(): Promise<void> {
    if (this.stopped || !this.host || !this.token) return

    const cleaned = this.host.replace(/\/+$/, '')
    const withScheme = /^https?:\/\//.test(cleaned) ? cleaned : `http://${cleaned}`
    const url = `${withScheme}/api/v1/events`
    const abort = new AbortController()
    this.abort = abort

    try {
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          Accept: 'text/event-stream'
        },
        signal: abort.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`SSE connect failed (${response.status})`)
      }

      this.onStateChange?.(true)
      this.backoff = RECONNECT_DELAY_MS

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (!this.stopped) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })

        // SSE frames are separated by a blank line (\n\n).
        let separatorIndex
        while ((separatorIndex = buffer.indexOf('\n\n')) !== -1) {
          const frame = buffer.slice(0, separatorIndex)
          buffer = buffer.slice(separatorIndex + 2)
          this.processFrame(frame)
        }
      }

      // Connection closed cleanly — fall through to reconnect.
      throw new Error('Stream ended')
    } catch (err) {
      if (this.stopped) return
      const message = err instanceof Error ? err.message : 'Stream error'
      this.logger.warn('Event stream error:', message)
      this.onStateChange?.(false, message)
      this.scheduleReconnect()
    }
  }

  private processFrame(frame: string): void {
    if (!frame || frame.startsWith(':')) return // comment / keepalive

    let dataPayload = ''
    for (const rawLine of frame.split('\n')) {
      const line = rawLine.trimEnd()
      if (line.startsWith('data:')) {
        dataPayload += (dataPayload ? '\n' : '') + line.slice(5).trimStart()
      }
    }
    if (!dataPayload) return

    try {
      const envelope = JSON.parse(dataPayload) as { type?: string; payload?: unknown }
      if (typeof envelope.type === 'string') {
        void this.onEvent?.(envelope.type, envelope.payload)
      }
    } catch (err) {
      this.logger.warn('Failed to parse SSE frame:', err instanceof Error ? err.message : err)
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped) return
    const delay = this.backoff
    this.backoff = Math.min(this.backoff * 2, MAX_BACKOFF_MS)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      void this.connect()
    }, delay)
  }
}
