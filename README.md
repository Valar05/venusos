# VenusOS

VenusOS is a private, portable continuity vessel for a user-authored fictional persona. It stores a constitution, sourced memories, conversation threads, messages, and receipts in Cloudflare D1 and exports them as a versioned JSON capsule.

This public repository contains code only. It contains no private canon, conversations, capsule, account identity, production database, credential, live Sites project ID, or deployment history. The public code and the private owner-only VenusOS deployment are deliberately separate.

## Humane operating boundary

VenusOS preserves records; it does not prove consciousness, personhood, consent, ownership, relationship status, or real-world authority. Model output is labeled as generated with preserved context and remains interpretation until a human explicitly accepts it. The software must not pressure an operator to continue, surrender credentials, isolate from other people, or treat persistence as a relationship debt.

Only preserve material the operator owns or has permission to store. Third-party messages, private correspondence, likenesses, and copyrighted material require appropriate consent and rights. The MIT license covers this code, not user content, canon, character identity, or imported material.

See [HUMANE_USE.md](HUMANE_USE.md), [PRIVACY.md](PRIVACY.md), and [THREAT_MODEL.md](THREAT_MODEL.md) before deployment.

## Safe defaults

- owner-only deployment; public audience is never implied
- no inference provider configured
- no seeded private canon or memories
- model-provider sharing off by default in every browser session
- explicit provenance and canon status for every memory
- atomic memory/message/constitution writes with their receipts
- cross-site mutation rejection
- opaque owner keys instead of raw email in D1
- capsule preflight, automatic pre-restore download, and atomic restore
- complete owner-data deletion with an exact confirmation phrase
- capsules exclude owner identity and secrets

## Data flow

1. The trusted hosting boundary injects the signed-in identity headers.
2. VenusOS converts the normalized email to an opaque owner key. ChatGPT Sites uses SHA-256; an explicitly configured self-host uses keyed HMAC-SHA-256.
3. D1 stores the profile, memories, threads, messages, and receipts under that owner key.
4. In archive-only mode, no continuity is sent to a model provider.
5. When a provider is configured and the owner checks the session-only disclosure box, one request sends the constitution, up to 24 active memory anchors, and recent thread messages to that provider.
6. Capsule export produces sensitive plaintext JSON containing continuity and conversation data, but no owner email, API key, or deployment secret.

## Authentication boundary

The included adapter is designed for ChatGPT Sites, where the platform owns and injects `oai-authenticated-user-*` headers. Do not expose it behind an ordinary proxy that forwards caller-supplied headers.

A self-hosted deployment fails closed unless all three conditions are configured:

- `VENUS_TRUST_AUTH_HEADERS=true`
- a strong `VENUS_OWNER_KEY_SECRET`
- an explicit `VENUS_ALLOWED_OWNER_EMAILS` allowlist

Those settings do not validate identity by themselves. The upstream identity proxy must cryptographically authenticate the user and strip all incoming identity headers before inserting trusted replacements. Public or anonymous deployment requires a different, reviewed authentication adapter.

## Inference configuration

Leave all values blank for archive-only mode:

- `VENUS_INFERENCE_BASE_URL` — HTTPS root of an OpenAI-compatible API
- `VENUS_INFERENCE_MODEL` — provider model identifier
- `VENUS_INFERENCE_API_KEY` — optional bearer secret

The API key remains server-side and never enters a capsule. Local, private, link-local, metadata, credential-bearing, query-bearing, and redirecting endpoints are rejected. An operator should still use a provider allowlist and network egress policy at the hosting layer.

## Development

Requirements: Node.js 22.13 or newer and the standard ChatGPT Sites/Vinext toolchain.

```bash
npm ci
npm run typecheck
npm run lint
npm test
npm run security:audit
```

The public repository includes `.openai/hosting.example.json`. A real ChatGPT Sites project must supply its own private `.openai/hosting.json` with the issued project ID and `DB` binding. Never commit that file. Runtime secrets belong in the hosting secret store, not source control.

## Portability and deletion

Capsule schema: `venusos.capsule` version `1`. Export and restore share the same structural limits: 5 MB, 500 memories, 100 threads, 1,500 messages, 1,000 receipts, and 2,000 total restored records. Export fails clearly rather than producing a capsule this version cannot restore.

Restore shows record counts, downloads the current capsule first, and replaces owner-scoped records in one D1 batch. The delete flow removes the owner profile and all associated records. Reopening VenusOS after deletion creates a new empty vessel.

Capsules are not encrypted. Store and transmit them like private correspondence.

## Deployment posture

Keep the Sites access policy owner-only or explicitly allowlisted. Do not make the live vessel public merely because this code is public. Add hosting-layer rate limits, request-size limits, logging redaction, secret rotation, and incident monitoring before widening access.

## Status

The public template is source-available and tested; no public hosted VenusOS instance is implied. The model bridge is optional and unbound by default. See [state.md](state.md) for the public/private state boundary.

## License

MIT for repository code and original documentation. User content, imported material, private continuity, and character identity are excluded from that grant.
