import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useRef,
  useState
} from 'react'
import { useAppState } from '../state/AppState'
import { Emoji } from '../lib/emoji'
import type { ChatItem } from '../../shared/messages'

const PLATFORM_GLYPH: Record<string, string> = {
  tiktok: '📱',
  twitch: '🎮',
  youtube: '📺',
  kick: '⚽'
}

export interface ChatListHandle {
  /** Scroll the chat list by `delta` pixels. Positive = down. */
  scrollBy: (delta: number) => void
}

/**
 * Vertical scrolling chat feed for the Car Thing. Auto-sticks to the bottom
 * unless the user scrolls up to read older messages, in which case new arrivals
 * stop forcing a scroll until they swipe back down.
 *
 * Exposes a `scrollBy` ref so the volume-wheel handler in GridScreen can drive
 * scrolling without the user having to touch the screen.
 */
export const ChatList = forwardRef<ChatListHandle>(function ChatList(_, ref) {
  const { chat, status } = useAppState()
  const containerRef = useRef<HTMLDivElement | null>(null)
  const stickToBottomRef = useRef(true)
  const [showJump, setShowJump] = useState(false)

  // Track whether the user is parked near the bottom.
  const handleScroll = () => {
    const el = containerRef.current
    if (!el) return
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight
    const atBottom = distance < 32
    stickToBottomRef.current = atBottom
    setShowJump(!atBottom)
  }

  useImperativeHandle(
    ref,
    () => ({
      scrollBy: (delta: number) => {
        const el = containerRef.current
        if (!el) return
        el.scrollTop = Math.max(0, Math.min(el.scrollHeight, el.scrollTop + delta))
        handleScroll()
      }
    }),
    []
  )

  // Pin to the bottom whenever new items arrive (if we were already there).
  useLayoutEffect(() => {
    const el = containerRef.current
    if (!el) return
    if (stickToBottomRef.current) {
      el.scrollTop = el.scrollHeight
    }
  }, [chat])

  // Initial mount: snap to bottom.
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [])

  const jumpToBottom = () => {
    const el = containerRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
    stickToBottomRef.current = true
    setShowJump(false)
  }

  if (chat.length === 0) {
    return (
      <div className="chat empty-chat">
        <div className="empty">
          {status.status === 'connected'
            ? 'Waiting for chat — fire up a stream and messages will land here.'
            : 'Chat will appear once paired.'}
        </div>
      </div>
    )
  }

  return (
    <div className="chat">
      <div className="chat-list" ref={containerRef} onScroll={handleScroll}>
        {chat.map((item) => (
          <ChatRow key={item.id} item={item} />
        ))}
      </div>
      {showJump && (
        <button className="chat-jump" onClick={jumpToBottom}>
          ↓ New messages
        </button>
      )}
    </div>
  )
})

function ChatRow({ item }: { item: ChatItem }) {
  if (item.kind === 'chat') {
    return (
      <div className="chat-row">
        <Avatar item={item} />
        <div className="chat-body">
          <div className="chat-meta">
            <span className="chat-name" style={{ color: item.accentColor }}>
              {item.displayName}
            </span>
            <span className="chat-platform">{PLATFORM_GLYPH[item.platform] || ''}</span>
          </div>
          <div className="chat-text">
            <Emoji text={item.message} />
          </div>
        </div>
      </div>
    )
  }

  // Gift / follow / sub / raid — compact accent line.
  const eventGlyph: Record<ChatItem['kind'], string> = {
    chat: '',
    gift: '🎁',
    subscription: '⭐',
    follow: '➕',
    raid: '⚔️',
    like: '❤️',
    share: '↗️'
  }
  return (
    <div className={`chat-row chat-event chat-event-${item.kind}`}>
      <div className="chat-event-glyph">
        <Emoji text={eventGlyph[item.kind] || '✨'} />
      </div>
      <div className="chat-body">
        <div className="chat-text">
          <span className="chat-name" style={{ color: item.accentColor }}>
            {item.displayName}
          </span>{' '}
          <Emoji text={item.message} />
        </div>
      </div>
    </div>
  )
}

function Avatar({ item }: { item: ChatItem }) {
  const [broken, setBroken] = useState(false)
  if (item.profilePictureUrl && !broken) {
    return (
      <img
        className="chat-avatar"
        src={item.profilePictureUrl}
        alt=""
        onError={() => setBroken(true)}
      />
    )
  }
  const initial = (item.displayName || '?').trim().charAt(0).toUpperCase() || '?'
  return (
    <div className="chat-avatar chat-avatar-fallback" style={{ background: item.accentColor }}>
      {initial}
    </div>
  )
}
