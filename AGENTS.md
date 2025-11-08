# Project Guardrails for Chat3 Development

1. **Respect message namespaces** – keep `internal.*`, `system.*`, and `user.*` validation in sync across schemas, controllers, models, docs, and seed data whenever message types change.
2. **Use project scripts** – run maintenance tasks through the provided npm scripts (`npm run seed`, `npm run generate-key`, `npm run start:server`, etc.) instead of ad-hoc commands.
3. **Refresh demo API credentials** – after generating a new key, propagate it to every `src/public/api-test*.html` page before handing work off.
4. **Restart via helper script** – after reseeding data or rotating keys, restart services with `/home/sergey/Projects/tmp3/chat3/restart.sh` so the API server and worker pick up changes cleanly.
5. **Mirror test infrastructure** – rely on `mongodb-memory-server` and `@onify/fake-amqplib` for controller/utility integration tests to match the project’s established testing approach.

