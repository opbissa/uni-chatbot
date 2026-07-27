import { pool } from "../db/pool.js";

export interface Tenant {
  id: string;
  name: string;
  tenantKey: string;
  domains: string[];
  llmProvider: "ollama" | "claude";
  monthlyQueryCap: number;
  chatHistoryLimit: number;
  chatHistoryExpiryHours: number;
}

/**
 * Resolves tenant identity server-side from the tenant key sent by the
 * widget. Never trust a tenant_id from the client body directly.
 */
export async function resolveTenantByKey(tenantKey: string): Promise<Tenant | null> {
  const { rows } = await pool.query(
    `SELECT id, name, tenant_key, domains, llm_provider, monthly_query_cap,
            chat_history_limit, chat_history_expiry_hours
     FROM tenants WHERE tenant_key = $1`,
    [tenantKey]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    tenantKey: row.tenant_key,
    domains: row.domains,
    llmProvider: row.llm_provider,
    monthlyQueryCap: row.monthly_query_cap,
    chatHistoryLimit: row.chat_history_limit,
    chatHistoryExpiryHours: row.chat_history_expiry_hours,
  };
}

/** Validates the request Origin against the tenant's registered domains. */
export function isOriginAllowed(tenant: Tenant, origin: string | undefined): boolean {
  if (!origin) return false;
  try {
    const host = new URL(origin).hostname;
    return tenant.domains.includes(host);
  } catch {
    return false;
  }
}
