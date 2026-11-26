import { AuthExperience } from "@/features/auth/AuthExperience";

export const metadata = {
  title: "Sign in",
};

export default function SignInPage() {
  return <AuthExperience initialMode="signin" />;
}
