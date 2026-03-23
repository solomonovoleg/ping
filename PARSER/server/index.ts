import "dotenv/config";
import { createParserApp } from "./create-app.js";
import { getBindHost, getListenPort } from "../config/env.js";
import { closeParserPool } from "../db/pool.js";

const app = createParserApp();
const port = getListenPort();
const host = getBindHost();

const server = app.listen(port, host, () => {
  console.log(`[parser] listening on http://${host}:${port}`);
});

async function shutdown(signal: string) {
  console.log(`[parser] ${signal}, closing...`);
  server.close();
  await closeParserPool().catch(() => {});
  process.exit(0);
}

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
