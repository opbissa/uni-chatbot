// Per-tenant admin roles. Free text in the DB (admin_user_tenant_roles.role) —
// add new roles here as they're needed, no migration required.
export const ROLES = {
  TENANT_ADMIN: "tenant_admin",
  CONTENT_APPROVER: "content_approver",
  ANALYTICS_VIEWER: "analytics_viewer",
} as const;

export const PDF_APPROVAL_ROLES = [ROLES.TENANT_ADMIN, ROLES.CONTENT_APPROVER];
