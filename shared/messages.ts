/**
 * Typed message protocol between the DeskThing client (Car Thing) and the
 * server module (Node, runs on the user's PC). The server proxies to
 * ilyStream's /api/v1/* HTTP endpoints — the client never talks HTTP itself.
 */

// --- Catalog (mirrors src/shared/device-api.ts in ilyStream) ---

export interface CatalogSound {
  id: string
  name: string
  category: 'alerts' | 'board' | 'soundboard' | 'alert' | string
  emoji?: string
}

export interface CatalogAction {
  id: string
  name: string
  icon: string
  color: string | null
  type: string
}

export interface Catalog {
  sounds: CatalogSound[]
  actions?: CatalogAction[]
  deck?: CatalogAction[]
  serverVersion: string
}

// --- Status snapshots ---

export type ConnectionStatus =
  | 'unconfigured'   // No host or token saved
  | 'connecting'     // Reaching the server
  | 'connected'
  | 'error'

export interface ConnectionState {
  status: ConnectionStatus
  host: string
  hasToken: boolean
  errorMessage?: string
  /** ISO timestamp of the last successful catalog fetch. */
  lastFetchAt?: string
  /** True while the SSE bridge to ilyStream is active. */
  liveStream?: boolean
}

// --- Live state pushed via /api/v1/events ---

export interface NowPlayingState {
  isPlaying?: boolean
  trackName?: string
  artistName?: string
  albumArtUrl?: string
  /** Anything else the overlay payload includes — pass through opaquely. */
  [key: string]: unknown
}

export interface TtsState {
  isSpeaking: boolean
  isAI: boolean
}

export interface SoundPlayedState {
  id: string
  name: string
  emoji?: string
  /** ISO timestamp of when the play was acknowledged. */
  at: string
}

export interface GoalsState {
  totalLikes: number
  totalGiftCount: number
  totalGiftValueCents: number
  totalSubscriptions: number
  totalFollows: number
  totalShares: number
  totalRaids: number
  currentViewerCount: number
  lastUpdatedAt: string | null
}

/** Mirrors ilyStream's OverlayFeedItem — sent as chatAppend / chatBacklog. */
export interface ChatItem {
  id: string
  kind: 'chat' | 'gift' | 'subscription' | 'follow' | 'raid' | 'like' | 'share'
  platform: string
  platformLabel: string
  displayName: string
  profilePictureUrl?: string
  avatarUrl?: string // alias used in some versions
  pictureUrl?: string // another potential alias
  /** List of badge URLs (fan club, subscriber, etc). */
  badges?: string[]
  /** True if this specific user currently has a song in the request queue. */
  hasSongQueued?: boolean
  message: string
  amount?: number
  meta?: string
  accentColor: string
  timestamp: string
  emphasis: boolean
}

// --- Client → Server ---

export type ClientMessageMap = {
  /** Ask the server to (re)fetch the catalog and broadcast it. */
  'requestCatalog': undefined
  /** Ask the server for the current connection state (host, paired flag). */
  'requestStatus': undefined
  /** Save host (e.g. "192.168.1.179:8899") and complete pairing with the 6-digit code. */
  'pair': { host: string; code: string; label?: string }
  /** Clear the saved token and return this device to the pairing screen. */
  'unpair': undefined
  /** Trigger a sound by id from the catalog. */
  'playSound': { id: string; volume?: number }
  /** Trigger a deck action by type. */
  'runAction': { type: string; payload?: unknown }
}

export type ClientMessageType = keyof ClientMessageMap

/**
 * User-customizable display preferences edited from the DeskThing settings
 * panel and pushed down to the Car Thing client whenever they change.
 */
export interface AppConfig {
  /**
   * "12h" / "24h" / "off". Controls the clock that lives in the header center.
   */
  clockFormat: '12h' | '24h' | 'off'
  /** Whether to include `:ss` after the minutes. */
  showSeconds: boolean
}

// --- Server → Client ---

export type ServerMessageMap = {
  catalog: Catalog
  status: ConnectionState
  /** A non-fatal toast-worthy event the UI can surface briefly. */
  notice: { kind: 'success' | 'error' | 'info'; text: string }
  nowPlaying: NowPlayingState
  ttsState: TtsState
  soundPlayed: SoundPlayedState
  goals: GoalsState
  /** Replayed snapshot of recent messages on (re)connect. */
  chatBacklog: ChatItem[]
  /** A single new chat-feed item. */
  chatAppend: ChatItem
  /** User-tunable display config (clock format, etc). */
  appConfig: AppConfig
  recordingState: { isRecording: boolean; path?: string }
  /** PC wall-clock sync so the device display does not depend on Car Thing time or timezone. */
  timeSync: {
    now: string
    epochMs: number
    wallClock: { hours: number; minutes: number; seconds: number; milliseconds: number }
  }
}

export type ServerMessageType = keyof ServerMessageMap
