import Link from "next/link";
import { pool } from "../../lib/db";

export const dynamic = "force-dynamic";

async function getTenants() {
  const { rows } = await pool.query(
    `SELECT id, name, tenant_key,
       (SELECT count(*) FROM pdf_documents WHERE tenant_id = tenants.id AND status = 'pending') AS pending_count
     FROM tenants ORDER BY created_at`
  );
  return rows as { id: string; name: string; tenant_key: string; pending_count: string }[];
}

export default async function TenantsPage() {
  const tenants = await getTenants();

  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <h1>Tenants</h1>
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
