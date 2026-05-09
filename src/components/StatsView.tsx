import { useAppState } from '../state/AppState'
import { Emoji } from '../lib/emoji'

/**
 * Replaces the old "alerts" tab. Surfaces the live stream goals snapshot —
 * viewers, follows, subs, etc — at a glance on the Car Thing.
 */
export function StatsView() {
  const { goals, status } = useAppState()

  if (!goals) {
    return (
      <div className="stats-view stats-empty">
        <div className="empty">
          {status.status === 'connected'
            ? 'Waiting for stream stats…'
            : 'Stats will appear once paired and live.'}
        </div>
      </div>
    )
  }

  const giftDollars = (goals.totalGiftValueCents / 100).toFixed(2)

  return (
    <div className="stats-view" aria-label="Stream stats">
      <StatCard glyph="👀" label="Viewers" value={goals.currentViewerCount.toLocaleString()} />
      <StatCard glyph="❤️" label="Likes" value={goals.totalLikes.toLocaleString()} />
      <StatCard glyph="🎁" label="Gifts" value={`${goals.totalGiftCount.toLocaleString()} · $${giftDollars}`} />
      <StatCard glyph="⭐" label="Subscriptions" value={goals.totalSubscriptions.toLocaleString()} />
      <StatCard glyph="➕" label="Follows" value={goals.totalFollows.toLocaleString()} />
      <StatCard glyph="↗️" label="Shares" value={goals.totalShares.toLocaleString()} />
      <StatCard glyph="⚔️" label="Raids" value={goals.totalRaids.toLocaleString()} />
    </div>
  )
}

function StatCard({ glyph, label, value }: { glyph: string; label: string; value: string }) {
  return (
    <div className="stat-card">
      <div className="stat-glyph"><Emoji text={glyph} /></div>
      <div className="stat-text">
        <div className="stat-value">{value}</div>
        <div className="stat-label">{label}</div>
      </div>
    </div>
  )
}
