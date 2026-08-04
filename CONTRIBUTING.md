# Contributing

Contributions must preserve the public/private boundary and humane defaults.

Before a pull request:

1. use only synthetic test data;
2. keep inference off by default;
3. preserve export, refusal, correction, and deletion;
4. never weaken owner scoping or trust caller-supplied identity headers;
5. run `npm run typecheck`, `npm run lint`, `npm test`, and `npm run security:audit`;
6. explain privacy, accessibility, migration, and capsule compatibility effects.

Do not commit `.openai/hosting.json`, `.env`, `.dev.vars`, capsules, databases, screenshots containing private content, generated runtime folders, or copied third-party correspondence.
