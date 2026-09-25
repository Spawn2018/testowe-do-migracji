import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { authMode, authErrorPl, ROLES_FOR_ORG, USER_ROLES, viewRoleForOrg } from '../src/auth/config';

describe('BK2 auth config', () => {
  it('demo unless VITE_AUTH_MODE=supabase AND url+key present', () => {
    expect(authMode({})).toBe('demo');
    expect(authMode({ VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toBe('demo');
    expect(authMode({ VITE_AUTH_MODE: 'supabase', VITE_SUPABASE_URL: 'https://x.supabase.co' })).toBe('demo');
    expect(authMode({ VITE_AUTH_MODE: 'supabase', VITE_SUPABASE_URL: 'https://x.supabase.co', VITE_SUPABASE_ANON_KEY: 'k' })).toBe('supabase');
  });

  it('roles mirror user_role enum from 0001', () => {
    const sql = readFileSync('supabase/migrations/0001_core.sql', 'utf8');
    const block = sql.slice(sql.indexOf('create type user_role'), sql.indexOf(');', sql.indexOf('create type user_role')));
    const enumRoles = [...block.matchAll(/'([A-Z_]+)'/g)].map((m) => m[1]);
    expect([...USER_ROLES]).toEqual(enumRoles);
  });

  it('org → roles mapping matches role_matches_org in 0005', () => {
    expect(ROLES_FOR_ORG.HHL).toEqual(['HHL_ADMIN', 'HHL_OPS']);
    expect(ROLES_FOR_ORG.KSH).toEqual(['CLIENT_ADMIN', 'CLIENT_USER']);
    expect(ROLES_FOR_ORG.SCX).toEqual(['CARRIER_DISPATCH', 'CARRIER_USER']);
    const sql = readFileSync('supabase/migrations/0006_auth.sql', 'utf8');
    expect(sql).toMatch(/after insert on auth\.users/);
    expect(sql).toMatch(/TOWER_NO_INVITE/);
  });

  it('view role and Polish error mapping', () => {
    expect(viewRoleForOrg('KSH')).toBe('KSH');
    expect(viewRoleForOrg('STEGRA')).toBeNull();
    expect(authErrorPl('Database error saving new user')).toMatch(/zaproszenia/);
    expect(authErrorPl('email rate limit exceeded')).toMatch(/Zbyt wiele/);
  });
});
