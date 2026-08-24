# Levanter Personal WhatsApp Assistant — Final Implementation Report

**Date:** 24 August 2026

**Repository:** [LRDMX69/Knightbot-MD](https://github.com/LRDMX69/Knightbot-MD)

**Review branch:** [`levanter-assistant-hardening`](https://github.com/LRDMX69/Knightbot-MD/tree/levanter-assistant-hardening)

**Commit:** See the latest commit on the linked review branch.

**Author:** **Manus AI**

## Executive result

The existing Knightbot-MD repository was transformed into a substantially safer and more maintainable foundation for Levanter, a personal WhatsApp assistant. The implementation retains Baileys because the requested objective is personal-account automation and the repository already uses that integration. The new assistant core adds environment-driven configuration, persistent local state, owner authorization, access modes, safe arithmetic, notes, AI-provider abstraction, message deduplication, rate limiting, redacted structured logging, bounded reconnects, and automated tests.

The work is **verified at the code and local-process level**. Twelve automated tests pass, all changed JavaScript files pass syntax checking, invalid AI configuration fails fast, and a bounded startup smoke test reaches the Baileys QR-authentication stage without application initialization errors. A live WhatsApp login, real inbound/outbound message exchange, and a live AI-provider response are **not verified** because no personal WhatsApp session or user-supplied AI configuration was provided. The implementation is therefore ready for owner configuration and deployment, but it should not be described as live production-connected from this environment.

## Architecture selected

The system is a single Node.js process with a small assistant core layered ahead of the existing legacy command router. The core parses normalized WhatsApp messages, claims message IDs to prevent duplicate processing, applies access and ownership rules, dispatches a finite set of assistant commands, invokes a provider-agnostic AI client when configured, persists notes and conversation context, and sends phone-readable response chunks. Existing group-management and media commands remain available through the legacy router.

The chosen personal-account route is technically compatible with the repository but is not an official WhatsApp integration. Meta’s official Cloud API is the preferred choice for business or customer-facing deployments because it provides documented Business Platform webhooks and bearer-token messaging. Meta’s official route requires a WhatsApp Business Account and business phone number, and it applies opt-in and customer-service-window rules. Baileys remains the practical route for the personal-account objective, with an explicit account-safety warning. [1] [2] [3] [4]

| Component | Implementation | Responsibility |
| --- | --- | --- |
| WhatsApp layer | Existing Baileys socket in `index.js` | Session authentication, message events, sending, reconnection |
| Assistant core | `core/assistant.js` | Command routing, AI flow, response chunking, status, notes, diagnostics |
| Parser | `core/parser.js` | Text extraction, prefixes, mentions, quoted replies, multi-device JID normalization |
| Configuration | `core/config.js`, `.env.example` | Environment-driven identity, AI, limits, logging, persistence, feature flags |
| Persistence | `core/store.js` | Atomic JSON state for mode, notes, conversations, and processed-message IDs |
| AI layer | `core/ai.js` | OpenAI-compatible request construction, timeout, response parsing, safe errors |
| Security | `core/security.js` | Owner identity normalization, private mode, AI access checks |
| Reliability | `core/rate-limit.js`, bounded reconnect logic | Request throttling, duplicate suppression, exponential reconnect backoff |
| Observability | `core/logger.js` | Structured JSON logs with message contents removed by default |
| Compatibility layer | `commands/chatbot.js`, `settings.js`, `config.js` | Keeps legacy modules working while removing hardcoded AI/API credentials |

## Features delivered

The core assistant provides configurable `.`, `/`, or user-selected prefixes for `/help`, `/ping`, `/status`, `/ai <message>`, `/ask <message>`, `/chat <message>`, `/clear`, `/calc <expression>`, `/time`, `/note <text>`, `/notes`, `/mode public|private`, and `/diagnostics`. Private-chat AI is enabled when configured; group AI is disabled by default and requires `GROUP_AI=true`, a group chatbot toggle, and a mention or reply to the bot.

Notes are owner-only and stored separately from conversation context. Conversation context is bounded to the configured maximum number of messages. Replies are split at the configured maximum length, which defaults to the 4096-character text limit documented by Meta for Cloud API text messages. The calculator accepts restricted arithmetic only and does not use `eval`. Unknown legacy commands continue to flow to the existing command router rather than being silently swallowed by the new core.

The old chatbot path that called a hardcoded third-party endpoint was replaced with the shared AI provider abstraction. The provider defaults to disabled and must be explicitly enabled. This prevents an ambient environment key from silently turning on AI during startup. Supported provider values are currently `disabled` and `openai-compatible`; an unsupported value fails configuration validation before the bot starts.

## Important changes

The principal new modules are `core/config.js`, `core/parser.js`, `core/store.js`, `core/security.js`, `core/ai.js`, `core/assistant.js`, `core/calculator.js`, `core/rate-limit.js`, and `core/logger.js`. `test/core.test.js` adds the automated suite. `README.md` and `docs/levanter-audit.md` document the architecture and deployment boundary. `Dockerfile` now uses Node 22, installs from the lockfile, runs as the non-root `node` user, and creates the actual runtime directories. `docker-compose.yml` now persists `session/`, `data/`, and `database/` and loads `.env`.

The repository no longer tracks the local `.env`, Baileys store, session placeholder, or JSON runtime data. These files are ignored by Git. The former source-level owner number and third-party API-key values were removed from active configuration and replaced with environment lookups. Removing a credential from the current tree does not erase it from Git history; any credential that was ever valid must still be rotated by its owner.

## Testing and verification evidence

| Check | Result | Evidence |
| --- | --- | --- |
| JavaScript syntax | **VERIFIED** | `npm run check:syntax` passed for the core and command JavaScript files |
| Automated unit/adversarial tests | **VERIFIED** | `npm test`: 12 tests passed, 0 failed |
| Parser and routing | **VERIFIED** | Prefixes, arguments, mentions, quoted replies, and core commands covered |
| Calculator safety | **VERIFIED** | Arithmetic succeeds; unsupported characters and oversized expressions are rejected |
| Persistence | **VERIFIED** | Atomic state writes, notes, conversations, modes, and duplicate claims covered |
| Owner authorization | **VERIFIED** | Multi-device JID normalization and private-mode rejection covered |
| AI request construction | **VERIFIED** | Compatible URL, bearer header, model, body, response extraction, safe error handling covered |
| Duplicate event handling | **VERIFIED** | Repeated message ID is ignored after the first handling |
| Response length control | **VERIFIED** | Long responses are split into configured-size chunks |
| Invalid AI configuration | **VERIFIED** | `AI_PROVIDER=openai-compatible` without `AI_MODEL` exits with a clear configuration error |
| Process startup without a session | **PARTIALLY VERIFIED** | Bounded smoke test initialized Baileys and rendered a QR challenge; it was intentionally stopped before pairing |
| Live WhatsApp receive/send | **NOT VERIFIED** | Requires the owner’s linked session and a real test message |
| Live AI provider response | **NOT VERIFIED** | Requires the owner to configure a provider, model, and API key |
| Production deployment | **NOT VERIFIED** | No deployment target or live credentials were supplied |

The initial dependency audit of the inherited repository reported 46 production-tree vulnerabilities: 4 low, 16 moderate, 20 high, and 6 critical. The implementation did not silently claim those inherited dependency issues were fixed. The network-dependent audit command was not reliable within the execution time budget, so dependency vulnerability remediation remains an explicit follow-up task rather than a completion claim.

The first local startup attempt also exposed a native `sharp` installation problem caused by the deliberate baseline command `npm ci --ignore-scripts`. Running `npm rebuild sharp` repaired the local development install, and the production Dockerfile uses a normal lockfile installation so native dependency install scripts can run during image construction. This distinction is documented as an operational constraint.

## Security controls

The bot now loads secrets through environment variables and provides `.env.example` placeholders only. Owner-only commands use normalized JID comparison against `OWNER_NUMBER`; private mode blocks both commands and ordinary AI messages from non-owners. AI request bodies are never logged, and structured logging excludes message content by default. AI requests have a bounded timeout, and error messages sent to users do not expose provider details.

The state store writes through a temporary file followed by a rename and uses restrictive file permissions for newly written state. Runtime state, local databases, session files, and store artifacts are excluded from Git. The bot no longer sends the original branded newsletter-forwarding metadata or an unsolicited connect message by default. Reconnection uses bounded exponential delays and stops on logout rather than recursively spawning immediate reconnect loops.

These controls reduce risk but do not make Baileys official or eliminate the risk of WhatsApp account restriction. Baileys’ own project documentation identifies it as a WhatsApp Web protocol library and warns that it is unofficial and should not be used for spam, bulk, or abusive automation. [6]

## Defects found and fixed

The initial code had hardcoded owner and external API credentials, an AI call to an undocumented third-party endpoint, no provider abstraction, no AI timeout, no conversation state, a placeholder failing test command, fragmented JSON persistence, a weak session-encryption helper that stored its key beside ciphertext, duplicate status listeners, complete connection-object logging, recursive reconnect behavior, and a missing filesystem import in the utility module. The new assistant core and configuration changes address the mission-relevant items without attempting a complete rewrite of every legacy media or moderation command.

One inherited dependency risk remains open. The project still contains a large legacy dependency surface with deprecated packages and the audit result described above. A future dependency-modernization pass should be isolated from the assistant-core work and validated against every media and group-management command.

## Deployment instructions

Create a durable host that can keep one Node.js process online and preserve the `session/` directory and `data/levanter-state.json`. On a local or third-party host, install Node.js 22, install dependencies with `npm ci`, copy `.env.example` to `.env`, configure `OWNER_NUMBER`, and run `npm start`. For first-time linking, keep `PAIRING_CODE=false` to use the terminal QR flow, or explicitly set `PAIRING_CODE=true` and provide a pairing number locally. Do not upload or share the resulting session files.

For Docker, configure `.env` locally and run:

```sh
docker compose build
docker compose up -d
docker compose logs --tail=100 bot
```

Set `AI_PROVIDER=disabled` until an AI provider, model, and secret have been deliberately selected. To enable an OpenAI-compatible endpoint, configure `AI_PROVIDER=openai-compatible`, `AI_BASE_URL`, `AI_MODEL`, and `AI_API_KEY`. Keep `GROUP_AI=false` unless group use is intentional and consensual. Configure backups for the session and state directories, encrypt those backups, and test restoration.

## Cost and hosting considerations

The repository itself introduces no new paid service. AI provider usage may incur provider charges, and a durable host may incur hosting charges. The official WhatsApp Business Platform may apply message/category charges depending on the account, region, and message type. The unofficial Baileys route avoids an official per-message API fee but carries compatibility and account-loss risk. These are architectural tradeoffs rather than guaranteed prices.

## Remaining issues and risks

Live WhatsApp behavior is not verified. The owner must pair the bot, send test messages from an authorized account, test `.ping`, `.status`, `.calc 2+2`, `.note`, `.notes`, `.clear`, `.mode private`, and `.mode public`, and verify unauthorized access from a separate test account. AI behavior must be tested with a provider configured and then tested with invalid credentials, timeouts, provider errors, and a long response.

The existing legacy command surface remains large and heterogeneous. Some commands call external services whose availability, terms, and credentials were not audited in this increment. The legacy JSON persistence and weak encryption helpers remain present for compatibility but are not used by the new assistant core. Future work should either remove them after command-by-command migration or replace them with a formally reviewed storage abstraction.

The account-safety risk is the most important remaining platform risk. Meta’s official Cloud API documentation is the recommended route for a business deployment, while this personal-account implementation should remain low-volume, owner-controlled, and non-spammy. [1] [2] [5] [6]

## High-value future extensions

The next worthwhile improvements are a complete dependency upgrade with regression testing, command-by-command migration into the registry, encrypted session backup using an external secret, a SQLite migration if state volume grows, health metrics that do not expose message content, and an official Cloud API adapter for business deployments. A browser dashboard or multi-service architecture is not justified for the current personal MVP.

## References

1. [Meta — WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
2. [Meta — Webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
3. [Meta — Text messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages)
4. [Meta — Service messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
5. [WhatsApp — Terms of Service](https://www.whatsapp.com/legal/terms-of-service)
6. [WhiskeySockets — Baileys](https://github.com/WhiskeySockets/Baileys)
