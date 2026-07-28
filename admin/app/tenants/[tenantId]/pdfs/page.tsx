import Link from "next/link";
import { notFound } from "next/navigation";
import { pool } from "../../../../lib/db";
import { requireTenantRole, UnauthorizedError } from "../../../../lib/authorize";
import { PDF_APPROVAL_ROLES } from "../../../../lib/roles";
import { approvePdf, rejectPdf } from "./actions";

export const dynamic = "force-dynamic";

interface PdfDocument {
  id: string;
  source_url: string;
  link_text: string | null;
  discovered_from_url: string;
  size_bytes: string | null;
  status: string;
  discovered_at: string;
}

async function getTenant(tenantId: string) {
  const { rows } = await pool.query(`SELECT id, name FROM tenants WHERE id = $1`, [tenantId]);
  return rows[0] as { id: string; name: string } | undefined;
}

async function getPdfDocuments(tenantId: string) {
  const { rows } = await pool.query(
    `SELECT id, source_url, link_text, discovered_from_url, size_bytes, status, discovered_at
     FROM pdf_documents WHERE tenant_id = $1 ORDER BY discovered_at DESC`,
    [tenantId]
  );
  return rows as PdfDocument[];
}

function formatSize(bytes: string | null): string {
  if (bytes === null) return "unknown";
  const n = Number(bytes);
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function PdfDocumentsPage({ params }: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await params;
  // Renders as a plain 404 (rather than a 500 or a "not authorized" message)
  // so a user without access can't tell a denied tenant from a nonexistent one.
  let user;
  try {
    user = await requireTenantRole(tenantId);
  } catch (err) {
    if (err instanceof UnauthorizedError) notFound();
    throw err;
  }
  const canApprove =
    user.isSuperAdmin ||
    user.tenantRoles.some(
      (r) => r.tenantId === tenantId && (PDF_APPROVAL_ROLES as readonly string[]).includes(r.role)
    );
  const [tenant, docs] = await Promise.all([getTenant(tenantId), getPdfDocuments(tenantId)]);

  if (!tenant) {
    return (
      <main style={{ fontFamily: "system-ui", padding: 32 }}>
        <p>Tenant not found.</p>
      </main>
    );
  }

  return (
    <main style={{ fontFamily: "system-ui", padding: 32 }}>
      <p>
        <Link href="/tenants">&larr; Tenants</Link>
      </p>
      <h1>{tenant.name} — PDF review</h1>
      <p>
        PDFs the crawler found above the size threshold (or with unknown size) wait here for approval
        before they're processed into chunks.
      </p>
      <table style={{ borderCollapse: "collapse", width: "100%" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th style={{ padding: 8 }}>PDF</th>
            <th style={{ padding: 8 }}>Discovered on</th>
            <th style={{ padding: 8 }}>Size</th>
            <th style={{ padding: 8 }}>Status</th>
            <th style={{ padding: 8 }} />
          </tr>
        </thead>
        <tbody>
          {docs.map((doc) => (
            <tr key={doc.id} style={{ borderBottom: "1px solid #eee" }}>
              <td style={{ padding: 8, maxWidth: 320 }}>
                <a href={doc.source_url} target="_blank" rel="noreferrer">
                  {doc.link_text || doc.source_url}
                </a>
              </td>
              <td style={{ padding: 8 }}>
                <a href={doc.discovered_from_url} target="_blank" rel="noreferrer">
                  {new URL(doc.discovered_from_url).pathname}
                </a>
              </td>
              <td style={{ padding: 8 }}>{formatSize(doc.size_bytes)}</td>
              <td style={{ padding: 8 }}>{doc.status}</td>
              <td style={{ padding: 8 }}>
                {doc.status === "pending" && canApprove && (
                  <form style={{ display: "flex", gap: 8 }}>
                    <button
                      formAction={async () => {
                        "use server";
                        await approvePdf(tenantId, doc.id);
                      }}
                    >
                      Approve
                    </button>
                    <button
                      formAction={async () => {
                        "use server";
                        await rejectPdf(tenantId, doc.id);
                      }}
                    >
                      Reject
                    </button>
                  </form>
                )}
              </td>
            </tr>
          ))}
          {docs.length === 0 && (
            <tr>
              <td style={{ padding: 8 }} colSpan={5}>
                No PDFs discovered yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
