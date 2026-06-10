/**
 * Device actuation. Thin wrapper over the `writeValue` Z-Wave API so UI
 * components don't need to know the socket call shape.
 *
 * Backend contract (api/lib/ZwaveClient.ts `writeValue(valueId, value)`).
 */
import { zwaveSocket, type CallApiResult, type ValueId } from '@/api'

export function writeValue(valueId: ValueId, value: unknown): Promise<CallApiResult> {
  return zwaveSocket.callApi('writeValue', valueId, value)
}

export function setNodeName(id: number, name: string): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('setNodeName', id, name)
}

export function setNodeLocation(id: number, loc: string): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('setNodeLocation', id, loc)
}

export function pingNode(id: number): Promise<CallApiResult<boolean>> {
  return zwaveSocket.callApi('pingNode', id)
}

export function refreshInfo(id: number): Promise<CallApiResult> {
  return zwaveSocket.callApi('refreshInfo', id)
}

export function refreshValues(id: number): Promise<CallApiResult> {
  return zwaveSocket.callApi('refreshValues', id)
}

export function pollValue(valueId: ValueId): Promise<CallApiResult> {
  return zwaveSocket.callApi('pollValue', valueId)
}

export function sendCommand(
  ctx: { nodeId: number; endpoint: number; commandClass: number | string },
  command: string,
  args: unknown[] = [],
): Promise<CallApiResult> {
  return zwaveSocket.callApi('sendCommand', ctx, command, args)
}
