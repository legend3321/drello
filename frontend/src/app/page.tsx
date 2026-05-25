import { Suspense } from "react";
import { Dashboard } from "@/components/Dashboard";

export default function HomePage() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem", color: "#64748b" }}>Loading boards…</p>}>
      <Dashboard />
    </Suspense>
  );
}
