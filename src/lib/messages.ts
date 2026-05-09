import { DeskThing } from '@deskthing/client'
import type {
  ClientMessageMap,
  ClientMessageType,
  ServerMessageMap,
  ServerMessageType
} from '../../shared/messages'

const APP_ID = 'ilystream'

export function sendToServer<K extends ClientMessageType>(
  type: K,
  payload: ClientMessageMap[K]
): void {
  DeskThing.send({
    app: APP_ID,
    type,
    payload: payload as any
  } as any)
}

function hasPayload(value: unknown): value is { payload: unknown } {
  return typeof value === 'object' && value !== null && 'payload' in value
}

export function onServerMessage<K extends ServerMessageType>(
  type: K,
  handler: (payload: ServerMessageMap[K]) => void
): () => void {
  const removeListener = DeskThing.on(type as any, (data: unknown) => {
    if (!hasPayload(data)) return
    handler(data.payload as ServerMessageMap[K])
  })
  return typeof removeListener === 'function' ? removeListener : () => {}
}
