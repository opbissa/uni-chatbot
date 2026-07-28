// CLI for managing admin dashboard accounts (admin_users / admin_user_tenant_roles).
// There's no self-serve signup for admins, so this is the only way in.
//
// Usage:
//   npx tsx scripts/manage-admin-users.ts create-super-admin <email> <password>
//   npx tsx scripts/manage-admin-users.ts create-user <email> <password>
//   npx tsx scripts/manage-admin-users.ts grant-role <email> <tenantId> <role>
//   npx tsx scripts/manage-admin-users.ts list
import { config } from "dotenv";
import path from "node:path";
import pg from "pg";
import bcrypt from "bcryptjs";

// lib/db.ts reads process.env.DATABASE_URL at import time, which would
// happen before this config() call runs (ESM hoists imports) — so this
// script opens its own pool instead of reusing lib/db's.
config({ path: path.resolve(import.meta.dirname, "../../.env") });
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function createUser(email: string, password: string, isSuperAdmin: boolean) {
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await pool.query(
    `INSERT INTO admin_users (email, password_hash, is_super_admin)
     VALUES ($1, $2, $3)
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, is_super_admin = EXCLUDED.is_super_admin
     RETURNING id, email, is_super_admin`,
    [email.toLowerCase(), passwordHash, isSuperAdmin]
  );
  console.log("created/updated admin user:", rows[0]);
}

async function grantRole(email: string, tenantId: string, role: string) {
  const { rows: userRows } = await pool.query(`SELECT id FROM admin_users WHERE email = $1`, [
    email.toLowerCase(),
  ]);
  if (userRows.length === 0) {
    throw new Error(`no admin user with email ${email}`);
  }
  await pool.query(
    `INSERT INTO admin_user_tenant_roles (admin_user_id, tenant_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (admin_user_id, tenant_id, role) DO NOTHING`,
    [userRows[0].id, tenantId, role]
  );
  console.log(`granted '${role}' on tenant ${tenantId} to ${email}`);
}

async function listUsers() {
  const { rows } = await pool.query(
    `SELECT u.email, u.is_super_admin, t.name AS tenant_name, r.role
     FROM admin_users u
     LEFT JOIN admin_user_tenant_roles r ON r.admin_user_id = u.id
     LEFT JOIN tenants t ON t.id = r.tenant_id
     ORDER BY u.email`
  );
  console.table(rows);
}

async function main() {
  const [command, ...args] = process.argv.slice(2);

  switch (command) {
    case "create-super-admin": {
      const [email, password] = args;
      if (!email || !password) throw new Error("usage: create-super-admin <email> <password>");
      await createUser(email, password, true);
      break;
    }
    case "create-user": {
      const [email, password] = args;
      if (!email || !password) throw new Error("usage: create-user <email> <password>");
      await createUser(email, password, false);
      break;
    }
    case "grant-role": {
      const [email, tenantId, role] = args;
      if (!email || !tenantId || !role) throw new Error("usage: grant-role <email> <tenantId> <role>");
      await grantRole(email, tenantId, role);
      break;
    }
    case "list": {
      await listUsers();
      break;
    }
    default:
      throw new Error(
        "usage: manage-admin-users.ts <create-super-admin|create-user|grant-role|list> [...args]"
      );
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
