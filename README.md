# Levanter

Levanter is a personal WhatsApp assistant built on Node.js and Baileys. It provides a small, extensible assistant core for private conversations while retaining the existing group-management commands from the original Knightbot project. The core supports configurable commands, owner access control, persistent notes and conversation context, safe arithmetic, bounded AI requests, duplicate-event suppression, redacted logging, and container deployment.

> **Platform status:** Baileys is an unofficial WhatsApp Web protocol client. It is not affiliated with or authorized by WhatsApp, and linking a personal account may lead to session failure or account restriction. Use only for personal, consensual, low-volume automation. Do not use Levanter for spam, bulk messaging, scraping, anti-abuse bypasses, or unauthorized access.

## Integration choice

The official WhatsApp Business Cloud API is the preferred route for business or customer-facing deployments. Meta documents it as a Business Platform integration using a business phone number, access token, public HTTPS webhooks, user opt-in, and a 24-hour customer-service window for free-form service replies. This repository retains Baileys because the stated objective is a personal-account assistant and the existing project already uses that route.

| Route | Best fit | Main tradeoff |
| --- | --- | --- |
| Baileys personal-account session | Personal assistant for the owner’s own account | Unofficial protocol, ongoing compatibility work, and account-safety risk |
| Official WhatsApp Business Cloud API | Business or customer-facing assistant | Requires Meta Business setup and does not directly automate an ordinary personal account |
| Separate assistant interface | Lowest WhatsApp risk | Not a WhatsApp bot; messages must be handled in another interface |

## Requirements

Use Node.js 22 or another current Node.js release supported by the installed Baileys dependency. A persistent host is required for reliable operation because the bot must keep its WhatsApp session online. The host must provide durable storage for `session/` and the configured assistant state file. Docker is supported; a local or third-party always-on Node.js host is also suitable.

## Installation

```sh
git clone https://github.com/LRDMX69/Knightbot-MD.git
cd Knightbot-MD
npm ci
cp .env.example .env
```

Edit `.env` locally. Never commit `.env`, the `session/` directory, `data/*.json`, or `database/*.json`. Configure `OWNER_NUMBER` as digits in international format without a leading plus sign. `PAIRING_PHONE_NUMBER` is used only when `PAIRING_CODE=true`; it should not be stored in a public repository or shared with anyone.

Start the bot with:

```sh
npm start
```

For first-time linking, either leave `PAIRING_CODE=false` and scan the terminal QR code, or set `PAIRING_CODE=true` and provide the pairing number interactively or through the local environment. Keep the linked phone available and follow WhatsApp’s Linked Devices flow. The generated Baileys credentials are sensitive and must be backed up securely, never pasted into an issue, chat, or commit.

## Configuration

The complete placeholder configuration is in [`.env.example`](.env.example). The high-value settings are summarized below.

| Variable | Purpose | Default |
| --- | --- | --- |
| `BOT_NAME` | Assistant display name | `Levanter` |
| `OWNER_NUMBER` | Owner identity for privileged commands | Required for owner commands |
| `PREFIX` | Primary command prefix | `.` |
| `ALTERNATE_PREFIXES` | Comma-separated alternate prefixes | `/` |
| `BOT_MODE` | Initial access mode | `public` |
| `TIMEZONE` | Timezone for `/time` | `UTC` |
| `DATA_PATH` | Persistent assistant state path | `./data/levanter-state.json` |
| `AI_PROVIDER` | `disabled` or `openai-compatible` | `disabled` |
| `AI_BASE_URL` | OpenAI-compatible API base URL | `https://api.openai.com/v1` |
| `AI_MODEL` | Provider model identifier | Required when AI is enabled |
| `AI_API_KEY` | Provider secret | Empty |
| `DIRECT_AI` | Allow ordinary private-chat AI messages | `true` |
| `GROUP_AI` | Allow group AI after mention/reply | `false` |
| `LOG_MESSAGE_CONTENT` | Include message bodies in logs | `false` |

The AI layer does not call a provider until `AI_PROVIDER`, `AI_MODEL`, and `AI_API_KEY` are configured. It uses a standard OpenAI-compatible chat-completions request and enforces a timeout and maximum response size. Provider-specific credentials and model names are not fabricated by this repository.

## Core commands

The assistant core supports `/help`, `/ping`, `/status`, `/ai <message>`, `/clear`, `/calc <expression>`, `/time`, `/note <text>`, `/notes`, `/mode public|private`, and `/diagnostics`. The primary prefix is configurable, so the same commands can be entered as `.help` when `PREFIX=.`. Notes, access-mode changes, diagnostics, and conversation context are stored locally. Owner-only commands are rejected explicitly for unauthorized senders.

The safe calculator supports numbers, parentheses, unary minus, addition, subtraction, multiplication, division, remainder, and exponentiation. It does not use `eval` and rejects unsupported characters and oversized expressions.

Existing legacy group commands remain available through the original router. The `.chatbot on` and `.chatbot off` controls now use the shared AI provider abstraction instead of the former hardcoded third-party endpoint. Group AI remains opt-in and is disabled by default unless `GROUP_AI=true` and the group chatbot toggle is enabled.

## Data and security

The assistant state is an atomic JSON document with separate sections for settings, notes, conversations, and processed-message IDs. It is intentionally kept simple for a single personal bot. A database can be introduced later if multiple workers, higher write volume, or richer querying makes SQLite or PostgreSQL necessary.

Secrets are loaded from environment variables. The repository no longer defines owner numbers or third-party API keys in source configuration. Any credential that appeared in an earlier repository revision should be rotated by the owner, because removing a secret from the current working tree does not erase it from Git history. Logs omit message bodies by default and expose only operational metadata. Session files and runtime state are ignored by Git and should have restrictive filesystem permissions.

## Testing and verification

Run the following commands before deployment:

```sh
npm run check:syntax
npm test
npm audit --omit=dev
git diff --check
```

The assistant test suite uses Node’s built-in test runner and does not require a live WhatsApp connection or AI credential:

```sh
npm run test:changed
```

It covers command parsing, multi-device JID normalization, arithmetic safety, atomic persistence, owner authorization, AI request construction, provider success handling, duplicate protection, and core command responses. Live WhatsApp login, message receipt, message sending, and a real AI-provider response remain deployment-dependent checks that must be performed by the owner after configuration.

## Docker deployment

Build and run the container with:

```sh
docker compose build
docker compose up -d
```

The Compose file persists `session/`, `data/`, and `database/` and loads variables from the local `.env`. Inspect logs without exposing credentials:

```sh
docker compose logs --tail=100 bot
```

Do not publish the session volume or expose an administrative endpoint. Configure host-level backups for the session and state directories, encrypt those backups, and test restoration before relying on them.

## Operational limitations

This project cannot verify a live WhatsApp account or deployment from the development environment because no user session was provided. It also cannot prove that a particular non-official WhatsApp Web client will remain compatible with future protocol changes. The official Cloud API alternative should be used when account safety, compliance, or customer-facing reliability is more important than personal-account compatibility.

## References

1. [Meta — WhatsApp Cloud API Get Started](https://developers.facebook.com/documentation/business-messaging/whatsapp/get-started)
2. [Meta — Webhooks](https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview)
3. [Meta — Text messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/text-messages)
4. [Meta — Service messages](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/send-messages)
5. [WhatsApp — Terms of Service](https://www.whatsapp.com/legal/terms-of-service)
6. [WhiskeySockets — Baileys](https://github.com/WhiskeySockets/Baileys)
