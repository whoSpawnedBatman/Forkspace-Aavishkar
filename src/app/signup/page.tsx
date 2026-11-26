import { AuthExperience } from "@/features/auth/AuthExperience";

export const metadata = {
  title: "Create an account",
};

export default function SignUpPage() {
  return <AuthExperience initialMode="signup" />;
}
