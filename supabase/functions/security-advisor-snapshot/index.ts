/**
 * E19-4 — uzupełnia dzienną migawkę wynikiem doradcy Supabase „security”.
 * Wywołanie: pg_cron → security_advisor_snapshot_tick → ta funkcja (service role).
 * C14 / D-0330: sekret = ADVISOR_MGMT_TOKEN (nazwy SUPABASE_* nie da się ustawić w Edge Secrets).
 */
import { createClient } from 'npm:@supabase/supabase-js@2';
import { isServiceRequest } from '../_shared/serviceAuth.ts';

type AdvisorLint = {
  name?: string;
  level?: string;
  title?: string;
  count?: number;
  findings?: Array<{ detail?: string; metadata?: { name?: string; schema?: string; type?: string } }>;
};

async function fetchSecurityLints(projectRef: string, token: string): Promise<AdvisorLint[]> {
  const url = `https://api.supabase.com/v1/projects/${projectRef}/advisors/security`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!res.ok) throw new Error(`advisor HTTP ${res.status}`);
  const body = await res.json() as { lints?: AdvisorLint[] } | AdvisorLint[];
  if (Array.isArray(body)) return body;
  return body.lints ?? [];
}

Deno.serve(async (req) => {
  const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  if (!service || !(await isServiceRequest(req, { url, service }))) {
    return new Response('forbidden', { status: 403 });
  }

  const sb = createClient(url, service, { auth: { persistSession: false } });
  const log = (ok: boolean, result: Record<string, unknown>) =>
    sb.from('integration_runs').insert({ job: 'security-advisor-snapshot-edge', ok, result });

  let snapshotId: number | null = null;
  try {
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({})) as { snapshot_id?: number };
      if (typeof body.snapshot_id === 'number') snapshotId = body.snapshot_id;
    }
  } catch {
    /* ignore */
  }

  // C14 / D-0330: tylko ADVISOR_MGMT_TOKEN
  const token = Deno.env.get('ADVISOR_MGMT_TOKEN') ?? '';
  const projectRef = Deno.env.get('SUPABASE_PROJECT_REF')
    ?? (url.match(/https:\/\/([a-z0-9]+)\.supabase\.co/i)?.[1] ?? '');

  let findings: AdvisorLint[] = [];
  let advisorOk = false;
  let advisorError: string | null = null;
  if (!token) {
    advisorError = 'brak ADVISOR_MGMT_TOKEN';
  } else if (!projectRef) {
    advisorError = 'brak project ref';
  } else {
    try {
      findings = await fetchSecurityLints(projectRef, token);
      advisorOk = true;
    } catch (e) {
      advisorError = e instanceof Error ? e.message : String(e);
    }
  }

  const flat = findings.flatMap((lint) =>
    (lint.findings ?? [{}]).map((f) => ({
      lint: lint.name ?? 'unknown',
      level: lint.level ?? 'INFO',
      object: `${f.metadata?.schema ?? 'public'}.${f.metadata?.name ?? '*'}`,
      detail: f.detail ?? lint.title ?? '',
    }))
  );

  if (snapshotId != null) {
    const { error } = await sb.rpc('security_advisor_snapshot_set_findings', {
      p_id: snapshotId,
      p_findings: flat,
      p_meta: { advisor_ok: advisorOk, advisor_error: advisorError, lint_groups: findings.length },
    });
    if (error) {
      await log(false, { error: error.message, snapshot_id: snapshotId });
      return new Response(error.message, { status: 500 });
    }
  } else {
    const { data, error } = await sb.rpc('security_advisor_snapshot_capture', {
      p_findings: flat,
      p_source: 'edge',
      p_meta: { advisor_ok: advisorOk, advisor_error: advisorError },
    });
    if (error) {
      await log(false, { error: error.message });
      return new Response(error.message, { status: 500 });
    }
    snapshotId = data as number;
  }

  // B12: brak pomiaru (advisor_ok=false) → integration_runs.ok=false, nie „OK”
  await log(advisorOk, {
    snapshot_id: snapshotId,
    findings: flat.length,
    advisor_ok: advisorOk,
    advisor_error: advisorError,
    detail: advisorOk ? 'doradca security' : 'Brak pomiaru',
  });
  return Response.json({ ok: advisorOk, snapshot_id: snapshotId, findings: flat.length, advisor_ok: advisorOk });
});
