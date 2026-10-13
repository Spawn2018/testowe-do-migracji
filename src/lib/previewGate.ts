/**
 * E9-7 — bieżąca rola widoku dla strażnika Podglądu (bez cyklu store ↔ registry).
 */
let viewRole: string | null = null;

export function setPreviewViewRole(role: string | null | undefined): void {
  viewRole = role ?? null;
}

export function getPreviewViewRole(): string | null {
  return viewRole;
}
