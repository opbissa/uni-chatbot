import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pool } from "../../../../lib/db";
import { requireUser } from "../../../../lib/authorize";
import { EditTenantForm } from "./edit-tenant-form";

async function getTenant(tenantId: string) {
  const { rows } = await pool.query(
    `SELECT id, name, tenant_key, domains, llm_provider, default_language
     FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return rows[0] as
    | {
        id: string;
        name: string;
        tenant_key: string;
        domains: string[];
        llm_provider: string;
        default_language: string;
      }
    | undefined;
}

export default async function EditTenantPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await requireUser();
  if (!user.isSuperAdmin) notFound();

  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  return (
    <main className="flex justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Edit tenant</CardTitle>
          <CardDescription>{tenant.name}</CardDescription>
        </CardHeader>
        <CardContent>
          <EditTenantForm
            tenant={{
              id: tenant.id,
              name: tenant.name,
              tenantKey: tenant.tenant_key,
              domains: tenant.domains,
              llmProvider: tenant.llm_provider,
              defaultLanguage: tenant.default_language,
            }}
          />
        </CardContent>
      </Card>
    </main>
  );
}
