import { onClientMessage, sendToClient } from '../messages.js'
import type { ServerAppContext } from '../appContext.js'

export function registerActionHandlers(context: ServerAppContext): void {
  const { logger, client } = context

  onClientMessage('playSound', async (payload) => {
    if (!payload?.id) return
    try {
      await client.playSound(payload.id, payload.volume)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'playSound failed'
      logger.error('playSound failed:', message)
      sendToClient('notice', { kind: 'error', text: message })
    }
  })

  onClientMessage('runAction', async (payload) => {
    if (!payload?.type) return
    try {
      await client.runAction(payload.type, payload.payload)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'runAction failed'
      logger.error('runAction failed:', message)
      sendToClient('notice', { kind: 'error', text: message })
    }
  })
}
