"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { useAuthStore } from "@/store/authStore";
import { EmojiAvatar } from "./EmojiAvatar";

import styles from "./AppHeader.module.css";


export function AppHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return null;
  }


  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand}>
        Drello
      </Link>
      {user ? (
        <nav className={styles.nav}>
          <Link
            href="/"
            className={pathname === "/" ? styles.navActive : styles.navLink}
          >
            Boards
          </Link>
          <Link
            href="/teams"
            className={
              pathname.startsWith("/teams") ? styles.navActive : styles.navLink
            }
          >
            Teams
          </Link>
        </nav>
      ) : null}
      {user ? (
        <div className={styles.actions}>
          <Link href="/settings" className={styles.settingsLink} title="Settings">
            <EmojiAvatar emoji={user.avatar_emoji || "😀"} username={user.username} size={28} />
            <span className={styles.user}>@{user.username}</span>
          </Link>
          <button type="button" className={styles.logout} onClick={handleLogout}>
            Log out
          </button>
        </div>
      ) : null}

    </header>
  );
}
