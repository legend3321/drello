import type { Metadata } from "next";

import { AppShell } from "@/components/AppShell";
import { AuthProvider } from "@/components/AuthProvider";

import "./globals.css";

export const metadata: Metadata = {
  title: "Drello",
  description: "Real-time collaborative Kanban board",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>
          <AppShell>
            {children}
          </AppShell>
        </AuthProvider>
      </body>
    </html>
  );
}
