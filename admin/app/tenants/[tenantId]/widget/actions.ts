"use server";

import { revalidatePath } from "next/cache";
import { pool } from "../../../../lib/db";
import { requireUser, UnauthorizedError } from "../../../../lib/authorize";
import { themeFromFormData } from "../../../../lib/widget-theme";

export async function updateTenantTheme(tenantId: string, formData: FormData) {
  const user = await requireUser();
  if (!user.isSuperAdmin) {
    throw new UnauthorizedError("Only super admins can customize the widget");
  }

  const theme = themeFromFormData(formData);

  const { rowCount } = await pool.query(`UPDATE tenants SET theme = $1 WHERE id = $2`, [
    theme,
    tenantId,
  ]);
  if (rowCount === 0) return { error: "Tenant not found." };

  revalidatePath(`/tenants/${tenantId}/widget`);
  return { theme };
}
