import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Snipbase — Sign in",
  description: "Save and share multi-file snippets",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
