import type { AuthFieldIssue, StartEmailAuthInput } from "@/data/auth/domain";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CODE_PATTERN = /^\d{6}$/;

export function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

export function validateStartEmailAuth(input: StartEmailAuthInput): {
  value?: { mode: "signin" | "signup"; email: string; name?: string };
  issues: AuthFieldIssue[];
} {
  const issues: AuthFieldIssue[] = [];
  const email = normalizeEmail(input.email);
  const name = input.name?.trim();

  if (input.mode === "signup" && !name) {
    issues.push({ field: "name", message: "Enter your name." });
  }

  if (!email) {
    issues.push({ field: "email", message: "Enter your email address." });
  } else if (!EMAIL_PATTERN.test(email)) {
    issues.push({ field: "email", message: "Enter a valid email address." });
  }

  if (issues.length > 0) return { issues };
  return {
    value: {
      mode: input.mode,
      email,
      ...(name ? { name } : {}),
    },
    issues: [],
  };
}

export function validateVerificationCode(raw: string): {
  value?: string;
  issues: AuthFieldIssue[];
} {
  const code = raw.replace(/\s+/g, "");
  if (!CODE_PATTERN.test(code)) {
    return {
      issues: [{ field: "code", message: "Enter the 6-digit verification code." }],
    };
  }
  return { value: code, issues: [] };
}
