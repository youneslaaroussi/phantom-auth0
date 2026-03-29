# Auth0 Setup

This guide is for local development and hackathon judging prep.

Official references:

- Token Vault: [https://auth0.com/docs/secure/tokens/token-vault](https://auth0.com/docs/secure/tokens/token-vault)
- Connected Accounts for Token Vault: [https://auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault](https://auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault)
- My Account API: [https://auth0.com/docs/manage-users/my-account-api](https://auth0.com/docs/manage-users/my-account-api)
- Client grants: [https://auth0.com/docs/get-started/applications/application-access-to-apis-client-grants](https://auth0.com/docs/get-started/applications/application-access-to-apis-client-grants)
- Configure CIBA: [https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication](https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication)
- GitHub integration: [https://auth0.com/ai/docs/integrations/github](https://auth0.com/ai/docs/integrations/github)

## 1. Create the Auth0 App

Create a `Regular Web Application` called `Phantom Auth0`.

Use these app URLs:

- Allowed Callback URLs:
  - `http://localhost:8080/auth/callback`
  - `http://localhost:8080/connected-accounts/callback`
- Allowed Logout URLs:
  - `http://localhost:8080/companion`
- Allowed Web Origins:
  - `http://localhost:8080`
- Allowed Origins (CORS):
  - `http://localhost:8080`

Enable:

- Authorization Code
- Refresh Token
- Token Vault grant type
- Refresh Token Rotation

## 2. Create the Custom API

Create an API:

- Name: `Phantom Auth0 API`
- Identifier: `https://phantom-auth0-api`

Enable:

- user access for the `Phantom Auth0` application
- offline access if you request `offline_access`

This repo uses that API audience as:

```bash
AUTH0_API_AUDIENCE=https://phantom-auth0-api
```

## 3. Activate My Account API

Activate `Auth0 My Account API`.

Audience:

```bash
AUTH0_MY_ACCOUNT_AUDIENCE=https://YOUR_TENANT_DOMAIN/me/
```

For this app, the user client grant must exist with:

- `create:me:connected_accounts`
- `read:me:connected_accounts`
- `delete:me:connected_accounts`

If the dashboard editor fails, create the client grant through the Management API using `scope`, not `scopes`.

Example:

```bash
curl --request POST \
  --url "https://YOUR_TENANT/api/v2/client-grants" \
  --header "authorization: Bearer YOUR_MANAGEMENT_API_TOKEN" \
  --header "content-type: application/json" \
  --data '{
    "client_id": "YOUR_CLIENT_ID",
    "audience": "https://YOUR_TENANT/me/",
    "scope": [
      "create:me:connected_accounts",
      "read:me:connected_accounts",
      "delete:me:connected_accounts"
    ],
    "subject_type": "user"
  }'
```

## 4. Enable MRRT

In the `Phantom Auth0` application, enable MRRT for:

- `Auth0 My Account API`
- any API audience you expect to mint tokens for through refresh-token exchange

## 5. Configure Google

Use your own Google OAuth credentials, not Auth0 developer keys.

For the `google-oauth2` social connection:

- enable `Connected Accounts for Token Vault`
- enable the connection for the `Phantom Auth0` app
- keep the connection name aligned with:

```bash
AUTH0_GOOGLE_CONNECTION=google-oauth2
```

## 6. Configure GitHub

GitHub setup uses a GitHub OAuth app and Auth0’s GitHub social connection.

In GitHub:

- create a GitHub app or OAuth app per the Auth0 GitHub integration guide
- set Homepage URL to your Auth0 domain
- set Callback URL to:
  - `https://YOUR_AUTH0_DOMAIN/login/callback`
- select the permissions you need in GitHub itself

In Auth0:

- create or configure the GitHub social connection
- enable `Connected Accounts for Token Vault`
- enable the connection for the `Phantom Auth0` app
- set the connection name in:

```bash
AUTH0_GITHUB_CONNECTION=github
```

Note:

- per Auth0’s GitHub integration doc, Token Vault scope configuration is not used for GitHub the same way as other providers; the effective permissions are defined in the GitHub app configuration.

## 7. Configure Async Approval

High-risk actions in this repo are designed to use Auth0 asynchronous authorization.

Needed:

- CIBA enabled for the app
- approval channel configured
- a user account that can receive the approval challenge

Without this, approval-required actions may stop at the approval request stage.

## 8. Sync Local Env

Set these values in [server/.env](/Users/mac/dev/phantom-auth0/server/.env):

```bash
PUBLIC_BASE_URL=http://localhost:8080
AUTH0_DOMAIN=YOUR_TENANT
AUTH0_CLIENT_ID=YOUR_APP_CLIENT_ID
AUTH0_CLIENT_SECRET=YOUR_APP_CLIENT_SECRET
AUTH0_API_AUDIENCE=https://phantom-auth0-api
AUTH0_MY_ACCOUNT_AUDIENCE=https://YOUR_TENANT/me/
AUTH0_GOOGLE_CONNECTION=google-oauth2
AUTH0_GITHUB_CONNECTION=github
AUTH0_SLACK_CONNECTION=slack-oauth-2
```

Then restart the server.
