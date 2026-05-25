"use client";

import { KeyboardEvent, useEffect, useRef, useState } from "react";

import styles from "./InlineEdit.module.css";

type Props = {
  value: string;
  onSave: (value: string) => void | Promise<void>;
  placeholder?: string;
  className?: string;
  as?: "heading" | "text";
  disabled?: boolean;
};

export function InlineEdit({
  value,
  onSave,
  placeholder = "Untitled",
  className = "",
  as = "text",
  disabled = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = async () => {
    const trimmed = draft.trim();
    if (!trimmed || trimmed === value) {
      setDraft(value);
      setEditing(false);
      return;
    }
    setSaving(true);
    try {
      await onSave(trimmed);
      setEditing(false);
    } catch {
      setDraft(value);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") void commit();
    if (event.key === "Escape") {
      setDraft(value);
      setEditing(false);
    }
  };

  if (disabled) {
    const Tag = as === "heading" ? "h2" : "span";
    return (
      <Tag className={`${styles.display} ${className} ${styles.disabled}`}>
        {value || placeholder}
      </Tag>
    );
  }

  if (editing) {
    return (
      <input
        ref={inputRef}
        className={`${styles.input} ${className}`}
        value={draft}
        disabled={saving}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => void commit()}
        onKeyDown={onKeyDown}
      />
    );
  }

  const Tag = as === "heading" ? "h2" : "span";

  return (
    <Tag
      role="button"
      tabIndex={0}
      className={`${styles.display} ${className}`}
      onClick={() => setEditing(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
    >
      {value || placeholder}
    </Tag>
  );
}
