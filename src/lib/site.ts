// Launch and link settings. Values come from env so they can change without a code edit.

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
export const X_URL = "https://x.com/PlayhauntRh";
export const X_HANDLE = "@PlayhauntRh";

// Placeholder until the team confirms the exact launch time and timezone.
export const LAUNCH_AT = process.env.NEXT_PUBLIC_LAUNCH_AT || "2026-10-31T00:00:00Z";

// Left empty until launch. The token section shows them once both are set.
export const TOKEN_ADDRESS = process.env.NEXT_PUBLIC_TOKEN_ADDRESS || "";
export const BUY_URL = process.env.NEXT_PUBLIC_BUY_URL || "";

// The cellar, the second room, opens at launch unless set otherwise.
export const CELLAR_AT = process.env.NEXT_PUBLIC_CELLAR_AT || LAUNCH_AT;

// Chain and explorer for the token section. The explorer link is built as EXPLORER_URL + address.
export const CHAIN_NAME = process.env.NEXT_PUBLIC_CHAIN_NAME || "";
export const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL || "";

// Bot check (Cloudflare Turnstile). Empty turns it off.
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || "";
