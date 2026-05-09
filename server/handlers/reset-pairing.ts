import { DeskThing } from '@deskthing/server'
import { sendToClient } from '../messages.js'
import { restartPairTask } from '../setup.js'
import type { ServerAppContext } from '../appContext.js'

interface ResetPairingOptions {
  notice?: string
  logMessage?: string
}

export async function resetPairing(
  context: ServerAppContext,
  options: ResetPairingOptions = {}
): Promise<void> {
  const { logger, runtime, broadcastStatus, stopEventStream } = context

  stopEventStream()
  runtime.token = null
  runtime.lastCatalog = null
  runtime.lastFetchAt = null
  runtime.lastError = null

  await DeskThing.saveData({ token: '' })
  restartPairTask()

  logger.info(options.logMessage || 'Pairing reset')
  sendToClient('notice', { kind: 'info', text: options.notice || 'Pairing reset.' })
  broadcastStatus()
}
