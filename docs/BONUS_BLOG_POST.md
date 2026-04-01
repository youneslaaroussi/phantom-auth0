## Bonus Blog Post

When people talk about AI agents, they usually talk about capability first. Can it browse? Can it click? Can it draft an email? Can it file an issue? Those are interesting questions, but they are not the hardest ones. The harder question is what happens the moment an agent leaves its own sandbox and starts acting across a user’s real accounts.

That was the real starting point for Phantom Auth0.

Phantom already existed as a local browser agent. It could stay in the browser, understand page context, respond to voice input, and perform actions in a way that felt close to the user instead of remote. But for the Auth0 for AI Agents hackathon, that was not enough. A useful browser agent without a strong authorization model still has a major weakness: the second it needs Gmail, Calendar, GitHub, or anything else outside the tab, it becomes dangerously easy to fall back to “just give the app a token and hope for the best.”

That is exactly the pattern I wanted to avoid.

Instead of treating Auth0 as just a login button, I wanted Auth0 to become the trust layer of the product. The goal was to keep Phantom local and restricted while moving identity, connected accounts, delegated access, and approval boundaries into a hosted companion app built around Auth0 for AI Agents.

### The shift from agent capability to delegated authority

The most important architectural decision in this project was separating **what the agent can understand locally** from **what the agent is allowed to do externally**.

The extension still does what Phantom was already good at:

- understand what is happening in the browser
- provide the local user experience
- expose the tool system the agent uses
- keep page-aware behavior close to the user

But the extension no longer acts like the place where long-lived provider credentials should live. Instead, the hosted companion app handles:

- Auth0 Universal Login
- account linking through Connected Accounts
- delegated action history
- pairing approval for the local extension
- server-side gateway execution for provider APIs

That separation is what made Token Vault meaningful in practice. The local agent does not need to directly hold Google or GitHub provider tokens. The user signs in through Auth0, links accounts through Connected Accounts, and the server exchanges the Auth0 refresh token through Token Vault when an external action actually needs to run.

That may sound subtle, but it changes the whole trust story. The question stops being “does the agent have the secret?” and becomes “has the user delegated a scoped authority through a system that can show, constrain, and audit it?”

### Why Token Vault mattered technically

I did not want this to be a hackathon project where Token Vault appears in the README but not in the runtime path.

In Phantom Auth0, the Token Vault path is real:

1. the user authenticates through Auth0
2. the user links a Google or GitHub account through Connected Accounts
3. the companion gateway receives the delegated context
4. the gateway exchanges the Auth0 refresh token through Token Vault
5. the provider action executes with delegated access

That design also let me express a much cleaner user-control model. Safe actions such as reads, drafts, and previews can be fast. Risky actions such as sending, posting, or creating can be routed into an approval flow.

This is where the project became much more than “browser automation plus auth.” It became a system for showing where authority comes from, where it lives, and when the user should be brought back into the loop.

### The hardest parts were the useful parts

The implementation details that took the most effort were not annoying edge cases around the main idea. They were the main idea.

Some of the most important hurdles were:

- configuring My Account API access with the right user client grants
- handling refresh token rotation correctly on the server side
- making Connected Accounts callback completion work reliably
- aligning the provider-specific behavior for Google and GitHub
- deciding which actions should be low-risk and which should require step-up approval
- making the delegated state visible in product UI rather than hiding it in backend logs

Those are exactly the kinds of details that separate a credible authorization architecture from a fake one.

I learned quickly that “agent authorization” is not a single feature. It is a chain of small, concrete implementation decisions: what the user sees, what the server stores, what the extension never gets to hold, what is considered safe, and how a risky action becomes explicit rather than silent.

### Approval boundaries changed the product story

One of the most useful patterns in the project is the distinction between low-risk and high-risk actions.

Low-risk actions include things like:

- checking connected account state
- reading calendar availability
- creating a draft instead of sending
- preparing an issue instead of creating it

High-risk actions include things like:

- sending an email
- creating a calendar event
- opening a real GitHub issue
- posting to Slack

Those actions are not just technically different. They feel different to users. Reads and previews can be treated as lightweight delegated tasks. State-changing actions need a stronger boundary. Auth0’s approval-oriented flow made it possible to model that boundary explicitly.

This became one of the clearest product lessons of the build: users do not just need a powerful agent. They need a believable explanation for why an action was allowed to happen.

### What I am most proud of

The part I am most proud of is not any single API call. It is that the project’s trust model now makes sense.

Phantom Auth0 keeps the local browser agent where it is strongest, but it does not pretend that local context alone solves cross-app authorization. Instead, it turns Auth0 into the product surface for identity, delegation, consent, and approval. The companion app is not a sidecar admin screen. It is the visible place where a user can understand the agent’s authority.

That feels like a stronger pattern for AI agents in general:

- keep local behavior local where possible
- move authority into a dedicated trust layer
- treat connected accounts as explicit user delegation
- let risky actions surface an approval boundary
- make action history visible instead of implicit

### What I learned from building this

The biggest lesson from Phantom Auth0 is that the future of agents is not just about better reasoning. It is about better boundaries.

A capable agent without a clear authority model is still brittle. It is hard to explain, hard to trust, and hard to evolve safely. But when the authority model becomes visible, delegated, and scoped, the product becomes easier to understand. The technical work becomes more honest too. You stop hand-waving around “the AI can do this” and start answering the more important question: “under what authority, with whose consent, and with what approval boundary?”

That is what Token Vault unlocked for this project.

It did not just make the integrations cleaner. It made the whole agent architecture more defensible.
