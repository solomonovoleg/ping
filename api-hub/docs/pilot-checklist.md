# Pilot checklist (1 partner)

- Partner app key issued and rotated in secret manager.
- OAuth callback URL registered and verified.
- Required scopes agreed: profile/chat/presence.
- Webhook endpoint reachable and signature verification enabled.
- Text send/receive, reaction, delivered/read validated end-to-end.
- Realtime reconnect and ack behavior validated.
- Voice note and video note send/playback validated.
- Rate limits and idempotency behavior validated.
- Dashboard alerts wired (error rate, webhook lag, ws disconnect spikes).
- Go-live rollback plan tested.
