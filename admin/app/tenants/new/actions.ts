"use server";

import { redirect } from "next/navigation";
import { pool } from "../../../lib/db";
import { requireUser, UnauthorizedError } from "../../../lib/authorize";

const TENANT_KEY_PATTERN = /^[a-z0-9-]+$/;

export async function createTenant(formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    throw new UnauthorizedError("Only super admins can create tenants");
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

  let tenantId: string;
  try {
    const { rows } = await pool.query(
      `INSERT INTO tenants (name, tenant_key, domains, llm_provider, default_language)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [name, tenantKey, domains, llmProvider, defaultLanguage || "en"]
    );
    tenantId = rows[0].id;
  } catch (err) {
    if (err instanceof Error && "code" in err && err.code === "23505") {
      return { error: `Tenant key "${tenantKey}" is already in use.` };
    }
    throw err;
  }

  redirect(`/tenants/${tenantId}/pdfs`);
}
