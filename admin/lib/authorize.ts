import { auth } from "./auth";

export class UnauthorizedError extends Error {
  constructor(message = "Not authorized") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

/** Throws unless there's a logged-in session; returns the session user. */
export async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new UnauthorizedError("Not signed in");
  return session.user;
}

/**
 * Throws unless the current user is a super admin or holds one of
 * `allowedRoles` on `tenantId`. Pass no `allowedRoles` to allow any role
 * granted on that tenant (i.e. just check tenant access).
 */
export async function requireTenantRole(tenantId: string, allowedRoles?: string[]) {
  const user = await requireUser();
  if (user.isSuperAdmin) return user;

  const grant = user.tenantRoles.find((r) => r.tenantId === tenantId);
  if (!grant) throw new UnauthorizedError("No access to this tenant");
  if (allowedRoles && !allowedRoles.includes(grant.role)) {
    throw new UnauthorizedError(`Requires one of: ${allowedRoles.join(", ")}`);
  }
  return user;
}
