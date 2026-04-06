# API HUB scaling notes

## Horizontal WebSocket fanout

Set `API_HUB_REDIS_URL` and optionally `API_HUB_REDIS_CHANNEL` (default `apihub:fanout`). Each API HUB instance:

- Publishes realtime envelopes to Redis after HTTP mutations.
- Subscribes to the same channel and delivers JSON envelopes to local WebSocket clients.

Without Redis, fanout stays in-process only (single instance).

## Database

With `API_HUB_DB_URL`:

- Partner lookup uses PostgreSQL (primary key + optional `api_hub_partner_api_keys` for rotation).
- Hub sessions and `user_links` persist across restarts.
- Webhooks are written to `api_hub_webhook_outbox` and delivered by the worker (retries + dead state when `tries >= 5`).

## Sticky sessions

If you do not use Redis, put all WS clients on the same instance (sticky cookie / single replica) or enable Redis fanout.

## OAuth state / PKCE

`state` and PKCE verifiers are stored in process memory. For multiple stateless API HUB replicas behind a load balancer, use sticky sessions for the OAuth redirect roundtrip or extend the hub with a shared store for OAuth transient data.
