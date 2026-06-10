/**
 * Thin REST helper.
 *
 * IMPORTANT: the backend uses connect-history-api-fallback, so any GET whose
 * Accept header matches text/html (which includes the default `*​/*`) and has
 * no file extension is rewritten to the SPA index. We therefore force
 * `Accept: application/json` on every request so REST endpoints return JSON.
 * See docs/05-implementation/backend-api.md §5b.
 */

export interface RequestOptions {
  signal?: AbortSignal
}

function jsonHeaders(extra?: Record<string, string>): HeadersInit {
  return {
    Accept: 'application/json',
    ...extra,
  }
}

async function parse<T>(res: Response): Promise<T> {
  const text = await res.text()
  if (!text) return undefined as T
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`Expected JSON from ${res.url} but got non-JSON response (status ${res.status})`)
  }
}

export async function getJson<T>(url: string, opts: RequestOptions = {}): Promise<T> {
  const res = await fetch(url, {
    method: 'GET',
    headers: jsonHeaders(),
    credentials: 'include',
    signal: opts.signal,
  })
  return parse<T>(res)
}

export async function postJson<T>(
  url: string,
  body?: unknown,
  opts: RequestOptions = {},
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: jsonHeaders({ 'Content-Type': 'application/json' }),
    credentials: 'include',
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: opts.signal,
  })
  return parse<T>(res)
}
