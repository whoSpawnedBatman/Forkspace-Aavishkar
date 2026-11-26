import type { AuthUser } from "@/data/auth/domain";

export const DEMO_ACCOUNTS: readonly AuthUser[] = [
  {
    id: "demo-rishi",
    name: "Rishi Jayaram",
    email: "rishi@snipit.dev",
    emailVerified: true,
    provider: "github",
  },
  {
    id: "demo-alex",
    name: "Alex Rivera",
    email: "alex@snipit.dev",
    emailVerified: true,
    provider: "google",
  },
];

export const DEMO_VERIFICATION_CODE = "482910";
