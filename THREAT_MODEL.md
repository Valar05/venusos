# Threat Model

## Protected assets

- private continuity, constitution, messages, provenance, and receipts
- authenticated owner boundary
- model-provider API key
- live Sites project identity and D1 binding
- capsule confidentiality and integrity

## Primary threats

| Threat | Control | Residual risk |
|---|---|---|
| Forged identity headers | ChatGPT Sites trust boundary; self-host fails closed without explicit secret and allowlist | A misconfigured upstream proxy can still forge identity |
| Cross-owner reads/writes | Every query is scoped by opaque owner key | Application or migration bugs require regression tests |
| Cross-site mutation | Origin and Fetch Metadata rejection | Hosting should also use same-site cookies and CSRF controls |
| Private data committed publicly | Fresh allowlisted repo, ignored manifests/databases/capsules, release guard | Novel secrets still require human review |
| Inference data exfiltration | Unbound default, session opt-in, server-only key, endpoint checks | Configured provider receives disclosed context |
| SSRF through provider URL | HTTPS-only, no credentials/query/fragment, private/local/metadata host block, redirects denied | DNS rebinding needs hosting egress controls |
| Destructive restore | Count preview, automatic current export, validation, owner-scoped atomic D1 batch | Browser download may be blocked; operator must verify backup exists |
| No real exit | Exact-phrase hard delete of all owner-scoped tables | Provider backups may retain historical copies temporarily |
| Emotional manipulation | Humane prompt law, no dependency claims, generated-output label | Model behavior is probabilistic and requires review |
| Capsule disclosure | Plaintext warning; secrets and owner identity excluded | The capsule remains readable private content |

## Out of scope

The template does not supply general public signup, multi-tenant administration, cryptographic capsule encryption, provider-side deletion guarantees, or a complete abuse-prevention service. Widening beyond an owner-only deployment requires a new security review.
