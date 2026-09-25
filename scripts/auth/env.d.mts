export function loadEnvLocal(path?: string): Record<string, string>;
export function need(env: Record<string, string>, keys: string[]): void;
export function maskEmail(e: string): string;
export const TEST_ACCOUNTS: { key: string; org: string; role: string; name: string }[];
