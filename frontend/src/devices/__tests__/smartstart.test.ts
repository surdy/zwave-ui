import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  buildProvisioningEntry,
  getProvisioningEntries,
  getProvisioningEntry,
  isBarcodeDetectorSupported,
  normalizeParsedQr,
  parseQRCodeString,
  provisionSmartStartNode,
  provisioningStatusLabel,
  SecurityClass,
  unprovisionSmartStartNode,
  type PlannedProvisioningEntry,
} from '@/devices/smartstart'

const mocks = vi.hoisted(() => ({
  callApi: vi.fn(),
}))

vi.mock('@/api', () => ({
  zwaveSocket: { callApi: mocks.callApi },
}))

const parsedResponse = {
  parsed: {
    dsk: '12345-11111-22222-33333-44444-55555-66666-77777',
    manufacturerId: 271,
    productType: 4096,
    productId: 8192,
    applicationVersion: '1.2',
    genericDeviceClass: 16,
    specificDeviceClass: 1,
    installerIconType: 512,
    supportedProtocols: [0, 1],
    securityClasses: [SecurityClass.S2Authenticated, SecurityClass.S2Unauthenticated],
    requestedSecurityClasses: [SecurityClass.S2AccessControl, SecurityClass.S2Authenticated],
  },
  exists: false,
}

describe('smartstart parsing and provisioning helpers', () => {
  it('normalizes parsed QR responses for display', () => {
    expect(normalizeParsedQr(parsedResponse)).toMatchObject({
      dsk: '12345-11111-22222-33333-44444-55555-66666-77777',
      manufacturerId: 271,
      productType: 4096,
      productId: 8192,
      applicationVersion: '1.2',
      genericDeviceClass: 16,
      specificDeviceClass: 1,
      installerIconType: 512,
      supportedProtocols: [0, 1],
      securityClasses: [SecurityClass.S2Authenticated, SecurityClass.S2Unauthenticated],
      requestedSecurityClasses: [SecurityClass.S2AccessControl, SecurityClass.S2Authenticated],
      exists: false,
    })
  })

  it('builds the provisioning entry with optional fields and granted security', () => {
    const parsed = normalizeParsedQr(parsedResponse)
    const entry = buildProvisioningEntry(parsed, {
      name: '  Garage Door  ',
      location: ' Garage ',
      securityClasses: [SecurityClass.S2AccessControl],
    })

    expect(entry).toMatchObject({
      dsk: parsed.dsk,
      name: 'Garage Door',
      location: 'Garage',
      manufacturerId: 271,
      productType: 4096,
      productId: 8192,
      applicationVersion: '1.2',
      supportedProtocols: [0, 1],
      securityClasses: [SecurityClass.S2AccessControl],
      requestedSecurityClasses: [SecurityClass.S2AccessControl, SecurityClass.S2Authenticated],
    })
  })

  it('labels pending, inactive, and included provisioning entries', () => {
    const entry: PlannedProvisioningEntry = {
      dsk: '12345-11111-22222-33333-44444-55555-66666-77777',
      securityClasses: [],
    }

    expect(provisioningStatusLabel(entry)).toBe('Pending')
    expect(provisioningStatusLabel({ ...entry, status: 1 })).toBe('Inactive')
    expect(provisioningStatusLabel({ ...entry, nodeId: 18 })).toBe('Included · Node 18')
  })

  it('checks BarcodeDetector support from the provided object', () => {
    expect(isBarcodeDetectorSupported({ BarcodeDetector: class BarcodeDetector {} })).toBe(true)
    expect(isBarcodeDetectorSupported({})).toBe(false)
    expect(isBarcodeDetectorSupported(undefined)).toBe(false)
  })
})

describe('smartstart API wrappers', () => {
  beforeEach(() => {
    mocks.callApi.mockResolvedValue({ success: true, message: 'ok', result: undefined })
    mocks.callApi.mockClear()
  })

  it('calls the zwave API with the expected methods and args', async () => {
    const entry = buildProvisioningEntry(normalizeParsedQr(parsedResponse), { name: 'Switch' })

    await parseQRCodeString('900132...')
    await provisionSmartStartNode(entry)
    await unprovisionSmartStartNode(entry.dsk)
    await getProvisioningEntries()
    await getProvisioningEntry(entry.dsk)

    expect(mocks.callApi).toHaveBeenCalledWith('parseQRCodeString', '900132...')
    expect(mocks.callApi).toHaveBeenCalledWith('provisionSmartStartNode', entry)
    expect(mocks.callApi).toHaveBeenCalledWith('unprovisionSmartStartNode', entry.dsk)
    expect(mocks.callApi).toHaveBeenCalledWith('getProvisioningEntries')
    expect(mocks.callApi).toHaveBeenCalledWith('getProvisioningEntry', entry.dsk)
  })
})
