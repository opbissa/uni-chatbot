import Link from "next/link";
import { pool } from "../../lib/db";
import { requireUser } from "../../lib/authorize";

export const dynamic = "force-dynamic";

async function getTenants(visibleTenantIds: string[] | null) {
  const { rows } = await pool.query(
    `SELECT id, name, tenant_key,
       (SELECT count(*) FROM pdf_documents WHERE tenant_id = tenants.id AND status = 'pending') AS pending_count
     FROM tenants
     WHERE $1::uuid[] IS NULL OR id = ANY($1::uuid[])
     ORDER BY created_at`,
    [visibleTenantIds]
  );
  return rows as { id: string; name: string; tenant_key: string; pending_count: string }[];
}

export default async function TenantsPage() {
  const user = await requireUser();
  // super admins see every tenant; everyone else only sees tenants they hold a role on
  const visibleTenantIds = user.isSuperAdmin
    ? null
    : [...new Set(user.tenantRoles.map((r) => r.tenantId))];
  const tenants = await getTenants(visibleTenantIds);

  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", maxWidth: 800 }}>
        <h1>Tenants</h1>
        {user.isSuperAdmin && <Link href="/tenants/new">+ New tenant</Link>}
      </div>
      <table style={{ borderCollapse: "collapse", width: "100%", maxWidth: 800 }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: 8 }}>Name</th>
            <th style={{ padding: 8 }}>Tenant key</th>
            <th style={{ padding: 8 }}>Pending PDFs</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {tenants.map((t) => (
            <tr key={t.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8 }}>{t.name}</td>
              <td style={{ padding: 8 }}>{t.tenant_key}</td>
              <td style={{ padding: 8 }}>{t.pending_count}</td>
              <td style={{ padding: 8 }}>
                <Link href={`/tenants/${t.id}/pdfs`}>Review PDFs</Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
