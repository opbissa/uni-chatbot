import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { pool } from "./db";
import { authConfig } from "./auth.config";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: {},
        password: {},
      },
      async authorize(credentials) {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const { rows } = await pool.query(
          `SELECT id, email, password_hash, is_super_admin FROM admin_users WHERE email = $1`,
          [email.toLowerCase()]
        );
        const user = rows[0] as
          | { id: string; email: string; password_hash: string; is_super_admin: boolean }
          | undefined;
        if (!user) return null;

        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) return null;

        const { rows: roleRows } = await pool.query(
          `SELECT tenant_id, role FROM admin_user_tenant_roles WHERE admin_user_id = $1`,
          [user.id]
        );

        return {
          id: user.id,
          email: user.email,
          isSuperAdmin: user.is_super_admin,
          tenantRoles: roleRows.map((r) => ({ tenantId: r.tenant_id, role: r.role })),
        };
      },
    }),
  ],
});
