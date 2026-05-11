import { useEffect, useMemo, useRef, useState } from 'react'
import { useAppState } from '../state/AppState'
import { LiveStrip } from '../components/LiveStrip'
import { ChatList, type ChatListHandle } from '../components/ChatList'
import { Clock } from '../components/Clock'
import { StatsView } from '../components/StatsView'
import { Emoji } from '../lib/emoji'
import { rankRecents, subscribeRecents } from '../lib/recents'
import type { CatalogAction, CatalogSound } from '../../shared/messages'

type Tab = 'board' | 'actions' | 'stats' | 'chat'

const PAGE_SIZE = 8 // 4×2 grid per page
const RECENTS_LIMIT = 4 // first row of the Board tab

/** Maps the four physical Car Thing top buttons → tabs. Index = button #. */
const BUTTON_TAB_ORDER: Tab[] = ['board', 'actions', 'stats', 'chat']

const KEY_TO_BUTTON_INDEX: Record<string, number> = {
  '1': 0,
  Digit1: 0,
  '2': 1,
  Digit2: 1,
  '3': 2,
  Digit3: 2,
  '4': 3,
  Digit4: 3
}

/** Pixels per "click" of the volume wheel. ~one chat row per detent feels right. */
const WHEEL_SCROLL_STEP = 56

export function GridScreen() {
  const { catalog, status, refreshCatalog, playSound, runAction, unpair } = useAppState()
  const [tab, setTab] = useState<Tab>('board')
  const [page, setPage] = useState(0)
  const [recentsTick, setRecentsTick] = useState(0)
  const [confirmUnpair, setConfirmUnpair] = useState(false)

  const chatRef = useRef<ChatListHandle>(null)
  const gridScrollRef = useRef<HTMLDivElement | null>(null)
  const statsScrollRef = useRef<HTMLDivElement | null>(null)

  // Re-render the recents row whenever a sound is played from anywhere in the
  // app — `recents.ts` notifies via subscribeRecents.
  useEffect(() => subscribeRecents(() => setRecentsTick((t) => t + 1)), [])

  useEffect(() => {
    if (!confirmUnpair) return
    const timeout = window.setTimeout(() => setConfirmUnpair(false), 4000)
    return () => window.clearTimeout(timeout)
  }, [confirmUnpair])

  const items = useMemo(() => {
    if (!catalog || tab === 'chat' || tab === 'stats')
      return [] as Array<{ kind: 'sound' | 'action'; data: CatalogSound | CatalogAction }>

    if (tab === 'actions') {
      const actionsList = catalog.actions || catalog.deck || []
      return actionsList.map((a) => ({ kind: 'action' as const, data: a }))
    }

    return (catalog.sounds || [])
      .filter((s) => {
        const cat = s.category.toLowerCase()
        if (tab === 'board') return cat === 'board' || cat === 'soundboard'
        return cat === tab
      })
      .map((s) => ({ kind: 'sound' as const, data: s }))
  }, [catalog, tab])

  // Top-N recent sounds, resolved against the current catalog. Recomputes when
  // the catalog reloads or when a play is recorded.
  const recents = useMemo<CatalogSound[]>(() => {
    if (!catalog || tab !== 'board') return []
    const ids = rankRecents(RECENTS_LIMIT)
    if (ids.length === 0) return []
    const byId = new Map((catalog.sounds || []).map((s) => [s.id, s]))
    return ids.map((id) => byId.get(id)).filter((s): s is CatalogSound => Boolean(s))
    // recentsTick is the trigger — listed as a dep so memo invalidates on play.
  }, [catalog, tab, recentsTick])

  const isChat = tab === 'chat'
  const isStats = tab === 'stats'
  const isBoard = tab === 'board'
  const isGrid = !isChat && !isStats
  const pageCount = isGrid ? Math.max(1, Math.ceil(items.length / PAGE_SIZE)) : 1
  const currentPage = Math.min(page, pageCount - 1)
  const visible = items.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE)
  const slots = visible.length === 0 ? [] : visible

  const handleTabChange = (next: Tab) => {
    setTab(next)
    setPage(0)
  }

  // Hardware buttons: top-row physical buttons map to the four tabs in order.
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const idx =
        KEY_TO_BUTTON_INDEX[e.key] ?? KEY_TO_BUTTON_INDEX[(e as KeyboardEvent).code]
      if (idx === undefined) return
      // Don't hijack the keys when the user is typing in an input/textarea.
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      e.preventDefault()
      handleTabChange(BUTTON_TAB_ORDER[idx])
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])

  // Volume wheel: scroll the active page. Chat exposes a programmatic scroll
  // hook so it stays in charge of "stick to bottom" tracking; the grid + stats
  // scroll their own containers directly.
  useEffect(() => {
    const onWheel = (e: WheelEvent) => {
      const direction = Math.sign(e.deltaY) || 0
      if (direction === 0) return
      const step = direction * WHEEL_SCROLL_STEP

      if (tab === 'chat') {
        chatRef.current?.scrollBy(step)
        e.preventDefault()
        return
      }
      if (tab === 'stats') {
        statsScrollRef.current?.scrollBy({ top: step })
        e.preventDefault()
        return
      }
      if (pageCount > 1) {
        setPage((p) => {
          const n = p + direction
          if (n < 0) return pageCount - 1
          if (n >= pageCount) return 0
          return n
        })
        e.preventDefault()
      }
    }
    window.addEventListener('wheel', onWheel, { passive: false })
    return () => window.removeEventListener('wheel', onWheel as any)
  }, [tab, pageCount])

  const handlePanic = () => {
    // Server fans this out into BOTH a soundboard stop AND a TTS-queue clear,
    // so a single tap silences everything regardless of what's playing.
    runAction('STOP_ALL_SOUNDS')
  }

  const handleUnpair = () => {
    if (!confirmUnpair) {
      setConfirmUnpair(true)
      return
    }
    setConfirmUnpair(false)
    unpair()
  }

  return (
    <>
      <div className="header">
        <div className="header-left">
          <div className="title kicker">ilyStream</div>
          <div className="subtitle">
            {status.host}
            {pageCount > 1 ? ` · page ${currentPage + 1}/${pageCount}` : ''}
          </div>
        </div>
        <div className="header-center">
          <Clock />
        </div>
        <div className="header-right">
          <button
            className={`header-unpair${confirmUnpair ? ' confirming' : ''}`}
            onClick={handleUnpair}
            aria-label={confirmUnpair ? 'Confirm unpair' : 'Unpair device'}
          >
            {confirmUnpair ? 'Confirm' : 'Unpair'}
          </button>
        </div>
      </div>

      <div className="tabs">
        <div className="tab-group">
          <button className={`tab ${tab === 'board' ? 'active' : ''}`} onClick={() => handleTabChange('board')}>
            Board
          </button>
          <button
            className={`tab ${tab === 'actions' ? 'active' : ''}`}
            onClick={() => handleTabChange('actions')}
          >
            Actions
          </button>
          <button className={`tab ${tab === 'stats' ? 'active' : ''}`} onClick={() => handleTabChange('stats')}>
            Stats
          </button>
          <button className={`tab ${tab === 'chat' ? 'active' : ''}`} onClick={() => handleTabChange('chat')}>
            Chat
          </button>
        </div>
        <div className="quick-actions" aria-label="Quick actions">
          <button className="quick-button quick-panic" onClick={handlePanic} aria-label="Stop all sounds">
            <span className="quick-glyph">⏹</span>
            <span>Stop all</span>
          </button>
          <button className="quick-button" onClick={refreshCatalog} aria-label="Refresh catalog">
            <span className="quick-glyph">↻</span>
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {isChat ? (
        <ChatList ref={chatRef} />
      ) : isStats ? (
        <div className="stats-scroll" ref={statsScrollRef}>
          <StatsView />
        </div>
      ) : (
        <div className="board-area" ref={gridScrollRef}>
          {isBoard && recents.length > 0 && (
            <div className="recents-row" aria-label="Recently played">
              <div className="recents-label kicker">Recently Played</div>
              <div className="recents-grid">
                {recents.map((sound) => (
                  <Tile
                    key={`recent:${sound.id}`}
                    item={{ kind: 'sound', data: sound }}
                    onActivate={() => playSound(sound.id)}
                    compact
                  />
                ))}
              </div>
            </div>
          )}

          <div className="grid">
            {slots.length === 0 ? (
              <div className="empty">
                {!catalog
                  ? 'Loading catalog…'
                  : tab === 'actions'
                    ? 'No deck actions configured.'
                    : `No ${tab} sounds yet.`}
              </div>
            ) : (
              slots.map((item) => (
                <Tile
                  key={`${item.kind}:${item.data.id}`}
                  item={item}
                  onActivate={() => {
                    if (item.kind === 'sound') playSound(item.data.id)
                    else runAction((item.data as CatalogAction).id)
                  }}
                />
              ))
            )}
          </div>
        </div>
      )}

      <LiveStrip />
    </>
  )
}

function Tile({
  item,
  onActivate,
  compact = false
}: {
  item: { kind: 'sound' | 'action'; data: CatalogSound | CatalogAction }
  onActivate: () => void
  compact?: boolean
}) {
  const isAction = item.kind === 'action'
  const sound = !isAction ? (item.data as CatalogSound) : null
  const action = isAction ? (item.data as CatalogAction) : null

  const glyph = isAction ? action!.icon : sound!.emoji || '🔊'
  const label = isAction ? action!.name : sound!.name

  return (
    <button className={`tile${compact ? ' tile-compact' : ''}`} onClick={onActivate}>
      <div className="glyph"><Emoji text={glyph} /></div>
      <div className="label">{label}</div>
    </button>
  )
}
