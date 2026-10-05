/**
 * CSP Report-Only — naruszenia → RPC report_csp_violation (0180).
 * SecurityPolicyViolationEvent działa także w trybie report-only.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildId, makeGate, safePath } from './errorReport';

export function installCspReporter(getSb: () => Promise<SupabaseClient>): () => void {
  const gate = makeGate();
  const build = buildId();
  const onViolation = (e: SecurityPolicyViolationEvent) => {
    const key = `${e.effectiveDirective}|${e.blockedURI}|${e.sourceFile ?? ''}`;
    if (!gate(key)) return;
    void getSb().then((sb) => sb.rpc('report_csp_violation', {
      p_effective: (e.effectiveDirective || 'unknown').slice(0, 80),
      p_blocked: (e.blockedURI || '').slice(0, 500) || null,
      p_document: safePath(e.documentURI || location.href) || null,
      p_violated: (e.violatedDirective || '').slice(0, 200) || null,
      p_policy: (e.originalPolicy || '').slice(0, 2000) || null,
      p_source: e.sourceFile ? safePath(e.sourceFile) : null,
      p_line: e.lineNumber || null,
      p_col: e.columnNumber || null,
      p_disposition: e.disposition === 'enforce' ? 'enforce' : 'report',
      p_ua: navigator.userAgent.slice(0, 300),
      p_build: build,
    })).catch(() => { /* reporter nie może sam generować błędów */ });
  };
  document.addEventListener('securitypolicyviolation', onViolation);
  return () => document.removeEventListener('securitypolicyviolation', onViolation);
}
