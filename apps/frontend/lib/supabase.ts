import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

const isLocalDemo = key === "local-demo";

// Local demo: GoTrue runs behind the Next.js rewrite at /auth/v1/*.
// Cloud: use the real Supabase project URL.
const projectUrl = isLocalDemo && typeof window !== "undefined" ? window.location.origin : url;

export const supabase = url && key
  ? createClient(projectUrl, key)
  : createClient("http://localhost", "placeholder");
