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
