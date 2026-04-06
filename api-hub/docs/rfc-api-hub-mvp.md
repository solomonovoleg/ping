# RFC: API HUB MVP

## Goal

Provide a standalone API HUB that lets partner sites authenticate users via PING, read profile/contact/chat data, and send data back (messages, reactions, read/delivered, presence, media).

## Scope v1

- OAuth start/callback/refresh/logout with scoped access.
- Profile + contacts.
- Chat REST: list chats/messages, send text, reactions, status updates.
- Realtime via WebSocket with channel subscriptions.
- Webhook fallback with HMAC signature, retries, dead-letter queue.
- Media upload flow + signed download links + voice/video note message types.

## Non-goals v1

- Group calls and media transcoding pipeline.
- Full moderation AI or external anti-abuse providers.
- Persistent queue infra (Kafka/Rabbit) in first release.

## Security controls

- Partner API key required for all partner-facing endpoints.
- User bearer token with scope checks.
- Refresh token encrypted at rest.
- Webhooks signed with HMAC and timestamp.
- Idempotency keys for message sends.
- Basic partner/user rate limits.

## Delivery checkpoints

- Checkpoint A: foundation, OpenAPI, local run.
- Checkpoint B: OAuth roundtrip with scope enforcement.
- Checkpoint C: bidirectional text+realtime.
- Checkpoint D: media and SDK.
- Checkpoint E: tests + CI + pilot readiness.
