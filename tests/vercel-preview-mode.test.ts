import { describe, expect, it } from 'vitest'
import { resolveAuthMode } from '../build/authMode'

describe('A5-PODGLADY: tryb logowania w buildzie Vercel', () => {
  it('podgląd Vercel → demo, nawet gdy projekt ustawia supabase', () => {
    expect(resolveAuthMode({ VERCEL_ENV: 'preview', VITE_AUTH_MODE: 'supabase', VERCEL_GIT_COMMIT_REF: 'feature/x' })).toBe('demo')
    expect(resolveAuthMode({ VERCEL_ENV: 'development', VITE_AUTH_MODE: 'supabase' })).toBe('demo')
  })
  it('produkcja z main → tryb z konfiguracji', () => {
    expect(resolveAuthMode({ VERCEL_ENV: 'production', VITE_AUTH_MODE: 'supabase', VERCEL_GIT_COMMIT_REF: 'main' })).toBe('supabase')
  })
  it('produkcja z innej gałęzi → build przerwany', () => {
    expect(() => resolveAuthMode({ VERCEL_ENV: 'production', VITE_AUTH_MODE: 'supabase', VERCEL_GIT_COMMIT_REF: 'dev' })).toThrow(/tylko z gałęzi main/)
  })
  it('poza Vercel → bez zmian', () => {
    expect(resolveAuthMode({ VITE_AUTH_MODE: 'supabase' })).toBe('supabase')
    expect(resolveAuthMode({})).toBeUndefined()
  })
})
