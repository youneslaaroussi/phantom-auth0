# ## Bonus Blog Post

Building Phantom Auth0 forced a sharper question than “can an agent call an API?” The more useful question was “how should an agent be authorized to act in a user’s digital life without turning into an unbounded credential sink?”

The original Phantom project was already strong at local browser interaction. It could see pages, operate in the browser, and stay close to the user. But that alone was not enough for the Auth0 for AI Agents hackathon. To fit the theme, the project needed a real authorization layer for actions outside the browser, not a demo-only secret pasted into an `.env` file.

That is why Token Vault became the center of the architecture. Instead of manually managing third-party tokens, Phantom Auth0 now separates the system into two parts: a restricted local browser agent and a hosted Auth0 companion app. The local extension handles on-device context, voice, and browser-native interaction. The companion app handles Auth0 login, Connected Accounts, and delegated action history. When Phantom needs to act in Google or GitHub, the server exchanges the Auth0 refresh token through Token Vault rather than storing provider credentials directly.

The most valuable technical insight was that authorization details matter more than agent capability claims. We had to solve My Account API access, user client grants, MRRT behavior, refresh token rotation, and Connected Accounts callback handling before the experience became reliable. Those integration edges were exactly the point: they exposed where agent authorization becomes real engineering rather than prompt theater.

The result is a better pattern for agentic products. Keep the agent local where possible. Move cross-app authority into a visible consent and delegation layer. Make safe actions easy, make risky actions explicit, and give the user a place to understand what the agent can actually do.
