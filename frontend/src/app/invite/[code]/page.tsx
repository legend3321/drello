"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";

import styles from "./page.module.css";

interface InvitationDetails {
  code: string;
  team_id: number;
  team_name: string;
  role_level_id: number;
  role_level_name: string;
  created_by_username: string;
}

export default function InvitationPage() {
  const params = useParams();
  const code = params.code as string;
  const router = useRouter();

  const user = useAuthStore((s) => s.user);
  const authInitialized = useAuthStore((s) => s.initialized);
  const hydrate = useAuthStore((s) => s.hydrate);

  const [invitation, setInvitation] = useState<InvitationDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [joining, setJoining] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Make sure auth state is hydrated from local storage on mount
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!code) return;
    const fetchInvitation = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.getInvitation(code);
        setInvitation(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Invalid or expired invitation link.");
      } finally {
        setLoading(false);
      }
    };
    void fetchInvitation();
  }, [code]);

  const handleAccept = async () => {
    if (!code || joining) return;
    setJoining(true);
    setError(null);
    try {
      await api.acceptInvitation(code);
      setSuccessMsg("Successfully joined the team!");
      setTimeout(() => {
        router.push(`/teams`);
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to join team.");
    } finally {
      setJoining(false);
    }
  };

  if (loading || !authInitialized) {
    return (
      <main className={styles.main}>
        <div className={styles.card}>
          <p className={styles.loadingText}>Loading invitation details…</p>
        </div>
      </main>
    );
  }

  if (error && !invitation) {
    return (
      <main className={styles.main}>
        <div className={styles.card}>
          <h1 className={styles.errorTitle}>Oops!</h1>
          <p className={styles.errorText}>{error}</p>
          <Link href="/" className={styles.homeLink}>
            Go Home
          </Link>
        </div>
      </main>
    );
  }

  if (!invitation) return null;

  return (
    <main className={styles.main}>
      <div className={styles.card}>
        <div className={styles.avatar}>
          {invitation.team_name.charAt(0).toUpperCase()}
        </div>
        
        <h1 className={styles.title}>You've been invited!</h1>
        <p className={styles.subtitle}>
          @{invitation.created_by_username} invited you to join
        </p>
        
        <div className={styles.teamContainer}>
          <h2 className={styles.teamName}>{invitation.team_name}</h2>
          <span className={styles.roleBadge}>
            as {invitation.role_level_name}
          </span>
        </div>

        {error && <p className={styles.errorText}>{error}</p>}
        {successMsg && <p className={styles.successText}>{successMsg}</p>}

        {user ? (
          <button
            onClick={handleAccept}
            disabled={joining || !!successMsg}
            className={styles.acceptBtn}
          >
            {joining ? "Joining…" : "Accept & Join Team"}
          </button>
        ) : (
          <div className={styles.authPrompt}>
            <p className={styles.promptText}>
              Please sign in or create an account to accept this invitation.
            </p>
            <div className={styles.authButtons}>
              <Link
                href={`/login?next=/invite/${code}`}
                className={styles.loginBtn}
              >
                Sign In
              </Link>
              <Link
                href={`/register?next=/invite/${code}`}
                className={styles.registerBtn}
              >
                Create Account
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
