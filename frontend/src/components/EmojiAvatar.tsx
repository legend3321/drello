import React from "react";
import styles from "./EmojiAvatar.module.css";

type Props = {
  emoji: string;
  username: string;
  size?: number;
  className?: string;
};

const GRADIENTS = [
  "linear-gradient(135deg, #6366f1, #a855f7)", // Indigo -> Purple
  "linear-gradient(135deg, #3b82f6, #06b6d4)", // Blue -> Cyan
  "linear-gradient(135deg, #f43f5e, #f97316)", // Rose -> Orange
  "linear-gradient(135deg, #10b981, #14b8a6)", // Emerald -> Teal
  "linear-gradient(135deg, #7c3aed, #db2777)", // Violet -> Pink
  "linear-gradient(135deg, #f59e0b, #e11d48)", // Amber -> Rose
];

function getGradient(username: string): string {
  if (!username) return GRADIENTS[0];
  let hash = 0;
  for (let i = 0; i < username.length; i++) {
    hash = username.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % GRADIENTS.length;
  return GRADIENTS[index];
}

export function EmojiAvatar({ emoji, username, size = 32, className = "" }: Props) {
  const gradient = getGradient(username);

  return (
    <div
      className={`${styles.avatar} ${className}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        background: gradient,
        fontSize: `${size * 0.55}px`,
      }}
      title={`@${username}`}
    >
      <span className={styles.emoji}>{emoji || "😀"}</span>
    </div>
  );
}
