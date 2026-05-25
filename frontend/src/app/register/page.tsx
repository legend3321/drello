import { Suspense } from "react";

import { AuthForm } from "@/components/AuthForm";

export default function RegisterPage() {
  return (
    <Suspense fallback={<p style={{ padding: "2rem" }}>Loading…</p>}>
      <AuthForm mode="register" />
    </Suspense>
  );
}
