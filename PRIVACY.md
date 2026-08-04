# Privacy

## Stored data

D1 stores an opaque owner key, persona profile and constitution, sourced memories, thread metadata, message text, model identifiers attached to generated messages, receipts, and timestamps. Raw owner email is not stored by this application.

## Model-provider disclosure

Inference is off by default. When both a provider is configured and the signed-in owner opts in for the current browser session, VenusOS sends the constitution, up to 24 active memory anchors, and recent messages to the configured endpoint. The external provider's retention and training policies then apply.

## Capsules

Capsules are plaintext JSON. They include the constitution, active memories, threads, messages, receipt summaries, timestamps, provenance, and model identifiers. They exclude account email, owner key, API keys, and deployment secrets. Anyone who obtains a capsule can read it.

## Retention and control

The owner can export, correct, mark non-canon, archive a memory, restore, or permanently delete all owner-scoped records. Archive is not deletion. Hosting-provider backups and D1 Time Travel may retain recoverable historical state for the provider's documented window; operators must disclose that window to users.

## Logs

Application code does not intentionally log message or memory bodies. Hosting providers may retain request metadata and error telemetry. Operators must redact identity headers, authorization values, capsule bodies, prompts, and model responses from logs.

## Public repository boundary

This repository must never contain a live hosting manifest, database, capsule, private canon, conversation export, credential, real user email, or generated runtime cache. The release guard test enforces known patterns but does not replace review.
