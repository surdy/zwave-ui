import { describe, expect, it, vi, beforeEach } from 'vitest'
import {
  InclusionStrategy,
  abortInclusion,
  grantSecurityClasses,
  inclusionReducer,
  initialInclusionState,
  isInclusionDone,
  parseDskRequest,
  parseGrantRequest,
  replaceFailedNode,
  startExclusion,
  startInclusion,
  stopExclusion,
  stopInclusion,
  strategyForChoice,
  validateDSK,
} from '@/devices/inclusion'

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
}))

vi.mock('@/api', () => ({
  zwaveSocket: { callApi: mocks.callApi },
}))

describe('inclusion state machine', () => {
  it('reduces the full S2 happy path', () => {
    let state = initialInclusionState()

    state = inclusionReducer(state, { type: 'start', mode: 'include' })
    expect(state.phase).toBe('starting')

    state = inclusionReducer(state, { type: 'controller', payload: { status: 'Inclusion started' } })
    expect(state.phase).toBe('waiting')

    state = inclusionReducer(state, { type: 'grant', payload: { securityClasses: [0, 1, 2], clientSideAuth: true } })
    expect(state.phase).toBe('grant')
    expect(state.grant).toEqual({ securityClasses: [0, 1, 2], clientSideAuth: true })

    state = inclusionReducer(state, { type: 'validateDSK', payload: '11111-22222-33333-44444-55555-66666-77777-88888' })
    expect(state.phase).toBe('validate-dsk')
    expect(state.dsk?.pinLength).toBe(5)

    state = inclusionReducer(state, { type: 'controller', payload: { status: 'Inclusion stopped' } })
    expect(state.phase).toBe('adding')

    state = inclusionReducer(state, { type: 'nodeAdded', payload: { node: { id: 12, ready: true, available: true, failed: false, inited: true } } })
    expect(state.phase).toBe('done')
    expect(state.node?.id).toBe(12)
    expect(isInclusionDone(state)).toBe(true)
  })

  it('handles aborts', () => {
    const started = inclusionReducer(initialInclusionState(), { type: 'start' })
    const state = inclusionReducer(started, { type: 'aborted', payload: { message: 'User aborted' } })

    expect(state.phase).toBe('aborted')
    expect(state.message).toBe('User aborted')
    expect(isInclusionDone(state)).toBe(true)
  })

  it('handles controller errors', () => {
    const state = inclusionReducer(initialInclusionState(), { type: 'controller', payload: { status: 'Inclusion failed: timeout' } })

    expect(state.phase).toBe('error')
    expect(state.error).toBe('Inclusion failed: timeout')
  })
})

describe('inclusion parsers', () => {
  it('parses grant payloads', () => {
    expect(parseGrantRequest({ securityClasses: [0, '1', 7], clientSideAuth: 1 })).toEqual({
      securityClasses: [0, 1, 7],
      clientSideAuth: true,
    })
    expect(parseGrantRequest({ securityClasses: { 0: true, 1: false, 7: true } })).toEqual({
      securityClasses: [0, 7],
      clientSideAuth: false,
    })
  })

  it('parses DSK payloads', () => {
    expect(parseDskRequest('12345-11111')).toEqual({ dsk: '12345-11111', pinLength: 5 })
    expect(parseDskRequest({ dsk: '00000-22222', pinLength: 6 })).toEqual({ dsk: '00000-22222', pinLength: 6 })
  })

  it('maps security choices to upstream strategies', () => {
    expect(strategyForChoice('s2-default')).toBe(InclusionStrategy.Default)
    expect(strategyForChoice('s2')).toBe(InclusionStrategy.Security_S2)
    expect(strategyForChoice('s0')).toBe(InclusionStrategy.Security_S0)
    expect(strategyForChoice('insecure')).toBe(InclusionStrategy.Insecure)
  })
})

describe('inclusion API wrappers', () => {
  beforeEach(() => {
    mocks.callApi.mockResolvedValue({ success: true, message: 'ok', result: true })
    mocks.callApi.mockClear()
  })

  it('calls inclusion APIs with the expected args', async () => {
    await startInclusion(InclusionStrategy.Default, { forceSecurity: true })
    expect(mocks.callApi).toHaveBeenLastCalledWith('startInclusion', InclusionStrategy.Default, { forceSecurity: true })

    await stopInclusion()
    expect(mocks.callApi).toHaveBeenLastCalledWith('stopInclusion')

    await abortInclusion()
    expect(mocks.callApi).toHaveBeenLastCalledWith('abortInclusion')
  })

  it('calls exclusion and replace APIs with the expected args', async () => {
    await startExclusion()
    expect(mocks.callApi).toHaveBeenLastCalledWith('startExclusion')

    await stopExclusion()
    expect(mocks.callApi).toHaveBeenLastCalledWith('stopExclusion')

    await replaceFailedNode(7, InclusionStrategy.Security_S2)
    expect(mocks.callApi).toHaveBeenLastCalledWith('replaceFailedNode', 7, InclusionStrategy.Security_S2)
  })

  it('calls S2 prompt APIs with the expected args', async () => {
    const grant = { securityClasses: [0, 1], clientSideAuth: false }
    await grantSecurityClasses(grant)
    expect(mocks.callApi).toHaveBeenLastCalledWith('grantSecurityClasses', grant)

    await validateDSK('12345')
    expect(mocks.callApi).toHaveBeenLastCalledWith('validateDSK', '12345')
  })
})
