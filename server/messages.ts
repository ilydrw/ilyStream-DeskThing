import { DeskThing } from '@deskthing/server'
import type {
  ClientMessageMap,
  ClientMessageType,
  ServerMessageMap,
  ServerMessageType
} from '../shared/messages.js'

export function sendToClient<K extends ServerMessageType>(
  type: K,
  payload: ServerMessageMap[K]
): void {
  DeskThing.send({ type, payload })
}

function hasPayload(value: unknown): value is { payload: unknown } {
  return typeof value === 'object' && value !== null && 'payload' in value
}

export function onClientMessage<K extends ClientMessageType>(
  type: K,
  handler: (payload: ClientMessageMap[K]) => void | Promise<void>
): void {
  DeskThing.on(type as any, (data: unknown) => {
    if (!hasPayload(data)) {
      return handler(undefined as ClientMessageMap[K])
    }
    return handler(data.payload as ClientMessageMap[K])
  })
}
