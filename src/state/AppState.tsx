import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import type {
  AppConfig,
  Catalog,
  ChatItem,
  ConnectionState,
  GoalsState,
  NowPlayingState,
  SoundPlayedState,
  TtsState
} from '../../shared/messages'
import { onServerMessage, sendToServer } from '../lib/messages'
import { recordPlay } from '../lib/recents'

const CHAT_DISPLAY_LIMIT = 80

interface Notice {
  id: number
  kind: 'success' | 'error' | 'info'
  text: string
}

interface AppStateValue {
  status: ConnectionState
  catalog: Catalog | null
  notice: Notice | null
  nowPlaying: NowPlayingState | null
  tts: TtsState
  goals: GoalsState | null
  /** Most recent sound played within the last few seconds (cleared automatically). */
  recentSound: SoundPlayedState | null
  recording: { isRecording: boolean; path?: string }
  /** Recent chat-feed items, oldest first. Capped to a small window for the device. */
  chat: ChatItem[]
  /** User-tunable display config (header clock format, etc). */
  appConfig: AppConfig
  /** PC wall-clock snapshot; formatted without using the device timezone. */
  clockSync: ClockSync | null
  pair: (host: string, code: string) => void
  unpair: () => void
  refreshCatalog: () => void
  playSound: (id: string) => void
  runAction: (type: string) => void
}

const AppStateContext = createContext<AppStateValue | null>(null)

export interface ClockSync {
  hours: number
  minutes: number
  seconds: number
  milliseconds: number
  receivedAtMs: number
}

const INITIAL_STATUS: ConnectionState = {
  status: 'unconfigured',
  host: '',
  hasToken: false
}

const INITIAL_TTS: TtsState = { isSpeaking: false, isAI: false }

const INITIAL_APP_CONFIG: AppConfig = {
  clockFormat: '12h',
  showSeconds: false
}

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<ConnectionState>(INITIAL_STATUS)
  const [catalog, setCatalog] = useState<Catalog | null>(null)
  const [notice, setNotice] = useState<Notice | null>(null)
  const [nowPlaying, setNowPlaying] = useState<NowPlayingState | null>(null)
  const [tts, setTts] = useState<TtsState>(INITIAL_TTS)
  const [goals, setGoals] = useState<GoalsState | null>(null)
  const [recentSound, setRecentSound] = useState<SoundPlayedState | null>(null)
  const [recording, setRecording] = useState<{ isRecording: boolean; path?: string }>({
    isRecording: false
  })
  const [chat, setChat] = useState<ChatItem[]>([])
  const [appConfig, setAppConfig] = useState<AppConfig>(INITIAL_APP_CONFIG)
  const [clockSync, setClockSync] = useState<ClockSync | null>(null)

  // Subscribe to server messages
  useEffect(() => {
    const unsubStatus = onServerMessage('status', (payload) => setStatus(payload))
    const unsubCatalog = onServerMessage('catalog', (payload) => setCatalog(payload))
    const unsubNotice = onServerMessage('notice', (payload) => {
      setNotice({ id: Date.now(), kind: payload.kind, text: payload.text })
    })
    const unsubNowPlaying = onServerMessage('nowPlaying', (payload) => setNowPlaying(payload))
    const unsubTts = onServerMessage('ttsState', (payload) => setTts(payload))
    const unsubGoals = onServerMessage('goals', (payload) => setGoals(payload))
    const unsubSound = onServerMessage('soundPlayed', (payload) => setRecentSound(payload))
    const unsubChatBacklog = onServerMessage('chatBacklog', (payload) => {
      // Replace the buffer wholesale on (re)connect snapshot.
      setChat(Array.isArray(payload) ? payload.slice(-CHAT_DISPLAY_LIMIT) : [])
    })
    const unsubChatAppend = onServerMessage('chatAppend', (payload) => {
      setChat((prev) => {
        if (prev.some((existing) => existing.id === payload.id)) return prev
        const next = [...prev, payload]
        return next.length > CHAT_DISPLAY_LIMIT
          ? next.slice(next.length - CHAT_DISPLAY_LIMIT)
          : next
      })
    })
    const unsubAppConfig = onServerMessage('appConfig', (payload) => {
      setAppConfig({
        clockFormat: payload?.clockFormat || '12h',
        showSeconds: !!payload?.showSeconds
      })
    })
    const unsubRecording = onServerMessage('recordingState', (payload) => setRecording(payload))
    const unsubTimeSync = onServerMessage('timeSync', (payload) => {
      const wallClock = payload?.wallClock
      if (
        wallClock &&
        Number.isFinite(wallClock.hours) &&
        Number.isFinite(wallClock.minutes) &&
        Number.isFinite(wallClock.seconds)
      ) {
        setClockSync({
          hours: wallClock.hours,
          minutes: wallClock.minutes,
          seconds: wallClock.seconds,
          milliseconds: Number.isFinite(wallClock.milliseconds) ? wallClock.milliseconds : 0,
          receivedAtMs: performance.now()
        })
      }
    })

    // Ask the server for current state once we're mounted.
    sendToServer('requestStatus', undefined)

    return () => {
      unsubStatus()
      unsubCatalog()
      unsubNotice()
      unsubNowPlaying()
      unsubTts()
      unsubGoals()
      unsubSound()
      unsubChatBacklog()
      unsubChatAppend()
      unsubAppConfig()
      unsubRecording()
      unsubTimeSync()
    }
  }, [])

  // Auto-dismiss notices after 3s
  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => {
      setNotice((current) => (current?.id === notice.id ? null : current))
    }, 3000)
    return () => clearTimeout(timer)
  }, [notice])

  // Auto-clear the "just played" sound after 2.5s so the strip resumes showing
  // now-playing again.
  useEffect(() => {
    if (!recentSound) return
    const timer = setTimeout(() => {
      setRecentSound((current) => (current?.id === recentSound.id ? null : current))
    }, 2500)
    return () => clearTimeout(timer)
  }, [recentSound])

  const value = useMemo<AppStateValue>(
    () => ({
      status,
      catalog,
      notice,
      nowPlaying,
      tts,
      goals,
      recentSound,
      recording,
      chat,
      appConfig,
      clockSync,
      pair: (host, code) =>
        sendToServer('pair', { host: host.trim(), code: code.trim(), label: 'Car Thing' }),
      unpair: () => sendToServer('unpair', undefined),
      refreshCatalog: () => sendToServer('requestCatalog', undefined),
      playSound: (id) => {
        recordPlay(id)
        sendToServer('playSound', { id })
      },
      runAction: (type) => sendToServer('runAction', { type })
    }),
    [status, catalog, notice, nowPlaying, tts, goals, recentSound, recording, chat, appConfig, clockSync]
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppStateValue {
  const value = useContext(AppStateContext)
  if (!value) throw new Error('useAppState must be used inside AppStateProvider')
  return value
}
