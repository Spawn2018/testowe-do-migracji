/** 0182 — auto-podpięcie polisy OCP przewoźnika do transportów (lista 3.2). */
import { getSupabase } from '../auth/client';

export type LoadInsuranceCover = {
  loadId: string;
  covered: boolean;
  policyId: string | null;
  policyNo: string | null;
  insurer: string | null;
  validUntil: string | null;
};

export async function loadInsuranceCover(projectId: string): Promise<LoadInsuranceCover[]> {
  const sb = await getSupabase();
  const { data, error } = await sb.rpc('load_insurance_cover', { p_project: projectId });
  if (error) throw error;
  return ((data ?? []) as Array<{
    load_id: string;
    covered: boolean;
    policy_id: string | null;
    policy_no: string | null;
    insurer: string | null;
    valid_until: string | null;
  }>).map((r) => ({
    loadId: r.load_id,
    covered: Boolean(r.covered),
    policyId: r.policy_id,
    policyNo: r.policy_no,
    insurer: r.insurer,
    validUntil: r.valid_until,
  }));
}
