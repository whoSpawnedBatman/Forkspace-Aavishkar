import { getMode } from "@/data/snippets/adapter";
import { AuthAdapterError, type AuthAdapter } from "@/data/auth/domain";

let demoAuthAdapter: Promise<AuthAdapter> | null = null;

export async function getAuthAdapter(): Promise<AuthAdapter> {
  if (getMode() === "live") {
    throw new AuthAdapterError({
      code: "unavailable",
      message:
        "Live authentication is not configured yet. Wait for the project lead’s approved auth contract.",
    });
  }

  if (!demoAuthAdapter) {
    demoAuthAdapter = import("@/data/auth/demo/adapter").then((module) =>
      module.createDemoAuthAdapter(),
    );
  }

  return demoAuthAdapter;
}
