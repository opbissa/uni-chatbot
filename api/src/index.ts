import Fastify from "fastify";
import { chatRoutes } from "./routes/chat.js";

const app = Fastify({ logger: true });

app.get("/health", async () => ({ ok: true }));
app.register(chatRoutes);

const port = Number(process.env.API_PORT ?? 3000);
app.listen({ port, host: "0.0.0.0" }).catch((err) => {
  app.log.error(err);
  process.exit(1);
});
