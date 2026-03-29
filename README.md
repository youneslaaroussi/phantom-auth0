# Phantom Auth0

Phantom Auth0 is an isolated hackathon build of Phantom for the `Authorized to Act: Auth0 for AI Agents` hackathon.

It turns Phantom into a restricted local browser agent with a hosted Auth0 companion app for:

- Auth0 Universal Login
- Connected Accounts
- Token Vault-backed delegated actions
- explicit approval boundaries for high-risk actions
- visible action history for auditability

This repo is intentionally separate from the original Phantom repo, deployment targets, and judging flow.

## Hackathon Fit

This project uses `Auth0 for AI Agents Token Vault` as a core runtime dependency, not as a cosmetic add-on.

Current implemented Auth0-backed capabilities:

- pair a local browser extension to a hosted companion app
- connect external accounts through Auth0 Connected Accounts
- exchange a user refresh token for provider access through Token Vault
- distinguish safe actions from high-risk actions
- create approval-required actions for state-changing operations
- surface account state and delegated action history in product UI

Official Auth0 references used while building this repo:

- Token Vault: [auth0.com/docs/secure/tokens/token-vault](https://auth0.com/docs/secure/tokens/token-vault)
- Connected Accounts for Token Vault: [auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault](https://auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault)
- My Account API: [auth0.com/docs/manage-users/my-account-api](https://auth0.com/docs/manage-users/my-account-api)
- Client grants: [auth0.com/docs/get-started/applications/application-access-to-apis-client-grants](https://auth0.com/docs/get-started/applications/application-access-to-apis-client-grants)
- Configure CIBA: [auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication](https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication)
- GitHub integration for Auth0 for AI Agents: [auth0.com/ai/docs/integrations/github](https://auth0.com/ai/docs/integrations/github)

## Current Status

Validated:

- Auth0 login
- My Account API access
- MRRT-based refresh-token exchange
- Google Connected Account flow
- Google account state in companion UI
- extension pairing
- Token Vault status visibility in the extension UI

Implemented in code, but still needs tenant-side validation before claiming complete demo coverage:

- approval-required actions via Auth0 async authorization
- GitHub Connected Account flow
- GitHub repo listing and GitHub issue creation

Not part of the recommended v1 demo:

- Slack

## Recommended Demo Scope

Use the shortest reliable story:

1. Pair the extension.
2. Show Auth0 Token Vault state in the extension UI.
3. Show Google connected in the companion app.
4. Ask Phantom to check calendar availability.
5. Ask Phantom to create a Gmail draft.
6. Show delegated action history.
7. If CIBA is configured, trigger one approval-required action.

## Architecture

- `extension/`: local browser agent, voice UI, tool execution, pairing, and Auth0 status surfaces
- `server/`: companion app, pairing endpoints, Connected Accounts flow, Token Vault action gateway, and action history
- `docs/`: judge instructions, setup guides, testing steps, and submission material

## Provider Matrix

| Provider | Connected Account | Read path | Draft path | Approval-required path | Status |
| --- | --- | --- | --- | --- | --- |
| Google | Yes | Calendar availability | Gmail draft | Gmail send, Calendar create | Recommended |
| GitHub | Implemented | Repo listing | Issue draft | Issue creation | Needs tenant validation |
| Slack | Partially explored | N/A | Preview only | Post message | Not recommended for v1 |

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

1. [docs/SETUP_AUTH0.md](/Users/mac/dev/phantom-auth0/docs/SETUP_AUTH0.md)
2. [docs/TESTING.md](/Users/mac/dev/phantom-auth0/docs/TESTING.md)
3. [docs/JUDGE_GUIDE.md](/Users/mac/dev/phantom-auth0/docs/JUDGE_GUIDE.md)

## Submission Material

Prepared docs:

- judge/testing guide: [docs/JUDGE_GUIDE.md](/Users/mac/dev/phantom-auth0/docs/JUDGE_GUIDE.md)
- full setup guide: [docs/SETUP_AUTH0.md](/Users/mac/dev/phantom-auth0/docs/SETUP_AUTH0.md)
- local and extension test plan: [docs/TESTING.md](/Users/mac/dev/phantom-auth0/docs/TESTING.md)
- Devpost description draft: [docs/DEVPOST_SUBMISSION.md](/Users/mac/dev/phantom-auth0/docs/DEVPOST_SUBMISSION.md)
- bonus blog draft: [docs/BONUS_BLOG_POST.md](/Users/mac/dev/phantom-auth0/docs/BONUS_BLOG_POST.md)
- pre-submit gate: [docs/SUBMISSION_CHECKLIST.md](/Users/mac/dev/phantom-auth0/docs/SUBMISSION_CHECKLIST.md)

## Significant Update Narrative

This repo is the hackathon-specific significant update created during the submission period. The main additions in this repo are:

- isolated repo and deployment identity
- hosted Auth0 companion app
- extension-to-companion pairing flow
- Auth0 Connected Accounts flow
- Token Vault-backed Google and GitHub action gateway
- action history and explicit approval state
- judge-facing Auth0 status surfaces inside the extension UI

## Notes For Judges

If only one path is tested, test the Google path first. It is the most complete and reliable implementation in this repo today.
