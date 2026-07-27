import Fastify from "fastify";
import cors from "@fastify/cors";
import { chatRoutes } from "./routes/chat.js";

const app = Fastify({ logger: true });

// Reflect the request Origin so any site can reach the endpoint from the
// browser; the actual per-tenant Origin allowlist check happens in the
// /chat route itself (see tenants/resolve.ts), not here.
await app.register(cors, { origin: true });

app.get("/health", async () => ({ ok: true }));
app.register(chatRoutes);

const port = Number(process.env.API_PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
