# Judge Guide

This repo is intended to be evaluated as a browser-based AI agent with a hosted Auth0 companion app.

## What To Open

- Companion app: [http://localhost:8080/companion](http://localhost:8080/companion)
- Repo root: [README.md](/Users/mac/dev/phantom-auth0/README.md)
- Auth0 setup: [docs/SETUP_AUTH0.md](/Users/mac/dev/phantom-auth0/docs/SETUP_AUTH0.md)
- Testing steps: [docs/TESTING.md](/Users/mac/dev/phantom-auth0/docs/TESTING.md)

## What This Project Demonstrates

- a restricted local browser agent
- an Auth0-hosted identity and consent surface
- Connected Accounts through Auth0
- delegated actions through Token Vault
- visible state and auditability in product UI
- a separation between safe and high-risk actions

## Fastest Evaluation Path

1. Sign in to the companion app.
2. Confirm a Google account is connected.
3. Load the extension and pair it.
4. Ask Phantom:
   - `Check my connected accounts.`
   - `Check my Google Calendar availability tomorrow from 2 PM to 4 PM Atlantic time.`
   - `Draft an email to hello@youneslaaroussi.ca with subject "Phantom Auth0 test draft" and body "This is a test draft created through Auth0 Token Vault."`
   - `Show my delegated action history.`

## Where Auth0 Is Visible

- companion app sign-in
- connected-account management
- paired extension status
- Auth0 Token Vault strip in the extension UI
- action history in the companion app

## Current Best-Supported Path

Google is the strongest current evaluation path.

GitHub is implemented and designed into the system, but may depend on extra tenant-side setup before it is ready for judging.

Slack is not part of the recommended v1 judging path.

## Important Note

This repo is intentionally isolated from the original Phantom project. It should be judged as the `phantom-auth0` submission only.
