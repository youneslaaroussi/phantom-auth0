workspace "Phantom Auth0" "Compact architecture diagram for Phantom Auth0" {
    model {
        user = person "User" "Starts conversations, pairs the extension, and approves high-risk actions." {
            tags "Actor"
        }

        extension = softwareSystem "Chrome extension" "Local browser agent that owns voice UX, page context, browser tools, and the paired session." {
            tags "Local"
        }

        server = softwareSystem "Hosted companion" "Public control plane that serves the companion UI, delegated action gateway, and realtime relay." {
            tags "Hosted"

            companion = container "Companion UI" "Hono" "Hosted surface for sign-in, pairing, provider state, and approval visibility." {
                tags "Surface"
            }

            gateway = container "Delegated gateway" "Hono" "Connected accounts, Token Vault exchange, action history, and approval-aware execution." {
                tags "Core"
            }

            relay = container "Realtime relay" "WebSocket relay" "Streams audio and tool traffic to Gemini Live without exposing provider secrets in the extension." {
                tags "Realtime"
            }
        }

        auth0 = softwareSystem "Auth0" "Authority layer for identity, connected accounts, Token Vault, and CIBA approval." {
            tags "Authority"
        }

        providers = softwareSystem "Delegated providers" "Google, GitHub, Linear, and Slack APIs reached only after Auth0 delegation." {
            tags "External"
        }

        genai = softwareSystem "Google GenAI" "Gemini Live and helper models used by the local agent." {
            tags "AI"
        }

        user -> extension "Uses the local agent" "Voice + browser control"
        user -> companion "Uses the hosted control surface" "Pairing + status"

        extension -> gateway "Delegated tools + paired requests" "HTTP" "Flow"
        extension -> relay "Audio stream + tool responses" "WebSocket" "Flow"
        extension -> companion "Open companion during setup" "Browser tab" "Secondary"

        companion -> auth0 "Login, session state, Guardian readiness" "OIDC / Management API" "AuthorityFlow"
        companion -> gateway "Pair approval, account status, action history" "HTTP" "Flow"

        gateway -> auth0 "Connected Accounts, Token Vault, CIBA approval" "My Account API + Token Vault + CIBA" "AuthorityFlow"
        gateway -> providers "Read, draft, and approved write actions" "Provider APIs" "Execution"

        relay -> genai "Realtime voice session" "Gemini Live" "RealtimeFlow"
    }

    views {
        container server "server" "Phantom Auth0 runtime" {
            include user
            include extension
            include companion
            include gateway
            include relay
            include auth0
            include providers
            include genai
            autoLayout lr
        }

        styles {
            element "Element" {
                background #111827
                color #F8FAFC
                stroke #334155
                strokeWidth 2
                border solid
                shape roundedbox
                fontSize 22
            }

            element "Actor" {
                shape person
                background #020617
                color #F8FAFC
                stroke #94A3B8
            }

            element "Local" {
                background #0F172A
                color #E0F2FE
                stroke #38BDF8
            }

            element "Hosted" {
                background #030712
                color #E5E7EB
                stroke #475569
            }

            element "Surface" {
                background #172554
                color #DBEAFE
                stroke #60A5FA
            }

            element "Core" {
                background #052E2B
                color #D1FAE5
                stroke #34D399
            }

            element "Realtime" {
                background #2E1065
                color #F3E8FF
                stroke #A78BFA
            }

            element "Authority" {
                background #3B2F0B
                color #FEF3C7
                stroke #F59E0B
            }

            element "External" {
                background #3F1D2E
                color #FCE7F3
                stroke #F472B6
            }

            element "AI" {
                background #312E81
                color #E0E7FF
                stroke #818CF8
            }

            relationship "Relationship" {
                color #94A3B8
                thickness 3
                routing orthogonal
                fontSize 18
                width 240
            }

            relationship "Flow" {
                color #38BDF8
                thickness 4
            }

            relationship "AuthorityFlow" {
                color #F59E0B
                thickness 4
            }

            relationship "Execution" {
                color #34D399
                thickness 4
            }

            relationship "RealtimeFlow" {
                color #A78BFA
                thickness 4
            }

            relationship "Secondary" {
                color #64748B
                thickness 2
                dashed true
            }
        }
    }
}
