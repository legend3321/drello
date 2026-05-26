"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

import { useAuthStore } from "@/store/authStore";
import { EmojiAvatar } from "@/components/EmojiAvatar";
import styles from "./page.module.css";

const EMOJIS = [
  "😀", "😎", "🚀", "🎨", "👾", "🦄", "🦊", "🍀", "🎸", "🍕",
  "🐼", "🐯", "🐨", "🐙", "🥑", "🍩", "🏄", "🧩", "🎯", "🔮"
];

export default function SettingsPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const updateProfile = useAuthStore((s) => s.updateProfile);
  const initialized = useAuthStore((s) => s.initialized);

  const [email, setEmail] = useState("");
  const [avatarEmoji, setAvatarEmoji] = useState("😀");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialized && !user) {
      router.replace("/login?next=/settings");
    }
  }, [user, initialized, router]);

  useEffect(() => {
    if (user) {
      setEmail(user.email || "");
      setAvatarEmoji(user.avatar_emoji || "😀");
    }
  }, [user]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setSaving(true);

    try {
      await updateProfile({
        email,
        avatar_emoji: avatarEmoji,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update settings");
    } finally {
      setSaving(false);
    }
  };

  if (!user) {
    return (
      <main className={styles.main}>
        <p className={styles.loading}>Loading settings…</p>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <Link href="/" className={styles.backLink}>
          ← Back to Boards
        </Link>
        <h1>User Settings</h1>
        <p className={styles.subtitle}>
          Update your profile email and customize your 3D emoji avatar.
        </p>
      </header>

      <form onSubmit={handleSubmit} className={styles.formCard}>
        {error && <p className={styles.error}>{error}</p>}
        {success && <p className={styles.success}>Settings updated successfully! 🎉</p>}

        <div className={styles.avatarPreviewSection}>
          <div className={styles.avatarLabel}>Avatar Preview</div>
          <EmojiAvatar emoji={avatarEmoji} size={80} username={user.username} />
          <span className={styles.username}>@{user.username}</span>
        </div>

        <label className={styles.label}>
          Email Address
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            placeholder="your-email@example.com"
          />
        </label>

        <div className={styles.label}>
          Choose Avatar Emoji
          <div className={styles.emojiGrid}>
            {EMOJIS.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className={`${styles.emojiBtn} ${avatarEmoji === emoji ? styles.selectedEmoji : ""}`}
                onClick={() => setAvatarEmoji(emoji)}
              >
                {emoji}
              </button>
            ))}
          </div>
        </div>

        <button type="submit" className={styles.saveBtn} disabled={saving}>
          {saving ? "Saving…" : "Save Settings"}
        </button>
      </form>
    </main>
  );
}
