import "dotenv/config";
import { Client } from "pg";
import { config } from "../../config.js";

async function run() {
  if (!config.dbUrl) {
    throw new Error("API_HUB_DB_URL is required for db:seed");
  }
  const client = new Client({ connectionString: config.dbUrl });
  await client.connect();
  await client.query(
    `
    insert into api_hub_partners (id, name, api_key, webhook_secret, rate_limit_per_minute)
    values ($1, $2, $3, $4, $5)
    on conflict (id) do update
    set name = excluded.name,
        api_key = excluded.api_key,
        webhook_secret = excluded.webhook_secret,
        rate_limit_per_minute = excluded.rate_limit_per_minute
  `,
    ["partner_demo", "Demo Partner", "partner_demo_key", "partner_webhook_secret", 600],
  );
  await client.end();
  // eslint-disable-next-line no-console
  console.log("seed completed");
}

run().catch((error) => {
  // eslint-disable-next-line no-console
  console.error(error);
  process.exit(1);
});
