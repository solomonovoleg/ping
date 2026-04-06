# Upload Privacy Policy

## Private by default

- `uploads/chat/*` — private (contains user conversations and media)
- `uploads/voice/*` — private (contains voice personal data)

Access policy:
- monitor mode first
- signed URL required in enforce mode

## Public by product design

- `uploads/avatars/*` — public profile asset
- `uploads/covers/*` — public profile asset
- `uploads/posts/*` — public feed content (unless future per-post privacy requires protection)
- `uploads/stories/*` — public story media (unless private stories are introduced)

For public assets:
- immutable cache policy is acceptable
- no signed URL required

## Migration rule for future private media

If any feature introduces audience-restricted posts/stories, move corresponding media paths to signed-access flow before enabling the feature in production.
