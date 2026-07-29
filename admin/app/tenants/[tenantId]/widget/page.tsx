import { notFound } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { pool } from "../../../../lib/db";
import { requireUser } from "../../../../lib/authorize";
import type { WidgetTheme } from "../../../../lib/widget-theme";
import { WidgetCustomization } from "./widget-customization";

async function getTenant(tenantId: string) {
  const { rows } = await pool.query(
    `SELECT id, name, tenant_key, theme FROM tenants WHERE id = $1`,
    [tenantId]
  );
  return rows[0] as
    | { id: string; name: string; tenant_key: string; theme: WidgetTheme }
    | undefined;
}

export default async function WidgetPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  const user = await requireUser();
  if (!user.isSuperAdmin) notFound();

  const tenant = await getTenant(tenantId);
  if (!tenant) notFound();

  const apiUrl = process.env.PUBLIC_API_URL ?? "http://localhost:3000";

  return (
    <main className="flex justify-center p-8">
      <Card className="w-full max-w-lg">
        <CardHeader>
          <CardTitle>Widget customization</CardTitle>
          <CardDescription>{tenant.name} — colors, logo, and header text</CardDescription>
        </CardHeader>
        <CardContent>
          <WidgetCustomization
            tenantId={tenant.id}
            tenantKey={tenant.tenant_key}
            apiUrl={apiUrl}
            initialTheme={tenant.theme ?? {}}
          />
        </CardContent>
      </Card>
    </main>
  );
}
