import type { FastifyInstance } from "fastify";
import { resolveTenantByKey, isOriginAllowed } from "../tenants/resolve.js";

export async function widgetConfigRoutes(app: FastifyInstance) {
  app.get<{ Querystring: { tenantKey: string } }>("/widget-config", async (request, reply) => {
    const { tenantKey } = request.query;

    const tenant = await resolveTenantByKey(tenantKey);
    if (!tenant) return reply.code(404).send({ error: "unknown tenant" });

    if (!isOriginAllowed(tenant, request.headers.origin)) {
      return reply.code(403).send({ error: "origin not allowed for this tenant" });
    }

    return {
      chatHistoryLimit: tenant.chatHistoryLimit,
      chatHistoryExpiryHours: tenant.chatHistoryExpiryHours,
    };
  });
}
