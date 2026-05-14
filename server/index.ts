import { DeskThing } from '@deskthing/server'
import { createLogger } from './logger.js'
import { sendToClient } from './messages.js'
import { IlyStreamClient } from './ilystream-client.js'
import { IlyStreamEventStream } from './event-stream.js'
import { proxyImageToBase64 } from './avatar-proxy.js'
import {
  buildConnectionState,
  createRuntimeState,
  type ServerAppContext
} from './appContext.js'
import type { ServerMessageMap, ServerMessageType } from '../shared/messages.js'
import { registerPairingHandlers } from './handlers/pairing.js'
import { registerCatalogHandlers } from './handlers/catalog.js'
import { registerActionHandlers } from './handlers/actions.js'
import {
  broadcastAppConfigFromSettings,
  registerDesktopSettingsHandlers
} from './handlers/desktop-settings.js'
import { registerDeskThingScaffolding } from './setup.js'

const APP_VERSION = '0.0.8'
const logger = createLogger('server')

const runtime = createRuntimeState()
const client = new IlyStreamClient(
  () => runtime.host,
  () => runtime.token
)
const events = new IlyStreamEventStream(logger)
let timeSyncTimer: ReturnType<typeof setInterval> | null = null

/** ilyStream's DeviceApi event types map 1:1 to client message types. */
const FORWARDED_EVENTS = new Set<ServerMessageType>([
  'nowPlaying',
  'ttsState',
  'soundPlayed',
  'goals',
  'chatBacklog',
  'chatAppend',
  'recordingState'
])

const context: ServerAppContext = {
  logger,
  runtime,
  client,
  events,
  broadcastStatus: () => {
    sendToClient('status', buildConnectionState(runtime))
  },
  broadcastCatalog: async (refresh = false) => {
    if (!runtime.host || !runtime.token) {
      context.broadcastStatus()
      return
    }
    if (!refresh && runtime.lastCatalog) {
      sendToClient('catalog', runtime.lastCatalog)
      return
    }
    try {
      const catalog = await client.getCatalog()
      runtime.lastCatalog = catalog
      runtime.lastFetchAt = new Date().toISOString()
      runtime.lastError = null
      sendToClient('catalog', catalog)
      context.broadcastStatus()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Catalog fetch failed'
      runtime.lastError = message
      logger.error('Catalog fetch failed:', message)
      context.broadcastStatus()
    }
  },
  startEventStream: () => {
    if (!runtime.host || !runtime.token) return
    events.start({
      host: runtime.host,
      token: runtime.token,
      onEvent: async (type, payload) => {
        if (!FORWARDED_EVENTS.has(type as ServerMessageType)) return

        // Proactive Avatar Proxying:
        // Fetch images on the PC and convert to Base64 to bypass Car Thing SSL/Network issues.
        try {
          if (type === 'chatAppend') {
            const item = payload as any
            item.profilePictureUrl = await proxyImageToBase64(item.profilePictureUrl, 48)
            if (item.badges) {
              item.badges = await Promise.all(item.badges.map((b: string) => proxyImageToBase64(b, 24)))
            }
          } else if (type === 'chatBacklog') {
            const items = payload as any[]
            await Promise.all(items.map(async (item) => {
              item.profilePictureUrl = await proxyImageToBase64(item.profilePictureUrl, 48)
              if (item.badges) {
                item.badges = await Promise.all(item.badges.map((b: string) => proxyImageToBase64(b, 24)))
              }
            }))
          }
        } catch (err) {
          logger.warn('Avatar proxying failed:', err)
        }

        sendToClient(
          type as ServerMessageType,
          payload as ServerMessageMap[ServerMessageType]
        )
      },
      onStateChange: (live, error) => {
        if (runtime.liveStream === live && !error) return
        runtime.liveStream = live
        if (error && !live) runtime.lastError = error
        context.broadcastStatus()
      }
    })
  },
  stopEventStream: () => {
    events.stop()
    runtime.liveStream = false
  },
  syncTime: () => broadcastTimeSync()
}

function broadcastTimeSync(): void {
  const now = Date.now()
  const local = new Date(now)
  sendToClient('timeSync', {
    now: local.toISOString(),
    epochMs: now,
    wallClock: {
      hours: local.getHours(),
      minutes: local.getMinutes(),
      seconds: local.getSeconds(),
      milliseconds: local.getMilliseconds()
    }
  })
}

function startTimeSync(): void {
  if (timeSyncTimer) return
  broadcastTimeSync()
  timeSyncTimer = setInterval(broadcastTimeSync, 60_000)
}

function stopTimeSync(): void {
  if (!timeSyncTimer) return
  clearInterval(timeSyncTimer)
  timeSyncTimer = null
}

logger.info(`ilyStream DeskThing app loading (v${APP_VERSION})`)

registerPairingHandlers(context)
registerCatalogHandlers(context)
registerActionHandlers(context)
registerDesktopSettingsHandlers(context)

async function broadcastInitialAppConfig(): Promise<void> {
  try {
    const settings = await DeskThing.getSettings()
    if (settings) {
      // Reuse the same path the live update uses — keeps the contract in one
      // place.
      broadcastAppConfigFromSettings(settings as any)
    }
  } catch (err) {
    logger.warn('Failed to broadcast initial app config:', err instanceof Error ? err.message : err)
  }
}

DeskThing.on('start', async () => {
  logger.info('start()')
  const saved = (await DeskThing.getData()) as
    | { host?: string; token?: string; label?: string; pairCode?: string }
    | undefined
  if (saved?.host) runtime.host = saved.host
  if (saved?.token) runtime.token = saved.token

  // Register the settings panel + onboarding task. Idempotent on subsequent
  // restarts — DeskThing keeps user-edited values for matching versions.
  try {
    await registerDeskThingScaffolding(context)
  } catch (err) {
    logger.warn('Failed to register settings/tasks:', err instanceof Error ? err.message : err)
  }

  // Belt-and-suspenders: if a stale pairCode survived a restart somehow, clear it.
  if (saved?.pairCode) {
    await DeskThing.saveData({ pairCode: '' })
  }

  // Make sure the client knows our current display preferences as soon as it
  // mounts — otherwise the clock would briefly show defaults and snap to the
  // user's choice on the next settings event.
  await broadcastInitialAppConfig()
  startTimeSync()

  if (runtime.host && runtime.token) {
    logger.info('Restored pairing for', runtime.host)
    await context.broadcastCatalog(true)
    context.startEventStream()
  } else {
    context.broadcastStatus()
  }
})

DeskThing.on('stop', () => {
  logger.info('stop()')
  stopTimeSync()
  context.stopEventStream()
})

DeskThing.on('purge', () => {
  logger.info('purge()')
  stopTimeSync()
  context.stopEventStream()
  runtime.host = null
  runtime.token = null
  runtime.lastCatalog = null
  runtime.lastError = null
})
