#!/usr/bin/env node
/**
 * Integration smoke-test orchestrator (issue #30).
 *
 * Boots a local mock-stick zwave-js-ui backend (fake controller on
 * tcp://127.0.0.1:5555 + the API/socket.io server on :8091), then runs the
 * Playwright smoke suite. Playwright's own `webServer` builds and serves the
 * frontend on :8092 (proxied to the backend); this script only owns the
 * backend lifecycle.
 *
 * It is safe to run repeatedly: if a backend / fake-stick is already listening
 * it is *reused* (and left running) instead of being started and torn down.
 * Anything this script starts, it stops on exit.
 *
 * Usage:
 *   node scripts/e2e.mjs            # reuse-or-start backend, then run Playwright
 *   ZWAVE_JS_UI_DIR=/path node scripts/e2e.mjs
 *
 * Never targets a live instance — only the local mock-stick backend.
 */
import { spawn } from 'node:child_process'
import net from 'node:net'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const FRONTEND_DIR = path.resolve(fileURLToPath(import.meta.url), '../..')
const BACKEND_PORT = Number(process.env.E2E_BACKEND_PORT ?? 8091)
const FAKE_STICK_PORT = Number(process.env.E2E_FAKE_STICK_PORT ?? 5555)
const FAKE_STICK_URL = `tcp://127.0.0.1:${FAKE_STICK_PORT}`

// Locate the upstream zwave-js-ui checkout that provides the mock backend.
const UPSTREAM_DIR =
  process.env.ZWAVE_JS_UI_DIR ?? path.resolve(FRONTEND_DIR, '../../zwave-js-ui')

const SETTINGS = {
  zwave: {
    port: FAKE_STICK_URL,
    enabled: true,
    logLevel: 'info',
    serverEnabled: true,
    // The mock controller emulates a raw serial stream over TCP. The
    // soft-reset re-sync (close + reopen the port mid-handshake) is timing
    // sensitive and can desync the mock's frame parser on slower/!arm64 CI
    // runners ("does not start with SOF"), crashing fake-stick. We don't need
    // soft reset against a mock, so disable it for a deterministic handshake.
    enableSoftReset: false,
  },
  mqtt: { disabled: true },
  gateway: { type: 0, payloadType: 0, nodeNames: true, hassDiscovery: false },
}

/** Things we started and must clean up. */
const started = []
let settingsBackup = null // { path, prior: string | null }

// fake-stick is managed on its own so we can restart it if it crashes mid
// handshake; the backend's zwave-js driver auto-reconnects on the next attempt.
let fakeStickChild = null
let fakeStickActive = false
let fakeStickRestarts = 0
const MAX_FAKE_STICK_RESTARTS = 15

function log(msg) {
  process.stdout.write(`[e2e] ${msg}\n`)
}

function fail(msg) {
  process.stderr.write(`[e2e] ERROR: ${msg}\n`)
  process.exitCode = 1
}

/** Resolve once a TCP port accepts a connection (server listening). */
function tcpUp(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => {
      socket.destroy()
      resolve(false)
    })
  })
}

/** Resolve once the socket.io HTTP endpoint answers (backend server is up). */
async function backendUp(port) {
  try {
    const res = await fetch(
      `http://127.0.0.1:${port}/socket.io/?EIO=4&transport=polling`,
      { signal: AbortSignal.timeout(2000) },
    )
    return res.status >= 200 && res.status < 500
  } catch {
    return false
  }
}

async function waitFor(label, probe, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await probe()) return
    await new Promise((r) => setTimeout(r, 750))
  }
  throw new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`)
}

/** Resolve once `regex` matches a line on the child's stdout/stderr. */
function waitForStdout(child, regex, label, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      if (regex.test(chunk.toString())) finish()
    }
    const onExit = () => finish(new Error(`${label} exited before becoming ready`))
    const timer = setTimeout(
      () => finish(new Error(`Timed out waiting for ${label} after ${timeoutMs}ms`)),
      timeoutMs,
    )
    function finish(err) {
      clearTimeout(timer)
      child.stdout.off('data', onData)
      child.stderr.off('data', onData)
      child.off('exit', onExit)
      if (err) reject(err)
      else resolve()
    }
    child.stdout.on('data', onData)
    child.stderr.on('data', onData)
    child.on('exit', onExit)
  })
}

/** Spawn a long-running child in its own process group, prefixing its output. */
function startProcess(label, command, args, opts = {}) {
  log(`starting ${label}: ${command} ${args.join(' ')}`)
  const child = spawn(command, args, {
    cwd: UPSTREAM_DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, ...opts.env },
  })
  const prefix = (chunk) =>
    chunk
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => process.stdout.write(`[${label}] ${line}\n`))
  child.stdout.on('data', prefix)
  child.stderr.on('data', prefix)
  child.on('exit', (code, signal) => {
    if (!child.killedByUs) {
      fail(`${label} exited unexpectedly (code=${code} signal=${signal})`)
    }
  })
  started.push(child)
  return child
}

function stopProcess(child) {
  child.killedByUs = true
  try {
    // Kill the whole process group (npm + node child).
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

/** Spawn fake-stick once, prefixing output and auto-restarting on crash. */
function spawnFakeStick() {
  const child = spawn('npm', ['run', 'fake-stick'], {
    cwd: UPSTREAM_DIR,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env },
  })
  fakeStickChild = child
  const prefix = (chunk) =>
    chunk
      .toString()
      .split('\n')
      .filter(Boolean)
      .forEach((line) => process.stdout.write(`[fake-stick] ${line}\n`))
  child.stdout.on('data', prefix)
  child.stderr.on('data', prefix)
  child.on('exit', (code, signal) => {
    if (child.killedByUs || !fakeStickActive) return
    if (fakeStickRestarts >= MAX_FAKE_STICK_RESTARTS) {
      fail(`fake-stick crashed ${fakeStickRestarts} times; giving up`)
      return
    }
    fakeStickRestarts += 1
    log(
      `fake-stick exited (code=${code} signal=${signal}); ` +
        `restarting (#${fakeStickRestarts}) — backend will reconnect`,
    )
    setTimeout(() => {
      if (fakeStickActive) spawnFakeStick()
    }, 1000)
  })
  return child
}

/** Start fake-stick and wait until it reports it is listening (via stdout). */
async function startFakeStick() {
  log('starting fake-stick: npm run fake-stick')
  fakeStickActive = true
  const child = spawnFakeStick()
  // Wait for the listening line rather than TCP-probing the mock: opening and
  // tearing down a probe socket against the emulated serial stream can poison
  // the controller's frame parser.
  await waitForStdout(child, /Server listening on tcp/i, 'fake-stick', 60_000)
}

function stopFakeStick() {
  fakeStickActive = false
  const child = fakeStickChild
  fakeStickChild = null
  if (!child) return
  child.killedByUs = true
  try {
    process.kill(-child.pid, 'SIGTERM')
  } catch {
    try {
      child.kill('SIGTERM')
    } catch {
      /* already gone */
    }
  }
}

function writeSettings() {
  const storeDir = path.join(UPSTREAM_DIR, 'store')
  const file = path.join(storeDir, 'settings.json')
  fs.mkdirSync(storeDir, { recursive: true })
  settingsBackup = {
    path: file,
    prior: fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : null,
  }
  fs.writeFileSync(file, JSON.stringify(SETTINGS, null, 2))
  log(`wrote mock settings to ${file}`)
}

function restoreSettings() {
  if (!settingsBackup) return
  if (settingsBackup.prior === null) {
    fs.rmSync(settingsBackup.path, { force: true })
  } else {
    fs.writeFileSync(settingsBackup.path, settingsBackup.prior)
  }
  log('restored prior settings.json')
  settingsBackup = null
}

function cleanup() {
  stopFakeStick()
  for (const child of started) stopProcess(child)
  started.length = 0
  restoreSettings()
}

async function main() {
  if (!fs.existsSync(UPSTREAM_DIR)) {
    throw new Error(
      `Upstream zwave-js-ui checkout not found at ${UPSTREAM_DIR}.\n` +
        `Clone it (git clone --depth 1 --branch v11.19.1 ` +
        `https://github.com/zwave-js/zwave-js-ui) and/or set ZWAVE_JS_UI_DIR.`,
    )
  }
  if (!fs.existsSync(path.join(UPSTREAM_DIR, 'node_modules'))) {
    throw new Error(
      `Upstream deps missing — run \`npm ci\` in ${UPSTREAM_DIR} first.`,
    )
  }

  const reuseFakeStick = await tcpUp(FAKE_STICK_PORT)
  const reuseBackend = await backendUp(BACKEND_PORT)

  if (!reuseBackend) writeSettings()

  if (reuseFakeStick) {
    log(`reusing fake-stick already listening on :${FAKE_STICK_PORT}`)
  } else {
    await startFakeStick()
    log('fake-stick ready')
  }

  if (reuseBackend) {
    log(`reusing backend already listening on :${BACKEND_PORT}`)
  } else {
    startProcess('backend', 'npm', ['run', 'server'], {
      env: { PORT: String(BACKEND_PORT) },
    })
    await waitFor('backend', () => backendUp(BACKEND_PORT), 120_000)
    log('backend ready')
  }

  // Run the Playwright smoke suite (it builds + serves the frontend itself).
  const code = await new Promise((resolve) => {
    const pw = spawn('npx', ['playwright', 'test'], {
      cwd: FRONTEND_DIR,
      stdio: 'inherit',
      env: { ...process.env, E2E_BACKEND_PORT: String(BACKEND_PORT) },
    })
    pw.on('exit', (c) => resolve(c ?? 1))
  })

  process.exitCode = code
}

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    cleanup()
    process.exit(1)
  })
}

main()
  .catch((err) => fail(err.message))
  .finally(cleanup)
