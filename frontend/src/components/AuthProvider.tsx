"use client";

import { useEffect } from "react";

import { useAuthStore } from "@/store/authStore";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const hydrate = useAuthStore((s) => s.hydrate);
  const initialized = useAuthStore((s) => s.initialized);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  if (!initialized) {
    return (
      <main style={{ padding: "2rem", textAlign: "center", color: "#94a3b8" }}>
        Loading…
      </main>
    );
  }

  return <>{children}</>;
}
