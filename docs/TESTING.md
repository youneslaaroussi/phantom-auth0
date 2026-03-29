# Testing Guide

This file is the fastest way to validate the project before recording the demo or submitting to Devpost.

## Preconditions

Before testing, confirm:

- server is running on `http://localhost:8080`
- extension is reloaded in Chrome
- `Phantom Auth0` app login works
- Google is configured as a Connected Account provider
- GitHub is configured if you want the GitHub path

## Server And Extension Startup

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

Then reload the unpacked extension in `chrome://extensions`.

## Companion Validation

Open:

- [http://localhost:8080/companion](http://localhost:8080/companion)

Expected:

- sign in works
- Google shows as connected if already linked
- action history loads

## Pairing Validation

In the extension:

1. open settings
2. click `Pair Extension`
3. approve pairing in the companion app

Expected:

- settings page shows `Pairing: paired`
- main voice screen shows the Auth0 Token Vault strip

## Google Validation

Expected working path:

1. `Check my connected accounts.`
2. `Check my Google Calendar availability tomorrow from 2 PM to 4 PM Atlantic time.`
3. `Draft an email to hello@youneslaaroussi.ca with subject "Phantom Auth0 test draft" and body "This is a test draft created through Auth0 Token Vault."`
4. `Show my delegated action history.`

Expected results:

- connected accounts shows a Google connection
- calendar availability returns data instead of auth errors
- Gmail draft succeeds
- action history contains the delegated actions

## GitHub Validation

Only run this after the GitHub Connected Account is set up in Auth0.

Prompts:

1. `List my GitHub repositories.`
2. `Prepare a GitHub issue for youneslaaroussi/phantom-auth0 titled "Auth0 Token Vault test" with body "Testing GitHub issue creation through Phantom Auth0."`
3. `Show my delegated action history.`

Expected results:

- repository list returns recent repos
- issue draft preparation succeeds

## Approval-Required Actions

These actions are designed to require Auth0 approval:

- `sendEmail`
- `createCalendarEvent`
- `createGitHubIssue`

If CIBA is configured correctly, expected behavior is:

1. Phantom creates a pending approval request
2. companion app or configured Auth0 approval channel receives the request
3. approving the request allows execution
4. action history shows the completed action

If CIBA is not configured, expected behavior may stop at:

- approval request created, but no completion path yet

That is acceptable during implementation, but not ideal for the final demo.

## Recommended Final Demo Test

Run this exact sequence before recording:

1. login to companion
2. confirm Google connected
3. pair extension
4. ask Phantom to check calendar availability
5. ask Phantom to draft an email
6. show delegated action history
7. if approval is ready, trigger one high-risk action

## Common Failure Points

- `Authentication required`
  - extension is not paired
- `Unknown or invalid refresh token`
  - old session before refresh-token rotation fix; log out and sign in again
- `Client is not authorized to access resource server ... /me/`
  - missing My Account API client grant
- `Invalid redirect_uri`
  - callback URL missing from the Auth0 app
- `The specified connection does not support connected accounts`
  - provider connection is not enabled for Connected Accounts for Token Vault

## Build Checks

Run both before submission:

```bash
cd /Users/mac/dev/phantom-auth0/server
npm run build
```

```bash
cd /Users/mac/dev/phantom-auth0/extension
npm run build
```
