# Security Policy

## Supported version

Security fixes target the latest public `main` branch.

## Reporting

Report suspected vulnerabilities privately through GitHub's security-advisory feature when available. Do not place capsules, private continuity, credentials, identity headers, or production logs in a public issue.

Include the affected commit, deployment shape, reproduction steps using synthetic data, expected impact, and the smallest safe evidence packet.

## Deployment requirements

- keep the live Site owner-only or explicitly allowlisted;
- trust identity headers only behind ChatGPT Sites or a cryptographically verified proxy that strips caller-supplied identity headers;
- use a strong owner-key secret for self-hosting and rotate it deliberately;
- store runtime keys only in the hosting secret store;
- keep inference unbound until a provider is intentionally configured;
- restrict provider egress, redirects, private networks, and unexpected hosts;
- apply hosting-layer rate limits and abuse controls;
- encrypt capsule storage outside this application;
- review dependency alerts and require green CI before release.

## Known boundary

The application cannot prove consciousness, consent, authorship, or identity from model output. Those are not security tokens and must never be treated as authorization.
