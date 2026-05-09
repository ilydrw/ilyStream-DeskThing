import { onClientMessage } from '../messages.js'
import type { ServerAppContext } from '../appContext.js'

export function registerCatalogHandlers(context: ServerAppContext): void {
  onClientMessage('requestCatalog', async () => {
    await context.broadcastCatalog(true)
  })
}
