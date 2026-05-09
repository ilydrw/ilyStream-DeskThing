import { DeskThing } from '@deskthing/server'
import { onClientMessage, sendToClient } from '../messages.js'
import { buildConnectionState, type ServerAppContext } from '../appContext.js'
import { resetPairing } from './reset-pairing.js'

export function registerPairingHandlers(context: ServerAppContext): void {
  const { logger, runtime, client, broadcastStatus, broadcastCatalog, startEventStream, syncTime } =
    context

  onClientMessage('pair', async (payload) => {
    if (!payload?.host || !payload?.code) {
      sendToClient('notice', { kind: 'error', text: 'Host and code are required' })
      return
    }

    try {
      const { token } = await client.pair(payload.host, payload.code, payload.label || 'DeskThing')
      runtime.host = payload.host
      runtime.token = token
      runtime.lastError = null

      await DeskThing.saveData({ host: runtime.host, token: runtime.token })
      logger.info('Paired with ilyStream at', runtime.host)

      sendToClient('notice', { kind: 'success', text: 'Paired successfully' })
      broadcastStatus()
      await broadcastCatalog(true)
      startEventStream()
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Pair failed'
      logger.error('Pair failed:', message)
      sendToClient('notice', { kind: 'error', text: message })
      sendToClient('status', buildConnectionState({ ...runtime, lastError: message }))
    }
  })

  onClientMessage('unpair', async () => {
    await resetPairing(context, {
      notice: 'Unpaired from ilyStream.',
      logMessage: 'Pairing reset from client'
    })
  })

  onClientMessage('requestStatus', () => {
    syncTime()
    broadcastStatus()
  })
}
