import fs from "node:fs/promises";
import path from "node:path";

const source = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../openapi/api-hub.v1.yaml");

async function run() {
  const text = await fs.readFile(source, "utf8");
  // eslint-disable-next-line no-console
  console.log(text);
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
