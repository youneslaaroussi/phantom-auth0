# Auth0 New Tenant Setup

This is the full setup path for rebuilding `phantom-auth0` on a brand-new Auth0 tenant.

It covers:

- Auth0 tenant setup
- backend API setup
- login application setup
- Token Vault client setup
- My Account API setup
- Google Cloud OAuth setup
- Linear OAuth setup
- local `.env` wiring
- MRRT patching
- local verification

This guide is written against the current repo state in:

- [server/src/config.ts](/Users/mac/dev/phantom-auth0/server/src/config.ts)
- [server/src/auth0.ts](/Users/mac/dev/phantom-auth0/server/src/auth0.ts)
- [server/src/action-gateway.ts](/Users/mac/dev/phantom-auth0/server/src/action-gateway.ts)
- [server/src/index.ts](/Users/mac/dev/phantom-auth0/server/src/index.ts)

## 1. Create a New Auth0 Tenant

Create a new Auth0 tenant and note the tenant domain.

Example:

```text
phantomapp.us.auth0.com
```

You will use that value for:

- `AUTH0_DOMAIN`
- `AUTH0_MY_ACCOUNT_AUDIENCE`
- Google OAuth redirect URI

## 2. Create the Login App

In Auth0:

- Go to `Applications -> Applications`
- Click `Create Application`
- Choose `Regular Web Application`
- Choose `Express` when Auth0 asks for technology

Use a name like:

```text
Phantom App
```

In the app settings, set:

- Allowed Callback URLs:
  - `http://localhost:8080/auth/callback`
  - `http://localhost:8080/connected-accounts/callback`
  - `https://phantom-auth0-server-pio3n3nsna-uc.a.run.app/auth/callback`
  - `https://phantom-auth0-server-pio3n3nsna-uc.a.run.app/connected-accounts/callback`
- Allowed Logout URLs:
  - `http://localhost:8080/companion`
  - `https://phantom-auth0-server-pio3n3nsna-uc.a.run.app/companion`
- Allowed Web Origins:
  - `http://localhost:8080`
  - `https://phantom-auth0-server-pio3n3nsna-uc.a.run.app`
- Allowed Origins (CORS):
  - `http://localhost:8080`
  - `https://phantom-auth0-server-pio3n3nsna-uc.a.run.app`

In `Advanced Settings -> Grant Types`, enable:

- `Authorization Code`
- `Refresh Token`

Save the app.

Copy and keep:

- Client ID
- Client Secret

These are the values for:

- `AUTH0_CLIENT_ID`
- `AUTH0_CLIENT_SECRET`

## 3. Create the Backend API

In Auth0:

- Go to `Applications -> APIs`
- Click `Create API`

Use:

- Name: `Phantom Auth0 API`
- Identifier: `https://phantom-auth0-api`
- Signing Algorithm: `RS256`

In the API settings:

- Token Sender-Constraining: `Never`
- Allow Skipping User Consent: `On`
- Allow Refresh Tokens for this API: `On`
- User Access policy: `Allow via client-grant`
- Client Access policy: `Allow via client-grant`

Save.

Then open `Application Access` for this API and authorize:

- `Phantom App` for `User Access`

This is required because login requests ask Auth0 for audience:

```text
https://phantom-auth0-api
```

## 4. Create the Token Vault Client

In Auth0:

- Open `Applications -> APIs -> Phantom Auth0 API`
- Click `Add Application`

Create a linked app named something like:

```text
Phantom Auth0 Token Vault Client
```

Auth0 should mark it as a `Custom API Client`.

In that app:

- Application Authentication: `Client Secret (Post)`
- Grant Types: keep `Client Credentials` and `Token Vault` enabled

Copy and keep:

- Client ID
- Client Secret

These are the values for:

- `AUTH0_TOKEN_VAULT_CLIENT_ID`
- `AUTH0_TOKEN_VAULT_CLIENT_SECRET`

## 5. Authorize the Token Vault Client for the Auth0 Management API

This is needed only so you can patch MRRT policy from the Management API.

In Auth0:

- Go to `Applications -> APIs -> Auth0 Management API`
- Open `Application Access`
- Authorize `Phantom Auth0 Token Vault Client` for `Client Access`

Grant:

- `read:clients`
- `update:clients`
- `create:guardian_enrollment_tickets`

## 6. Activate and Configure My Account API

In Auth0:

- Go to `Applications -> APIs -> Auth0 My Account API`
- Activate it if needed
- Open `Application Access`
- Authorize `Phantom App` for `User Access`

Grant these scopes:

- `create:me:connected_accounts`
- `read:me:connected_accounts`
- `delete:me:connected_accounts`

The My Account audience format is:

```text
https://YOUR_TENANT_DOMAIN/me/
```

Example:

```text
https://phantomapp.us.auth0.com/me/
```

## 7. Create Google OAuth Credentials

In Google Cloud:

- Create or select a project
- Configure the OAuth consent screen
- Add your Google account as a test user

Create an OAuth client:

- Type: `Web application`

Set:

- Authorized JavaScript origins: `https://YOUR_AUTH0_DOMAIN`
- Authorized redirect URIs: `https://YOUR_AUTH0_DOMAIN/login/callback`

Example:

- `https://phantomapp.us.auth0.com`
- `https://phantomapp.us.auth0.com/login/callback`

Do not use:

- old Auth0 tenant callback URLs
- `http://localhost:8080/connected-accounts/callback`

That localhost route is handled by your app after Auth0 finishes the social flow. It is not the redirect URI for Google’s OAuth client.

## 8. Enable Google APIs and Scopes

In Google Cloud, enable:

- `Gmail API`
- `Google Calendar API`
- `Google Drive API`
- `Google Sheets API`
- `Google Tasks API`

In `Google Auth Platform -> Data Access`, add:

Required profile scopes:

- `openid`
- `userinfo.email`
- `userinfo.profile`

Product scopes:

- `.../auth/calendar`
- `.../auth/documents`
- `.../auth/drive.metadata.readonly`
- `.../auth/gmail.compose`
- `.../auth/gmail.send`
- `.../auth/spreadsheets`
- `.../auth/tasks`

For testing, your own Google account as a test user is enough. Full public verification can come later.

If Google was already connected before you added Docs / Sheets / Tasks scopes, disconnect it in the companion and reconnect it so Auth0 stores a fresh grant with the updated scopes.

## 9. Configure the Auth0 Google Connection

In Auth0:

- Go to `Authentication -> Social`
- Open `google-oauth2`

Paste the Google OAuth client:

- Client ID
- Client Secret

Set `Purpose` to:

- `Connected Accounts for Token Vault`

Enable only the scopes this repo actually uses:

- `Offline Access`
- `Basic Profile`
- `Extended Profile`
- `Calendar`
- `https://www.googleapis.com/auth/documents`
- `https://www.googleapis.com/auth/drive.metadata.readonly`
- `Gmail.Send`
- `Gmail.Compose`

Then open the connection’s `Applications` tab and enable it for:

- `Phantom App`

## 10. Configure Linear as a Custom OAuth2 Connection

Create a Linear OAuth 2.0 app first:

- [Linear OAuth 2.0 authentication](https://linear.app/developers/oauth-2-0-authentication)
- callback URL: `https://YOUR_AUTH0_DOMAIN/login/callback`

Example:

- `https://phantomapp.us.auth0.com/login/callback`

Then in Auth0:

- Go to `Authentication -> Social`
- Click `Create Connection`
- Choose `Create Custom`

Use:

- Connection name: `linear`
- Authorization URL: `https://linear.app/oauth/authorize`
- Token URL: `https://api.linear.app/oauth/token`
- Scope: `read issues:create`
- `Separate scopes using a space`: `On`
- Purpose: `Connected Accounts for Token Vault`

For the fetch user profile script, use:

```js
function fetchUserProfile(accessToken, context, callback) {
  request.post(
    {
      url: "https://api.linear.app/graphql",
      headers: {
        Authorization: "Bearer " + accessToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: "{ viewer { id name email } }",
      }),
    },
    function (err, resp, body) {
      if (err) return callback(err);
      if (resp.statusCode !== 200) return callback(new Error(body));

      var parsed;
      try {
        parsed = JSON.parse(body);
      } catch (jsonError) {
        return callback(jsonError);
      }

      if (parsed.errors && parsed.errors.length) {
        return callback(new Error(JSON.stringify(parsed.errors)));
      }

      var viewer = parsed.data && parsed.data.viewer;
      if (!viewer || !viewer.id) {
        return callback(new Error("Missing Linear viewer profile"));
      }

      callback(null, {
        user_id: viewer.id,
        email: viewer.email,
        name: viewer.name,
      });
    }
  );
}
```

Then enable the Linear connection for:

- `Phantom App`

## 11. Update `server/.env`

Set your local env in [server/.env](/Users/mac/dev/phantom-auth0/server/.env):

```bash
PORT=8080
PUBLIC_BASE_URL=http://localhost:8080

AUTH0_DOMAIN=phantomapp.us.auth0.com
AUTH0_CLIENT_ID=LOGIN_APP_CLIENT_ID
AUTH0_CLIENT_SECRET=LOGIN_APP_CLIENT_SECRET

AUTH0_TOKEN_VAULT_CLIENT_ID=TOKEN_VAULT_CLIENT_ID
AUTH0_TOKEN_VAULT_CLIENT_SECRET=TOKEN_VAULT_CLIENT_SECRET

AUTH0_API_AUDIENCE=https://phantom-auth0-api
AUTH0_MY_ACCOUNT_AUDIENCE=https://phantomapp.us.auth0.com/me/

AUTH0_GOOGLE_CONNECTION=google-oauth2
AUTH0_GITHUB_CONNECTION=github
AUTH0_LINEAR_CONNECTION=linear
AUTH0_SLACK_CONNECTION=slack-oauth-2
```

Also keep:

```bash
AUTH0_SCOPES=openid profile email offline_access
```

## 12. Patch MRRT Policy

This step is required for this repo because the server exchanges the login refresh token for:

- the My Account API audience
- the backend API audience

First request an Auth0 Management API token:

```bash
curl --request POST 'https://YOUR_AUTH0_DOMAIN/oauth/token' \
  --header 'content-type: application/json' \
  --data '{
    "client_id":"TOKEN_VAULT_CLIENT_ID",
    "client_secret":"TOKEN_VAULT_CLIENT_SECRET",
    "audience":"https://YOUR_AUTH0_DOMAIN/api/v2/",
    "grant_type":"client_credentials"
  }'
```

Then patch the login app:

```bash
curl --request PATCH 'https://YOUR_AUTH0_DOMAIN/api/v2/clients/LOGIN_APP_CLIENT_ID' \
  --header 'authorization: Bearer MANAGEMENT_API_TOKEN' \
  --header 'content-type: application/json' \
  --data '{
    "refresh_token": {
      "rotation_type": "non-rotating",
      "expiration_type": "non-expiring",
      "policies": [
        {
          "audience": "https://YOUR_AUTH0_DOMAIN/me/",
          "scope": [
            "create:me:connected_accounts",
            "read:me:connected_accounts",
            "delete:me:connected_accounts"
          ]
        },
        {
          "audience": "https://phantom-auth0-api",
          "scope": []
        }
      ]
    }
  }'
```

You can verify the patch by fetching the client document and checking that `refresh_token.policies` contains both audiences.

## 13. Start the Repo

Server:

```bash
cd /Users/mac/dev/phantom-auth0/server
npm install
npm run dev
```

Extension:

```bash
cd /Users/mac/dev/phantom-auth0/extension
npm install
npm run dev
```

Load the unpacked extension from:

```text
/Users/mac/dev/phantom-auth0/extension/build/chrome-mv3-dev
```

Open:

- [http://localhost:8080/companion](http://localhost:8080/companion)

## 14. First Login and Pairing

After tenant changes, always use a fresh session:

1. Log out of the companion
2. Close the companion tab
3. Restart the local server
4. Re-open the companion
5. Sign in again

This matters because old refresh tokens issued before MRRT changes may still fail.

Then:

1. Open the extension
2. Start pairing
3. Approve pairing in the companion

## 15. Connect Google and Linear

In the companion:

1. Click `Google`
2. Complete the Auth0-connected Google flow
3. Return to the companion

If connected-account status was previously failing, re-login after MRRT patching before you try again.

For Linear:

1. Click `Linear`
2. Complete the Auth0-connected Linear flow
3. Return to the companion

## 16. Test Prompts

Start with:

- `Check my connected accounts.`
- `Check my Google Calendar availability tomorrow from 2 PM to 4 PM Atlantic time.`
- `List my Google Tasks.`
- `Create a Google Task titled "Phantom follow-up" with notes "Reconnect Google after adding scopes."`
- `List my Google Sheets.`
- `Create a Google Sheet titled "Phantom tracker" with headers "Item", "Status", "Owner".`
- `Append a row to Google Sheet SPREADSHEET_ID with values "Auth0 setup", "done", "Younes".`
- `List my Google Docs.`
- `Create a Google Doc titled "Phantom meeting brief" with content "Agenda\n\n- Demo Auth0\n- Review approvals\n- Capture next steps".`
- `List my Linear teams.`
- `Create a Linear issue for team TEAM_ID titled "Phantom Auth0 follow-up" with description "Capture next steps from the delegated workflow demo."`
- `Draft an email to hello@youneslaaroussi.ca with subject "Phantom Auth0 test" and body "This is a delegated draft created through Auth0."`
- `Show my delegated action history.`

If those pass, try:

- `Send an email to hello@youneslaaroussi.ca with subject "Phantom Auth0 send test" and body "Testing the approval flow."`
- `Create a calendar event tomorrow at 3 PM Atlantic called "Phantom Auth0 test event" for 30 minutes.`

## 17. Common Failure Map

`Client is not authorized to access resource server https://phantom-auth0-api`

- `Phantom App` is not authorized for `User Access` to `Phantom Auth0 API`

`Failed to query connected accounts (401): Invalid Token`

- My Account API client grant missing, or
- MRRT policy missing, or
- you are still using an old refresh token and need to re-login

`requested_token_type is required`

- Token Vault exchange request is malformed

`Rotating refresh token not supported`

- wrong token-exchange path for Token Vault

`This client is not a resource server and cannot exchange access tokens`

- Token Vault exchange is using the login app instead of the Custom API Client

Google does not appear as connected or connect flow fails:

- Auth0 Google connection not enabled for `Phantom App`
- wrong Google OAuth redirect URI
- Google client still points at the old tenant
- required Google APIs or scopes are still missing

Linear does not connect or issue creation fails:

- Linear custom social connection is missing refresh-token support
- Auth0 Linear connection is not enabled for `Phantom App`
- Auth0 custom connection is using the wrong scope separator
- `AUTH0_LINEAR_CONNECTION` does not match the Auth0 connection name

## 18. Security Cleanup

After setup is stable:

- rotate the Auth0 login app secret
- rotate the Token Vault client secret
- rotate the Google OAuth client secret if it was shared during setup
- rotate the Linear OAuth client secret if it was shared during setup

Do not commit real secrets into git.

## 19. Official References

- [Configure Token Vault](https://auth0.com/docs/secure/call-apis-on-users-behalf/token-vault/configure-token-vault)
- [Connected Accounts for Token Vault](https://auth0.com/docs/secure/tokens/token-vault/connected-accounts-for-token-vault)
- [My Account API](https://auth0.com/docs/api/myaccount)
- [Configure and Implement MRRT](https://auth0.com/docs/secure/tokens/refresh-tokens/multi-resource-refresh-token/configure-and-implement-multi-resource-refresh-token)
- [Configure CIBA](https://auth0.com/docs/get-started/applications/configure-client-initiated-backchannel-authentication)
- [Google for Auth0 AI Agents](https://auth0.com/ai/docs/google-sign-in-and-auth)
- [Auth0 Dev Keys Limitations](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/devkeys)
- [Linear OAuth 2.0 authentication](https://linear.app/developers/oauth-2-0-authentication)
