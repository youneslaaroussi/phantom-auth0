# Phantom Auth0

Phantom Auth0 is an Auth0-first hackathon build for `Authorized to Act: Auth0 for AI Agents`.

It reframes Phantom as a restricted local browser agent that can operate across external apps through a hosted Auth0 companion surface instead of raw third-party credentials embedded in the client. The core idea is simple:

- keep the agent local
- move identity and delegated authority into Auth0
- make high-risk actions explicit
- show the user what the agent is allowed to do

This repo is intentionally isolated from the original Phantom repo, deployment identity, and judging flow.

## Why This Is An Auth0 Project

This submission uses `Auth0 for AI Agents Token Vault` as part of the runtime path, not as a cosmetic integration.

The local extension does not directly own provider secrets. Instead:

1. the user signs in through Auth0
2. the user links external accounts through Connected Accounts
3. the server exchanges the Auth0 refresh token for provider access through Token Vault
4. state-changing actions can move through an Auth0 approval boundary
5. the companion app and extension both surface delegated state and action history

That makes the project about authorization architecture, delegated consent, and control boundaries for agents.

## What The Project Does

Phantom Auth0 is a two-part system:

- `extension/`: the local browser agent. It handles voice UI, page context, browser-native interaction, and the tool calls that reach the Auth0 gateway.
- `server/`: the hosted companion app and action gateway. It handles Auth0 login, Connected Accounts, Token Vault exchanges, pairing approval, and delegated action history.
- `docs/`: setup guides, testing notes, submission material, and judge-facing references.

Current user-visible capabilities:

- pair a local browser extension to a hosted companion app
- sign in with Auth0 Universal Login
- connect Google, GitHub, and optionally Slack through Auth0 Connected Accounts
- check connected account state from inside the extension
- execute delegated Google and GitHub actions through Token Vault
- track delegated action history in the companion app
- request approval for high-risk actions through Auth0 async authorization

## Auth0 Surfaces In This Repo

- Universal Login for user authentication
- Connected Accounts for provider delegation
- My Account API for connected-account management
- Token Vault exchange for provider access tokens
- CIBA-oriented async authorization for approval-required actions
- visible account state and action history in product UI

Official references used while building the hackathon version:

- [Token Vault](https://auth0.com/docs/secure/tokens/token-vault)
- [Connected Accounts for Token Vault](https://auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault)
- [My Account API](https://auth0.com/docs/manage-users/my-account-api)
- [Application client grants](https://auth0.com/docs/get-started/applications/application-access-to-apis-client-grants)
- [Configure CIBA](https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication)
- [GitHub integration for Auth0 for AI Agents](https://auth0.com/ai/docs/integrations/github)

## Delegation Model

The extension is tied directly into the delegated action path. Auth0 is not a separate marketing layer.

- The runtime agent session exposes Auth0-backed tools such as account status, calendar availability, Gmail draft creation, repo listing, and issue creation.
- Those tools resolve through the companion gateway.
- The gateway uses Auth0 refresh-token exchange and Token Vault to mint provider access on demand.
- High-risk actions enter an approval state before execution.

## Approval Boundaries

The repo distinguishes between low-risk and high-risk actions.

- Low-risk actions such as reads, drafts, and previews can execute immediately.
- High-risk actions such as sending, posting, creating, or mutating external state can require Auth0 approval.

This is the part of the project that matters most for the hackathon judging criteria around security model, user control, and production-aware implementation.

## Current Status

Validated in the repo and called out in product/docs:

- Auth0 login
- My Account API access
- MRRT-style refresh-token exchange
- Google Connected Account flow
- Google account state in the companion UI
- extension pairing
- Token Vault status visibility inside the extension
- server build
- extension build

Implemented in code, but still dependent on tenant-side setup before claiming complete end-to-end coverage:

- Auth0 async authorization for high-risk actions
- GitHub Connected Account flow
- GitHub repo listing and GitHub issue creation

Explored but not part of the recommended v1 path:

- Slack

## Provider Matrix

| Provider | Connected Account | Read Path | Draft / Preview Path | Approval-Required Path | Status |
| --- | --- | --- | --- | --- | --- |
| Google | Yes | Calendar availability | Gmail draft | Gmail send, Calendar create | Recommended |
| GitHub | Implemented | Repo listing | Issue draft | Issue creation | Needs tenant validation |
| Slack | Partial | N/A | Preview only | Post message | Not part of v1 |

## Architecture Notes

The project deliberately separates local execution from delegated authority.

- The extension remains the local client for context, interaction, and UX.
- The companion app becomes the trust surface for login, connected accounts, action history, and approval state.
- Auth0 becomes the authority layer for identity, delegation, token exchange, and optional step-up approval.
- External providers only see delegated calls from the gateway after Auth0 has established the right context.

That separation is the primary significant update in this hackathon repo.

## Recommended Judge Story

The shortest reliable evaluation path is still the Google path:

1. pair the extension
2. show Auth0 status in the extension
3. show Google connected in the companion app
4. ask Phantom to check calendar availability
5. ask Phantom to create a Gmail draft
6. show delegated action history
7. if CIBA is configured, trigger one approval-required action

## Local Development

### Server

```bash
cd /Users/mac/dev/phantom-auth0/server
npm install
npm run dev
```

Companion app:

- [http://localhost:8080/companion](http://localhost:8080/companion)

### Extension

```bash
cd /Users/mac/dev/phantom-auth0/extension
npm install
npm run dev
```

Then load the unpacked extension in Chrome and open the sidepanel.

## Environment

The server reads `server/.env`.

Important variables:

```bash
PORT=8080
PUBLIC_BASE_URL=http://localhost:8080
AUTH0_DOMAIN=your-tenant.us.auth0.com
AUTH0_CLIENT_ID=your_client_id
AUTH0_CLIENT_SECRET=your_client_secret
AUTH0_API_AUDIENCE=https://phantom-auth0-api
AUTH0_MY_ACCOUNT_AUDIENCE=https://your-tenant.us.auth0.com/me/
AUTH0_GOOGLE_CONNECTION=google-oauth2
AUTH0_GITHUB_CONNECTION=github
AUTH0_SLACK_CONNECTION=slack-oauth-2
```

## Auth0 Setup

Use these docs in this order:

1. [SETUP_AUTH0.md](docs/SETUP_AUTH0.md)
2. [TESTING.md](docs/TESTING.md)
3. [JUDGE_GUIDE.md](docs/JUDGE_GUIDE.md)

## Submission Material

Prepared submission docs:

- [JUDGE_GUIDE.md](docs/JUDGE_GUIDE.md)
- [SETUP_AUTH0.md](docs/SETUP_AUTH0.md)
- [TESTING.md](docs/TESTING.md)
- [DEVPOST_SUBMISSION.md](docs/DEVPOST_SUBMISSION.md)
- [BONUS_BLOG_POST.md](docs/BONUS_BLOG_POST.md)
- [SUBMISSION_CHECKLIST.md](docs/SUBMISSION_CHECKLIST.md)

## Significant Update Narrative

This repo is the hackathon-specific significant update created during the submission period. The main additions here are:

- isolated repo and deployment identity
- hosted Auth0 companion app
- extension-to-companion pairing flow
- Auth0 Connected Accounts flow
- Token Vault-backed Google and GitHub gateway actions
- action history and approval-state tracking
- judge-facing Auth0 status surfaces inside the extension
- Auth0-first docs and architecture framing for the submission

## Notes For Judges

If only one path is tested, test the Google path first. It is the most complete and reliable path in the repo today.
