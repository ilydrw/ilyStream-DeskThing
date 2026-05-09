import type { Catalog } from '../shared/messages.js'

/**
 * Thin HTTP wrapper around ilyStream's `/api/v1/*` endpoints. Lives on the
 * server side so the Car Thing browser never has to deal with hosts, CORS,
 * or tokens directly — only the user's PC does.
 */
export class IlyStreamClient {
  constructor(
    private getHost: () => string | null,
    private getToken: () => string | null
  ) {}

  private url(path: string): string {
    const host = this.getHost()
    if (!host) throw new Error('ilyStream host not configured')
    const cleaned = host.replace(/\/+$/, '')
    const withScheme = /^https?:\/\//.test(cleaned) ? cleaned : `http://${cleaned}`
    return `${withScheme}${path}`
  }

  private headers(includeAuth: boolean): Record<string, string> {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (includeAuth) {
      const token = this.getToken()
      if (token) headers['Authorization'] = `Bearer ${token}`
    }
    return headers
  }

  /** Exchange a 6-digit pair code for a long-lived token. */
  async pair(host: string, code: string, label: string): Promise<{ token: string }> {
    const cleaned = host.replace(/\/+$/, '')
    const withScheme = /^https?:\/\//.test(cleaned) ? cleaned : `http://${cleaned}`
    const response = await fetch(`${withScheme}/api/v1/pair/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, label })
    })
    if (!response.ok) {
      const detail = await safeJson(response)
      throw new Error(detail?.error || `Pair failed (${response.status})`)
    }
    const data = (await response.json()) as { token?: string }
    if (!data.token) throw new Error('Pair response missing token')
    return { token: data.token }
  }

  async getCatalog(): Promise<Catalog> {
    const response = await fetch(this.url('/api/v1/catalog'), {
      method: 'GET',
      headers: this.headers(true)
    })
    if (!response.ok) {
      throw new Error(`Catalog fetch failed (${response.status})`)
    }
    return (await response.json()) as Catalog
  }

  async playSound(id: string, volume?: number): Promise<void> {
    const response = await fetch(this.url('/api/v1/sound/play'), {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ id, volume })
    })
    if (!response.ok) {
      throw new Error(`playSound failed (${response.status})`)
    }
  }

  async runAction(type: string, payload?: unknown): Promise<void> {
    const response = await fetch(this.url('/api/v1/deck/action'), {
      method: 'POST',
      headers: this.headers(true),
      body: JSON.stringify({ type, payload })
    })
    if (!response.ok) {
      throw new Error(`runAction failed (${response.status})`)
    }
  }
}

async function safeJson(response: Response): Promise<{ error?: string } | null> {
  try {
    return (await response.json()) as { error?: string }
  } catch {
    return null
  }
}
