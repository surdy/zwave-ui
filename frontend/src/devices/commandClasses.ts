/**
 * Z-Wave command class identifiers the UI reasons about. Kept as an `as const`
 * map (no TS enums — the build runs with `erasableSyntaxOnly`).
 *
 * Numbers are the canonical CC ids from the Z-Wave spec / zwave-js.
 */
export const CommandClass = {
  BinarySwitch: 37, // 0x25
  MultilevelSwitch: 38, // 0x26
  BinarySensor: 48, // 0x30
  MultilevelSensor: 49, // 0x31
  Meter: 50, // 0x32
  Color: 51, // 0x33
  ThermostatSetpoint: 67, // 0x43
  DoorLock: 98, // 0x62
  Notification: 113, // 0x71
  WindowCovering: 106, // 0x6a
  Battery: 128, // 0x80
} as const

export type CommandClassId = (typeof CommandClass)[keyof typeof CommandClass]
