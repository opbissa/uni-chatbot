import type { NextAuthConfig } from "next-auth";
import type { JWT } from "next-auth/jwt";

export type TenantRole = { tenantId: string; role: string };

declare module "next-auth" {
  interface User {
    isSuperAdmin: boolean;
    tenantRoles: TenantRole[];
  }
  interface Session {
    user: {
      id: string;
      email: string;
      isSuperAdmin: boolean;
      tenantRoles: TenantRole[];
    };
  }
}

// `declare module "next-auth/jwt"` augmentation doesn't resolve under this
// project's `moduleResolution: bundler` setup, so the custom JWT fields are
// carried via this intersection type and cast at the two call sites below
// instead of ambient augmentation.
export type AppJWT = JWT & {
  id: string;
  isSuperAdmin: boolean;
  tenantRoles: TenantRole[];
};

// Edge-safe base config (no providers, no bcrypt/pg): shared by the full
// Node config in auth.ts and the lightweight instance middleware.ts uses.
// Providers live only in auth.ts because Credentials' authorize() needs
// bcrypt + Postgres, neither of which run in the Edge middleware runtime.
export const authConfig = {
  session: { strategy: "jwt" },
  pages: { signIn: "/login" },
  providers: [],
  callbacks: {
    async jwt({ token, user }) {
      const appToken = token as AppJWT;
      if (user) {
        // authorize() in auth.ts always sets `id`; the base User type just declares it optional.
        appToken.id = user.id as string;
        appToken.isSuperAdmin = user.isSuperAdmin;
        appToken.tenantRoles = user.tenantRoles;
      }
      return appToken;
    },
    async session({ session, token }) {
      const appToken = token as AppJWT;
      session.user.id = appToken.id;
      session.user.isSuperAdmin = appToken.isSuperAdmin;
      session.user.tenantRoles = appToken.tenantRoles;
      return session;
    },
  },
} satisfies NextAuthConfig;
