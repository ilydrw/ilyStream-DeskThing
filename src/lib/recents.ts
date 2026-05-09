/**
 * Tiny per-device "recently used sounds" tracker. Lives in localStorage so the
 * Car Thing and a paired phone keep independent recents — useful since the
 * use cases on each surface tend to differ.
 *
 * Storage shape: `{ id: string, count: number, lastAt: number }[]`. Sorted on
 * write. Capped to a small max so we never grow unbounded.
 */

const KEY = 'ilystream.recents.v1'
const MAX_ENTRIES = 32
const HALF_LIFE_HOURS = 24

interface RecentEntry {
  id: string
  count: number
  lastAt: number
}

function safeRead(): RecentEntry[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (e): e is RecentEntry =>
        typeof e?.id === 'string' && typeof e?.count === 'number' && typeof e?.lastAt === 'number'
    )
  } catch {
    return []
  }
}

function safeWrite(entries: RecentEntry[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)))
  } catch {
    /* localStorage may be quota-locked or disabled — fail open */
  }
}

/**
 * Record a play of `soundId`. Increments its count and stamps the time. Use
 * the score returned by {@link rankRecents} to surface popular-and-recent
 * items at the top of Board.
 */
export function recordPlay(soundId: string): void {
  const now = Date.now()
  const entries = safeRead()
  const existing = entries.find((e) => e.id === soundId)
  if (existing) {
    existing.count += 1
    existing.lastAt = now
  } else {
    entries.push({ id: soundId, count: 1, lastAt: now })
  }
  safeWrite(entries)
  notify()
}

/**
 * Returns sound ids ordered by a combined "recency × frequency" score, decayed
 * so a sound used 50× yesterday doesn't trump one used 5× this hour. Trim with
 * `limit`. Default 4 ≈ one row of the Board grid.
 */
export function rankRecents(limit = 4): string[] {
  const now = Date.now()
  const halfLifeMs = HALF_LIFE_HOURS * 60 * 60 * 1000
  return safeRead()
    .map((e) => {
      const ageMs = Math.max(0, now - e.lastAt)
      const decay = Math.pow(0.5, ageMs / halfLifeMs)
      return { id: e.id, score: e.count * decay }
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((e) => e.id)
}

// --- Cross-component change notification (recents are mutated outside React) ---

const listeners = new Set<() => void>()

function notify(): void {
  for (const fn of listeners) fn()
}

export function subscribeRecents(fn: () => void): () => void {
  listeners.add(fn)
  return () => {
    listeners.delete(fn)
  }
}
