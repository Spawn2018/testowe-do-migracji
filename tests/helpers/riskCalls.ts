/** A6 (27.09) — wywołania tworzące ryzyka w bazie (ostatnie definicje funkcji z migracji) i w Edge. */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MIG = 'supabase/migrations';
export const FN = 'supabase/functions';

export interface RiskCall { where: string; fn: string; call: 'raise_risk' | 'raise_integration_risk' | 'insert'; keys: string[] }

/** Ostatnia definicja każdej funkcji plpgsql/sql z migracji (kolejność plików = kolejność wdrożeń). */
export function latestFunctions(): Map<string, { file: string; body: string }> {
  const out = new Map<string, { file: string; body: string }>();
  for (const f of readdirSync(MIG).filter((x) => x.endsWith('.sql')).sort()) {
    const sql = readFileSync(join(MIG, f), 'utf8');
    const re = /create\s+or\s+replace\s+function\s+(?:public\.)?(\w+)\s*\(/gi;
    let m: RegExpExecArray | null;
    while ((m = re.exec(sql))) {
      const tag = /\$[a-z_]*\$/i.exec(sql.slice(m.index));
      if (!tag) continue;
      const a = m.index + tag.index;
      const b = sql.indexOf(tag[0], a + tag[0].length);
      if (b < 0) continue;
      out.set(m[1].toLowerCase(), { file: f, body: sql.slice(a + tag[0].length, b) });
      re.lastIndex = b + tag[0].length;
    }
  }
  return out;
}

/** Tekst od otwierającego nawiasu do pasującego zamknięcia (z pominięciem literałów '...'). */
function balanced(src: string, open: number): string {
  let depth = 0; let q = false;
  for (let i = open; i < src.length; i++) {
    const c = src[i];
    if (c === "'") { if (q && src[i + 1] === "'") { i++; continue; } q = !q; continue; }
    if (q) continue;
    if (c === '(') depth++;
    else if (c === ')') { depth--; if (depth === 0) return src.slice(open, i + 1); }
  }
  return src.slice(open);
}

function keysIn(text: string): string[] {
  return [...new Set([...text.matchAll(/'(rk_[a-z0-9_]+)'/g)].map((x) => x[1]))];
}

const PASS_THROUGH = new Set(['raise_risk', 'raise_integration_risk', 'risk_signals_title_key']);

export function dbRiskCalls(): RiskCall[] {
  const calls: RiskCall[] = [];
  for (const [fn, { file, body }] of latestFunctions()) {
    if (PASS_THROUGH.has(fn)) continue;
    for (const m of body.matchAll(/\b(raise_integration_risk|raise_risk)\s*\(/gi)) {
      const txt = balanced(body, m.index! + m[0].length - 1);
      calls.push({ where: file, fn, call: m[1].toLowerCase() as RiskCall['call'], keys: keysIn(txt) });
    }
    for (const m of body.matchAll(/insert\s+into\s+(?:public\.)?risk_signals\b/gi)) {
      const end = body.indexOf(';', m.index!);
      const txt = body.slice(m.index!, end < 0 ? undefined : end);
      calls.push({ where: file, fn, call: 'insert', keys: /title_key/.test(txt) ? keysIn(txt) : [] });
    }
  }
  return calls;
}

export function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((x) => {
    const p = join(dir, x);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith('.ts') ? [p] : [];
  });
}

