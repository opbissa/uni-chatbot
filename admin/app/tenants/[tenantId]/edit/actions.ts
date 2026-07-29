"use server";

import { redirect } from "next/navigation";
import { pool } from "../../../../lib/db";
import { requireUser, UnauthorizedError } from "../../../../lib/authorize";

const TENANT_KEY_PATTERN = /^[a-z0-9-]+$/;

export async function updateTenant(tenantId: string, formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    throw new UnauthorizedError("Only super admins can edit tenants");
  }

  const name = String(formData.get("name") ?? "").trim();
  const tenantKey = String(formData.get("tenantKey") ?? "").trim().toLowerCase();
  const domainsRaw = String(formData.get("domains") ?? "");
  const llmProvider = String(formData.get("llmProvider") ?? "ollama");
  const defaultLanguage = String(formData.get("defaultLanguage") ?? "en").trim();

  if (!name) return { error: "Name is required." };
  if (!TENANT_KEY_PATTERN.test(tenantKey)) {
    return { error: "Tenant key must be lowercase letters, numbers, and hyphens only." };
  }

  const domains = domainsRaw
    .split(",")
    .map((d) => d.trim())
    .filter(Boolean);

  try {
    const { rowCount } = await pool.query(
      `UPDATE tenants
       SET name = $1, tenant_key = $2, domains = $3, llm_provider = $4, default_language = $5
       WHERE id = $6`,
      [name, tenantKey, domains, llmProvider, defaultLanguage || "en", tenantId]
    );
    if (rowCount === 0) return { error: "Tenant not found." };
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return { error: `Tenant key "${tenantKey}" is already in use.` };
    }
    throw err;
  }

  redirect("/tenants");
}
