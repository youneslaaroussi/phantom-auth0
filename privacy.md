# Phantom Auth0 Privacy Policy

Effective date: April 3, 2026

Phantom Auth0 is a Chrome extension and companion service for browser-based AI assistance with Auth0-backed login, connected accounts, delegated actions, and approval-aware workflows.

This Privacy Policy explains what data Phantom Auth0 may access, how that data is used, when it is shared, and what choices users have.

## Summary

Phantom Auth0 is designed to help a user control the browser and, if the user chooses, connect external services such as Google and Linear through Auth0.

Phantom Auth0 may process:

- active tab content and page structure needed for user-requested browser actions
- microphone audio when the user starts a voice session
- optional screen or visible-tab captures when vision features are enabled
- account and session information needed for Auth0 login and connected-account flows
- delegated action requests and results for connected services such as Google Workspace or Linear
- local settings, preferences, and memory saved by the extension

Phantom Auth0 does not sell personal data and does not use personal data for advertising.

## Data We Access

Depending on which features a user enables, Phantom Auth0 may access the following categories of data:

### 1. Browser and page data

To perform user-requested actions in the browser, Phantom Auth0 may access:

- the current tab URL and title
- open tab metadata
- page text, DOM structure, accessibility tree, and visible interactive elements
- information necessary to click, type, scroll, highlight, or otherwise perform requested browser actions

This access is used only to provide the browser-agent functionality requested by the user.

### 2. Audio data

If the user starts a voice session, Phantom Auth0 may capture microphone audio and send it to the configured AI runtime or relay service in order to transcribe speech, generate responses, and execute requested actions.

### 3. Optional screen / vision data

If the user enables vision or visible-tab understanding features, Phantom Auth0 may capture screenshots or visible-tab frames and send them to the configured AI runtime or relay service so the model can understand what is on screen.

Phantom Auth0 includes privacy-protection logic intended to reduce exposure of certain sensitive values on screen, but users should still assume that content intentionally shared through vision features may be processed by the service providers involved in the request.

### 4. Auth0 identity and connected-account data

If the user signs in or connects external accounts, Phantom Auth0 may process:

- Auth0 account identifiers
- session and authentication state
- connected-account status
- approval and delegated-action state

If the user connects Google or other supported providers, provider access is mediated through Auth0 and the configured connected-account flow.

### 5. Delegated service data

If the user asks Phantom Auth0 to interact with connected services, Phantom Auth0 may process the data required to complete that request. Examples include:

- calendar availability windows
- email draft or send requests
- Google Docs, Sheets, Drive, or Tasks operations
- Linear teams or issue creation requests

Phantom Auth0 accesses this data only to provide the specific user-facing action requested by the user.

### 6. Local storage and preferences

Phantom Auth0 may store certain data locally in the browser, including:

- persona or UI preferences
- selected microphone settings
- local memory/profile data
- trace/debug information
- pairing or session state

This local data is used to provide continuity and product functionality.

## How We Use Data

Phantom Auth0 uses data only to:

- provide the extension’s browser-agent features
- authenticate users and maintain session state
- connect and manage delegated accounts through Auth0
- execute user-requested actions in connected services
- show action history, approval state, and connected-account status
- improve reliability, security, and abuse prevention
- diagnose operational issues

Phantom Auth0 does not use user data for targeted advertising, profiling for ads, or data brokerage.

## Sharing and Third Parties

Phantom Auth0 may share data with third-party service providers only when necessary to provide the requested feature. Depending on configuration, those providers may include:

- Auth0, for login, connected accounts, token exchange, and approval flows
- Google, for AI runtime features or Google Workspace actions the user explicitly requests
- Linear, for Linear actions the user explicitly requests
- cloud hosting or infrastructure providers used to run the companion service

Data is shared only as needed to deliver the user-facing feature, maintain security, or comply with law.

## Permissions Used By The Extension

Phantom Auth0 may request Chrome permissions including:

- `activeTab`: to interact with the current tab after user invocation
- `tabs`: to inspect, open, switch, or close tabs when requested
- `scripting`: to inspect page structure and perform requested browser actions
- `storage`: to save preferences, local memory, and session state
- `sidePanel`: to show the extension user interface
- `tabCapture`: to capture visible-tab or tab audio data for enabled voice/vision features
- `debugger`: to support advanced browser interaction and runtime tooling used by the product
- host permissions on `"<all_urls>"`: so the extension can operate on the pages where the user asks it to act

These permissions are used only to provide user-facing features of the extension.

## Retention

Local extension data remains on the user’s device until it is removed by the extension, overwritten, or cleared by the user.

Hosted session, approval, and delegated-action data may be retained for as long as needed to operate the service, maintain security, provide action history, or troubleshoot issues. Retention may vary depending on deployment environment and service configuration.

## Security

Phantom Auth0 is designed to reduce unnecessary exposure of provider credentials by using Auth0-backed connected-account flows rather than storing raw third-party tokens directly in the extension.

No system is perfectly secure. Users should avoid enabling features they do not need and should use caution when sharing highly sensitive data through microphone, screen, or connected-service workflows.

## User Choices

Users can choose whether to:

- sign in to the companion
- connect external accounts
- start microphone sessions
- enable screen / vision features
- ask the extension to perform delegated actions

Users can also disconnect connected accounts and clear local extension data through normal product or browser controls, depending on the feature.

## Google API Data and Limited Use Disclosure

If Phantom Auth0 accesses information from Google APIs, the use of that information will be limited to providing and improving user-facing features requested by the user.

Phantom Auth0 does not use Google API data for advertising and does not sell Google API data.

Phantom Auth0 is designed so that humans do not routinely read Google API data. Human access may occur only:

- with the user’s explicit consent
- when necessary for security or abuse investigation
- to comply with applicable law

The use of information received from Google APIs will adhere to the [Chrome Web Store User Data Policy, including the Limited Use requirements](https://developer.chrome.com/docs/webstore/program-policies/limited-use).

Google also requires public privacy disclosures for applications using Google user data. See the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy).

## Changes

This Privacy Policy may be updated from time to time. If Phantom Auth0 begins using data in a materially different way, the policy should be updated before that new use is introduced.

## Contact

Project repository:

- <https://github.com/youneslaaroussi/phantom-auth0>

Developer contact:

- hello@youneslaaroussi.ca
