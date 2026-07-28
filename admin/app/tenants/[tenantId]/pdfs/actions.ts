"use server";

import { revalidatePath } from "next/cache";
import { pool } from "../../../../lib/db";
import { pdfIngestQueue } from "../../../../lib/queue";
import { requireTenantRole } from "../../../../lib/authorize";
import { PDF_APPROVAL_ROLES } from "../../../../lib/roles";

export async function approvePdf(tenantId: string, pdfDocumentId: string) {
  await requireTenantRole(tenantId, PDF_APPROVAL_ROLES);

  const { rows } = await pool.query(
    `UPDATE pdf_documents SET status = 'approved', reviewed_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'
     RETURNING id`,
    [pdfDocumentId, tenantId]
  );
  if (rows.length > 0) {
    await pdfIngestQueue.add("ingest", { pdfDocumentId });
  }
  revalidatePath(`/tenants/${tenantId}/pdfs`);
}

export async function rejectPdf(tenantId: string, pdfDocumentId: string) {
  await requireTenantRole(tenantId, PDF_APPROVAL_ROLES);

  await pool.query(
    `UPDATE pdf_documents SET status = 'rejected', reviewed_at = now()
     WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
    [pdfDocumentId, tenantId]
  );
  revalidatePath(`/tenants/${tenantId}/pdfs`);
}
