"use server";

import bcrypt from "bcryptjs";
import { pool } from "../../lib/db";
import { requireUser } from "../../lib/authorize";

export async function changePassword(currentPassword: string, newPassword: string) {
  const user = await requireUser();

  if (newPassword.length < 8) {
    return { error: "New password must be at least 8 characters." };
  }

  const { rows } = await pool.query(`SELECT password_hash FROM admin_users WHERE id = $1`, [
    user.id,
  ]);
  const row = rows[0] as { password_hash: string } | undefined;
  if (!row) {
    return { error: "Account not found." };
  }

  const valid = await bcrypt.compare(currentPassword, row.password_hash);
  if (!valid) {
    return { error: "Current password is incorrect." };
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  await pool.query(`UPDATE admin_users SET password_hash = $1 WHERE id = $2`, [newHash, user.id]);

  return { success: true };
}
