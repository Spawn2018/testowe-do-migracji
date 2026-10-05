import { describe, expect, it } from 'vitest';
import { emailOutcome } from '../supabase/functions/_shared/resendStatus';

describe('status e-maila tylko z odpowiedzi Resend', () => {
  it('HTTP 200 i samo id nie jest wysłaniem', () => {
    expect(emailOutcome(200, { id: '01a107dd-6859-7bf3-813c-4bb10518762e' })).toBe('PENDING');
  });
  it('last_event failed jest błędem, także przy HTTP 200', () => {
    expect(emailOutcome(200, { id: 'x', last_event: 'failed' })).toBe('ERROR');
  });
  it('delivered i sent są wysłaniem', () => {
    expect(emailOutcome(200, { id: 'x', last_event: 'delivered' })).toBe('SENT');
    expect(emailOutcome(200, { id: 'x', last_event: 'sent' })).toBe('SENT');
  });
  it('odrzucenie limitu (4xx i name) jest błędem', () => {
    expect(emailOutcome(429, { name: 'daily_quota_exceeded', message: 'quota' })).toBe('ERROR');
  });
  it('pusta odpowiedź nie jest wysłaniem', () => {
    expect(emailOutcome(200, {})).toBe('ERROR');
  });
  it('name restricted_api_key przy HTTP 200 bez id jest błędem (odpowiedź GET)', () => {
    expect(emailOutcome(200, { name: 'restricted_api_key', message: 'This API key is restricted to only send emails' })).toBe('ERROR');
  });
});
