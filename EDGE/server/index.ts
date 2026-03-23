import "dotenv/config";
import { createEdgeApp } from "./create-app.js";
import { getBindHost, getListenPort } from "../config/env.js";
import { closeEdgePool } from "../db/pool.js";

const app = createEdgeApp();
const port = getListenPort();
const host = getBindHost();

const server = app.listen(port, host, () => {
  console.log(`[edge] listening on http://${host}:${port}`);
});

async function shutdown(signal: string) {
  console.log(`[edge] ${signal}, closing...`);
  server.close();
  await closeEdgePool().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
