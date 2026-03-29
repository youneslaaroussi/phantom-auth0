# Submission Checklist

Use this before pressing submit on Devpost.

## Required

- Project uses `Auth0 for AI Agents Token Vault` as a real part of the runtime.
- Public repo is available at `https://github.com/youneslaaroussi/phantom-auth0`.
- Hosted published link is available for the companion app.
- Text description explains the product clearly.
- Demo video is under 3 minutes.
- Video shows the real product functioning on the intended platform.
- Testing instructions are present in the repo.
- The repo explains what was significantly updated during the submission period.

## Product Readiness

- Auth0 login works.
- extension pairing works.
- Google Connected Account works.
- Google read action works.
- Gmail draft action works.
- action history is visible.
- Auth0 state is visible inside the extension UI.

## High-Value If Ready

- one approval-required action is demonstrated
- GitHub Connected Account works
- GitHub repo listing works
- GitHub issue draft or creation flow works

## Devpost Form Notes

Use the companion app as the published application link.

If you are also describing the extension, explain:

- the extension is the local client experience
- the hosted companion app is the judge-facing published surface for login, connected accounts, approval state, and delegated action history

## Text Description Notes

Make sure the description explicitly says:

- this is a significant update to Phantom made during the hackathon submission period
- Auth0 Token Vault is central to delegated actions
- the agent is local and restricted
- external authority is mediated through Auth0 Connected Accounts and Token Vault

## Bonus Opportunities

- add `## Bonus Blog Post` to the Devpost text description
- submit Auth0 feedback separately for the feedback prize

## Avoid

- claiming Slack support in the main demo if it is not working end-to-end
- overclaiming GitHub if it has not been validated in the tenant
- showing unapproved high-risk actions as if they were automatic
- relying on localhost-only instructions in the final judge path if a hosted companion app is available
