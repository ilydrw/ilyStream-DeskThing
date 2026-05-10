import { DeskThing } from '@deskthing/server'
import { SETTING_TYPES, STEP_TYPES } from '@deskthing/types'
import type { ServerAppContext } from './appContext.js'

const TASK_ID = 'pair-ilystream'
const ACTION_RESET_PAIR = 'resetPair'
const ACTION_REFRESH_CATALOG = 'refreshCatalog'

/**
 * Registers the DeskThing-side scaffolding: persistent settings (host, label),
 * the transient pair-code field, the onboarding task, and a couple of utility
 * actions. Idempotent — safe to call on every `start`.
 */
export async function registerDeskThingScaffolding(context: ServerAppContext): Promise<void> {
  await DeskThing.initSettings({
    host: {
      id: 'host',
      type: SETTING_TYPES.STRING,
      label: 'ilyStream LAN address',
      description:
        "Your PC's LAN address and ilyStream's overlay port (e.g. 192.168.1.100:8899). Don't include http://.",
      value: context.runtime.host || ''
    },
    label: {
      id: 'label',
      type: SETTING_TYPES.STRING,
      label: 'Device label',
      description: 'Shown on the ilyStream "Paired devices" list. Helpful if you have more than one.',
      value: 'DeskThing'
    },
    pairCode: {
      id: 'pairCode',
      type: SETTING_TYPES.STRING,
      label: 'Pair code',
      description:
        'One-time 6-digit code from ilyStream → Connections → DeskThing → "Pair new device". Cleared automatically after pairing.',
      value: '',
      maxLength: 6
    },
    clockFormat: {
      id: 'clockFormat',
      type: SETTING_TYPES.SELECT,
      label: 'Header clock',
      description: 'Time format displayed in the center of the header on the Car Thing.',
      value: '12h',
      options: [
        { label: '12-hour (e.g. 3:42 PM)', value: '12h' },
        { label: '24-hour (e.g. 15:42)', value: '24h' },
        { label: 'Hidden', value: 'off' }
      ]
    },
    clockSeconds: {
      id: 'clockSeconds',
      type: SETTING_TYPES.BOOLEAN,
      label: 'Show seconds in clock',
      description: 'Tick the second-counter on the header clock. Off by default to keep the display calm.',
      value: false
    }
  })

  await DeskThing.tasks.initTasks({
    [TASK_ID]: {
      id: TASK_ID,
      version: '0.0.5',
      available: true,
      completed: !!context.runtime.token,
      label: 'Pair with ilyStream',
      description:
        'Connect this app to your ilyStream desktop instance over your local network.',
      started: false,
      steps: {
        host: {
          id: 'host',
          type: STEP_TYPES.SETTING,
          label: 'Enter ilyStream address',
          instructions:
            "Type the LAN address where ilyStream is running, like 192.168.1.100:8899.",
          completed: !!context.runtime.host,
          strict: true,
          setting: {
            id: 'host',
            type: SETTING_TYPES.STRING,
            label: 'ilyStream LAN address',
            value: context.runtime.host || ''
          }
        },
        instructions: {
          id: 'instructions',
          type: STEP_TYPES.STEP,
          label: 'Get a 6-digit pair code',
          instructions:
            'On your PC, open ilyStream → Connections → DeskThing and click "Pair new device". A 6-digit code appears for 60 seconds.',
          completed: false
        },
        code: {
          id: 'code',
          type: STEP_TYPES.SETTING,
          label: 'Enter the pair code',
          instructions:
            'Type the 6-digit code into the field below. Pairing happens automatically.',
          completed: !!context.runtime.token,
          strict: true,
          setting: {
            id: 'pairCode',
            type: SETTING_TYPES.STRING,
            label: 'Pair code',
            value: '',
            maxLength: 6
          }
        }
      }
    }
  })

  // Tiny utility actions — show up in DeskThing's actions panel.
  const actionDefaults = { version: '0.0.5', enabled: true, tag: 'basic' as const }
  DeskThing.registerAction({
    id: ACTION_RESET_PAIR,
    name: 'Reset Pairing',
    ...actionDefaults
  })
  DeskThing.registerAction({
    id: ACTION_REFRESH_CATALOG,
    name: 'Refresh Catalog',
    ...actionDefaults
  })
}

/** Mark the pair task complete (called once a token is locked in). */
export function completePairTask(): void {
  try {
    DeskThing.tasks.complete(TASK_ID)
  } catch {
    /* task system may not be ready in some contexts */
  }
}

/** Reset and restart the pair task (called when the user explicitly unpairs). */
export function restartPairTask(): void {
  try {
    DeskThing.tasks.restart(TASK_ID)
  } catch {
    /* ignore */
  }
}

export const PAIR_TASK_ID = TASK_ID
export const RESET_PAIR_ACTION_ID = ACTION_RESET_PAIR
export const REFRESH_CATALOG_ACTION_ID = ACTION_REFRESH_CATALOG
