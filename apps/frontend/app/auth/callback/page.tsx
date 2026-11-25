"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../../lib/supabase";
import { withSharedSnippet } from "../../../lib/shared-snippet";

export default function AuthCallbackPage() {
  const [message, setMessage] = useState("Finishing sign in…");

  useEffect(() => {
    async function finish() {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
      } else {
        await new Promise((resolve) => setTimeout(resolve, 250));
        const { data } = await supabase.auth.getSession();
        if (!data.session) {
          setMessage("This confirmation link is invalid or has expired.");
          return;
        }
      }
      window.location.replace(withSharedSnippet("/app"));
    }
    finish();
  }, []);

  return <main className="callback-page"><p>{message}</p></main>;
}
