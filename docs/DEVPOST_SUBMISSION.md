# Devpost Submission Draft

## Project Title

Phantom Auth0

## One-Line Summary

A restricted local browser agent that uses Auth0 Token Vault to securely act across Google and GitHub with explicit permission boundaries and approval-aware delegated actions.

## What It Does

Phantom Auth0 keeps the browser agent local and restricted, while moving cross-app authorization into a hosted Auth0 companion app.

The extension can understand browser context locally, then request delegated actions through Auth0 on the user’s behalf. The companion app lets the user:

- sign in with Auth0
- connect external accounts through Connected Accounts
- see which accounts are linked
- review delegated action history
- distinguish safe actions from high-risk actions

Today the strongest supported flow is Google:

- check Google Calendar availability
- create Gmail drafts
- prepare high-risk actions for approval-aware execution

The repo also includes GitHub-oriented actions for:

- listing repositories
- preparing issue drafts
- creating issues behind an approval boundary

## How We Built It

This project is an isolated hackathon build derived from Phantom.

The major hackathon work added:

- a hosted Auth0 companion app
- extension pairing between the local browser agent and the hosted companion
- Auth0 Connected Accounts support
- Token Vault-backed delegated actions
- an action history surface for debugging and judging
- visible Auth0 state inside the extension UI

## Why Auth0 Token Vault Matters Here

The central idea is that the agent does not store or manually manage third-party provider credentials.

Instead:

- the user authenticates through Auth0
- the user links external accounts through Connected Accounts
- the server exchanges the Auth0 refresh token for provider access through Token Vault
- the agent operates within explicit boundaries instead of raw long-lived secrets

That makes the demo fundamentally about authorization architecture, not just a generic AI wrapper.

## Challenges We Ran Into

- My Account API application access required a user client grant
- refresh token rotation required us to persist rotated refresh tokens server-side
- Connected Accounts callbacks required forwarding the full `connect_params` set, not just a ticket
- Google required custom OAuth credentials instead of Auth0 developer keys
- some provider support varies by connection type and tenant configuration

## Accomplishments We’re Proud Of

- turned an existing browser agent into a Token Vault-centered submission
- kept the local agent restricted while moving delegated authorization into a dedicated trust layer
- made Auth0 visible in both the extension UI and the companion app
- implemented a clean Google path that is easy for judges to understand

## What’s Next

- finalize async approval with Auth0 CIBA for the strongest high-risk action demo
- complete GitHub connected-account validation in the current tenant
- harden the hosted deployment path for judge testing

## Testing Instructions

See:

- [README.md](/Users/mac/dev/phantom-auth0/README.md)
- [docs/SETUP_AUTH0.md](/Users/mac/dev/phantom-auth0/docs/SETUP_AUTH0.md)
- [docs/TESTING.md](/Users/mac/dev/phantom-auth0/docs/TESTING.md)
