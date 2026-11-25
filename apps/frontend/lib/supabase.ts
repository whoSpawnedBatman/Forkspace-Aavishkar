import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) throw new Error("Supabase environment variables are missing.");

const authUrl = key === "local-demo" && typeof window !== "undefined" ? window.location.origin : url;
export const supabase = createClient(authUrl, key);
