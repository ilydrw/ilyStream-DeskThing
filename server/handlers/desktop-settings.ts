import { DeskThing } from '@deskthing/server'
import { sendToClient } from '../messages.js'
import {
  completePairTask,
  PAIR_TASK_ID,
  REFRESH_CATALOG_ACTION_ID,
  RESET_PAIR_ACTION_ID,
  restartPairTask
} from '../setup.js'
import { buildConnectionState, type ServerAppContext } from '../appContext.js'
import type { AppConfig } from '../../shared/messages.js'
import { resetPairing } from './reset-pairing.js'

interface SettingValue {
  value?: unknown
}

type SettingsPayload = Record<string, SettingValue | undefined>

const PAIR_CODE_RE = /^\d{6}$/

function getStringSetting(
  payload: SettingsPayload | undefined,
  key: string,
  fallback: string
): string {
  if (!payload) return fallback
  const raw = payload[key]?.value
  return typeof raw === 'string' ? raw.trim() : fallback
}

function getBoolSetting(
  payload: SettingsPayload | undefined,
  key: string,
  fallback: boolean
): boolean {
  if (!payload) return fallback
  const raw = payload[key]?.value
  return typeof raw === 'boolean' ? raw : fallback
}

function normalizeClockFormat(raw: string): AppConfig['clockFormat'] {
  return raw === '24h' || raw === 'off' ? raw : '12h'
}

/**
 * Pulls the clock-related settings out of a settings payload and broadcasts
 * them to the client so the header clock re-renders immediately.
 */
export function broadcastAppConfigFromSettings(
  payload: SettingsPayload | undefined
): void {
  const config: AppConfig = {
    clockFormat: normalizeClockFormat(getStringSetting(payload, 'clockFormat', '12h')),
    showSeconds: getBoolSetting(payload, 'clockSeconds', false)
  }
  sendToClient('appConfig', config)
}

/**
 * Hooks DeskThing's `settings` event into the pair flow:
 *   - Changes to `host` are stored and trigger an event-stream reconnect.
 *   - Changes to `pairCode` (if 6 digits) trigger pairing with ilyStream and
 *     are then cleared so the field doesn't linger in the UI.
 *
 * Also handles the actions registered in `setup.ts`.
 */
export function registerDesktopSettingsHandlers(context: ServerAppContext): void {
  const { logger, runtime, client, broadcastStatus, broadcastCatalog, startEventStream, stopEventStream } =
    context

  DeskThing.on('settings', async (data: { payload?: SettingsPayload } | undefined) => {
    const settings = data?.payload
    if (!settings) return

    // Always echo display config to the client so things like the header clock
    // update immediately when the user changes them.
    broadcastAppConfigFromSettings(settings)

    const nextHost = getStringSetting(settings, 'host', runtime.host || '')
    const codeRaw = getStringSetting(settings, 'pairCode', '')
    const label = getStringSetting(settings, 'label', 'DeskThing') || 'DeskThing'
    const hostChanged = nextHost && nextHost !== runtime.host

    // Always persist host changes immediately (so a host edit isn't lost if
    // the code never lands).
    if (hostChanged) {
      runtime.host = nextHost
      runtime.lastError = null
      await DeskThing.saveData({ host: runtime.host })
      logger.info('Host updated to', runtime.host)
      // If we already had a token, the new host means the old token is for a
      // different ilyStream instance — clear it.
      if (runtime.token) {
        runtime.token = null
        runtime.lastCatalog = null
        await DeskThing.saveData({ token: '' })
        stopEventStream()
        restartPairTask()
      }
      broadcastStatus()
    }

    // No code typed — nothing further to do.
    if (!codeRaw) return

    if (!PAIR_CODE_RE.test(codeRaw)) {
      // Wrong shape — surface a notice but leave the field alone so the user
      // can correct it.
      sendToClient('notice', {
        kind: 'error',
        text: 'Pair code must be 6 digits.'
      })
      return
    }

    if (!runtime.host) {
      sendToClient('notice', { kind: 'error', text: 'Set the ilyStream address first.' })
      return
    }

    try {
      const { token } = await client.pair(runtime.host, codeRaw, label)
      runtime.token = token
      runtime.lastError = null

      await DeskThing.saveData({ host: runtime.host, token, label })
      // Clear the transient pairCode so the field empties out in the UI.
      await DeskThing.saveData({ pairCode: '' })

      logger.info('Paired via DeskThing settings/task flow with', runtime.host)
      sendToClient('notice', { kind: 'success', text: 'Paired with ilyStream.' })

      completePairTask()
      broadcastStatus()
      await broadcastCatalog(true)
      startEventStream()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pair failed'
      logger.error('Pair via settings flow failed:', message)
      sendToClient('notice', { kind: 'error', text: message })
      // Clear the bad code so the user can retry without manually deleting it.
      await DeskThing.saveData({ pairCode: '' })
    }
  })

  DeskThing.on('action', async (data: { payload?: { id?: string } } | undefined) => {
    const id = data?.payload?.id
    if (!id) return

    if (id === RESET_PAIR_ACTION_ID) {
      await resetPairing(context, { logMessage: 'Pairing reset via action' })
      return
    }

    if (id === REFRESH_CATALOG_ACTION_ID) {
      logger.info('Catalog refresh via action')
      await broadcastCatalog(true)
      return
    }

    if (id === PAIR_TASK_ID) {
      // Some DeskThing versions fire an action when the user opens a task —
      // nothing to do, the settings event drives pairing.
      return
    }
  })
}
