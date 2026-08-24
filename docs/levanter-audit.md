# Levanter Assistant Audit and Architecture Decision

## Executive assessment

The repository contains a working but loosely structured personal WhatsApp bot based on Baileys. It is suitable as a starting point for Levanter because it already has message reception, message sending, group administration, media commands, and session-based authentication. It is not yet suitable for dependable personal-assistant use without hardening.

The existing project is explicitly an unofficial WhatsApp Web client. Meta’s official Cloud API is the safer and more maintainable platform route, but it is designed for the WhatsApp Business Platform and requires a business account, business phone number, public webhook, access tokens, user opt-in, and a 24-hour customer-service window for free-form replies. The current mission is a personal-account assistant, so the implementation will retain the existing Baileys route while clearly isolating and documenting the account-safety risk. The bot will not add spam, bulk messaging, anti-abuse bypasses, scraping, or other prohibited automation.

## Verified environment

The sandbox provides Ubuntu Linux, Node.js 22.13.0, npm 10.9.2, Python 3.11, Git, and GitHub CLI. The relevant repository is `LRDMX69/Knightbot-MD`, cloned to the working directory. The separate `LRDMX69/nifhdpe` repository is an unrelated React/Vite/Supabase operations platform and will not be modified for this bot task.

The Knightbot repository has a Node.js CommonJS runtime, Baileys 6.7.9 declared in `package.json`, native/media dependencies including FFmpeg-related packages, JSON-file persistence, a Dockerfile, and several hosted-deployment manifests. Dependencies install with warnings and the production dependency tree currently reports 46 vulnerabilities (4 low, 16 moderate, 20 high, and 6 critical) under `npm audit --omit=dev`. The existing test command is a placeholder that exits with status 1, and all JavaScript files pass `node --check`.

## Existing implementation findings

The message router is a single large switch statement in `main.js` with many direct command imports. This makes feature addition possible but makes routing, authorization, persistence, error handling, and provider calls difficult to test independently. The existing chatbot command calls a hardcoded third-party AI endpoint without an API-key abstraction, timeout, retry policy, provider interface, conversation context, or cost controls.

Configuration is fragmented. `settings.js` hardcodes the owner number and a third-party API key, while `config.js` hardcodes multiple external API hosts and API-key-like values. The repository also tracks `.env`, owner-number JSON data, and runtime store artifacts. These items must be removed from version control or replaced with examples, and any credential that has been exposed in repository history should be rotated by the owner.

Persistence is split across several JSON files. The module called `sql/index.js` is a JSON-backed helper rather than SQL; warning counts, chatbot settings, moderation flags, and activity data use overlapping but incompatible stores. `utils.js` contains session-encryption helpers that store the encryption key next to ciphertext, which does not provide meaningful at-rest protection. It also references `fs` without importing it, so the session helper path is not reliable. The router reads a global access-mode flag from the same message-count document that activity tracking treats as a counter map.

Connection handling reconnects recursively after most disconnects and logs complete connection objects and group updates. The message path has duplicate status listeners and sends branded forwarded-newsletter metadata that is unrelated to the personal-assistant mission. Duplicate webhook-style event handling, unbounded message work, and repeated ad-hoc error replies are reliability concerns.

## Integration options

| Approach | Tradeoffs | Cost | Setup complexity |
| --- | --- | --- | --- |
| Official WhatsApp Business Cloud API | Strongest platform and account-safety posture, documented webhooks, bearer-token authentication, and business tooling. It does not automate an ordinary personal account and requires a business-number model, public HTTPS hosting, opt-in, and template rules outside the service window. | Platform messaging charges may apply by category and region; hosting and AI costs are separate. | Medium to high |
| Baileys personal-account session | Matches the current personal-account objective and supports interactive inbound/outbound chats, groups, and linked-device authentication. It is unofficial, can break when WhatsApp Web changes, and may expose the linked account to restriction or loss. | No official per-message API fee, but hosting and AI costs remain; account loss is a material risk. | Medium initially, with ongoing maintenance |
| Separate assistant interface with manual WhatsApp use | Lowest WhatsApp-account risk and easiest compliance posture. It is not a WhatsApp bot and requires switching channels. | Low to medium. | Low |

## Selected implementation boundary

For this task, Levanter will be hardened as a single Node.js process using Baileys because that is the only option aligned with the explicit personal-account objective and the existing repository. The code will be organized around a small assistant core: environment-driven configuration, normalized message parsing, an extensible command registry, owner authorization, a safe JSON store, an abstract AI provider, bounded concurrency/rate limits, deduplication, redacted logging, and tests that do not require a live WhatsApp session.

This choice is a technical implementation decision, not a claim that the route is officially supported. The README and deployment guide will state the risk plainly and will recommend the official Cloud API for any business or customer-facing deployment.

## Scope for the first verified increment

The initial assistant surface will prioritize high-value, low-risk functions: `/help`, `/ping`, `/status`, `/ai`, `/clear`, `/note`, `/notes`, `/calc`, `/time`, and owner-only `/mode` and `/diagnostics`. Existing group moderation and media commands will remain available where they already work, but the new assistant core will not expand mass-messaging or unsolicited automation.

The implementation will use SQLite only if the existing JSON store proves inadequate for the selected features. For the first increment, an atomic JSON store is sufficient and reduces deployment complexity. The file format will separate global settings, notes, conversations, deduplication records, and group configuration instead of mixing them in one counter document.

## Evidence labels

At this stage, environment discovery and the repository baseline are **VERIFIED**. WhatsApp platform behavior cited in the accompanying research record is **VERIFIED** against Meta documentation. Live WhatsApp login, message receipt, message sending, and AI-provider success are **NOT VERIFIED** because no user session or provider credential has been supplied in this task. They must be tested by the owner after deployment.

## Sources

1. Meta, “WhatsApp Cloud API Get Started,” https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started
2. Meta, “Webhooks,” https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
3. Meta, “Text messages,” https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages
4. Meta, “Service messages,” https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages
5. WhatsApp, “Terms of Service,” https://www.whatsapp.com/legal/terms-of-service
6. WhiskeySockets, “Baileys,” https://github.com/WhiskeySockets/Baileys
