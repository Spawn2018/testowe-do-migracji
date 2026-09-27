import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { SEED_DRIVERS } from '../src/data/seedIdentity'
import { hasRemoteSink } from '../src/data/registry'
import { useTowerStore } from '../src/store/useTowerStore'

// I-2 (strażnik): w trybie demo SMS i e-mail NIGDY nie wychodzą; numery demo są fikcyjne
// (SE: pula PTS +46 70 174 06 05…99, PL: +48 000 000 0xx, LT: +370 000 0000x).

const SE = /^\+467017406(0[5-9]|[1-9][0-9])$/
const PL = /^\+480000000\d\d$/
const LT = /^\+3700000000\d$/
const fictional = (p: string) => SE.test(p) || PL.test(p) || LT.test(p)

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    return statSync(p).isDirectory() ? walk(p) : [p]
  })
}

describe('I-2: numery demo wyłącznie z pul fikcyjnych', () => {
  it('SEED_DRIVERS: 30 numerów, 15 PL + 5 LT + 10 SE, wszystkie fikcyjne i unikalne', () => {
    const phones = SEED_DRIVERS.map((d) => d.phone)
    expect(phones).toHaveLength(30)
    expect(new Set(phones).size).toBe(30)
    expect(phones.filter((p) => !fictional(p))).toEqual([])
    expect(phones.filter((p) => PL.test(p))).toHaveLength(15)
    expect(phones.filter((p) => LT.test(p))).toHaveLength(5)
    expect(phones.filter((p) => SE.test(p))).toHaveLength(10)
  })

  it('src/data/loads.json: każdy numer telefonu z pul fikcyjnych', () => {
    const raw = readFileSync('src/data/loads.json', 'utf8')
    const all = [...raw.matchAll(/"\+\d{8,15}"/g)].map((m) => m[0].slice(1, -1))
    expect(all.length).toBeGreaterThan(0)
    expect(all.filter((p) => !fictional(p))).toEqual([])
  })

  it('źródła src/: brak numerów +46/+48/+370 spoza pul fikcyjnych', () => {
    const bad: string[] = []
    for (const f of walk('src').filter((p) => /\.(ts|tsx|json)$/.test(p))) {
      for (const m of readFileSync(f, 'utf8').matchAll(/\+(?:46|48|370)\d{7,10}\b/g)) {
        if (!fictional(m[0])) bad.push(`${f}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })
})

describe('I-2: demo nie wysyła SMS ani e-mail (runtime)', () => {
  it('brak odbiorcy zdalnego; powiadomienia i zmiany w sklepie nie wywołują sieci', () => {
    const fetchSpy = vi.fn(() => Promise.reject(new Error('sieć zabroniona w demo')))
    const xhrOpen = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    vi.stubGlobal('XMLHttpRequest', class { open = xhrOpen; send() {} setRequestHeader() {} })
    try {
      expect(hasRemoteSink()).toBe(false)
      const st = useTowerStore.getState()
      const load = st.loads.find((l) => l.resources.driverPhone)!
      st.pushNotification({ title: 'Test', body: 'SMS do kierowcy', severity: 'HIGH', loadId: load.id })
      st.appendEvent({ loadId: load.id, type: 'NOTE', at: new Date().toISOString(), actor: 'test', note: 'x' } as never)
      st.setLoadStatus(load.id, load.status, 'test')
      st.markAllNotificationsRead('HHL')
      expect(fetchSpy).not.toHaveBeenCalled()
      expect(xhrOpen).not.toHaveBeenCalled()
    } finally {
      vi.unstubAllGlobals()
    }
  })
})

describe('I-2: paczka demo bez kanałów wysyłki (statycznie)', () => {
  let out = ''
  beforeAll(() => {
    out = mkdtempSync(join(tmpdir(), 'i2-demo-'))
    const env: NodeJS.ProcessEnv = { ...process.env, VITE_AUTH_MODE: 'demo' }
    for (const k of ['VITE_SUPABASE_URL', 'VITE_SUPABASE_ANON_KEY', 'VERCEL_ENV', 'VERCEL_GIT_COMMIT_REF', 'CF_PAGES', 'CF_PAGES_BRANCH']) delete env[k]
    execFileSync(process.execPath, ['node_modules/vite/bin/vite.js', 'build', '--outDir', out, '--emptyOutDir', '--logLevel', 'error'], { env, stdio: 'pipe' })
  }, 180_000)
  afterAll(() => rmSync(out, { recursive: true, force: true }))

  it('brak: klienta Supabase, Edge Functions (functions/v1), magic link, Resend, sms:/mailto:', () => {
    const banned = ['supabase', 'functions/v1', 'signInWithOtp', 'api.resend.com', 'sms:', 'mailto:', 'twilio']
    const hits: string[] = []
    for (const f of walk(out).filter((p) => /\.(js|html)$/.test(p))) {
      const s = readFileSync(f, 'utf8').toLowerCase()
      for (const b of banned) if (s.includes(b.toLowerCase())) hits.push(`${f.slice(out.length)}: ${b}`)
    }
    expect(hits).toEqual([])
  })
})
