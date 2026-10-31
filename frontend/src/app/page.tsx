"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/authStore";
import { Layout, Plus } from "lucide-react";
import styles from "./page.module.css";

export default function HomePage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [loading, setLoading] = useState(true);
  const [newTitle, setNewTitle] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function checkBoards() {
      try {
        const boards = await api.listBoards();
        if (boards.length > 0 && isMounted) {
          router.replace(`/boards/${boards[0].id}`);
          return;
        }
      } catch (err) {
        console.error("Failed to load initial boards", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    if (user) {
      void checkBoards();
    } else {
      setLoading(false);
    }
    return () => {
      isMounted = false;
    };
  }, [user, router]);

  const handleCreateFirstBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || "My First Board";
    setCreating(true);
    try {
      const board = await api.createBoard(title);
      await api.createList(board.id, "To do");
      await api.createList(board.id, "In progress");
      await api.createList(board.id, "Done");
      router.push(`/boards/${board.id}`);
    } catch (e) {
      console.error("Failed to create first board", e);
    } finally {
      setCreating(false);
    }
  };

  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", color: "var(--text-dim)" }}>
        Loading workspace…
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "80vh", padding: "2rem" }}>
      <div style={{
        maxWidth: "420px",
        width: "100%",
        background: "var(--bg-card)",
        border: "1px solid var(--border-color)",
        borderRadius: "12px",
        padding: "2rem",
        textAlign: "center"
      }}>
        <div style={{
          width: "48px",
          height: "48px",
          borderRadius: "12px",
          background: "rgba(37, 99, 235, 0.1)",
          color: "#3b82f6",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 1.25rem"
        }}>
          <Layout size={24} />
        </div>
        <h2 style={{ fontSize: "1.25rem", fontWeight: "600", marginBottom: "0.5rem", color: "var(--text-main)" }}>
          Welcome to Drello
        </h2>
        <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", marginBottom: "1.5rem", lineHeight: "1.5" }}>
          You don&apos;t have any boards yet. Create your first board to get started or use the sidebar on the left.
        </p>
        <form onSubmit={handleCreateFirstBoard} style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          <input
            type="text"
            placeholder="Board title (e.g. Product Roadmap)"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            style={{
              padding: "0.6rem 0.75rem",
              borderRadius: "6px",
              border: "1px solid var(--border-color)",
              background: "transparent",
              color: "var(--text-main)",
              fontSize: "0.9rem",
              outline: "none"
            }}
          />
          <button
            type="submit"
            disabled={creating}
            style={{
              padding: "0.6rem 1rem",
              borderRadius: "6px",
              border: "none",
              background: "#2563eb",
              color: "#fff",
              fontWeight: "600",
              fontSize: "0.875rem",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "0.5rem"
            }}
          >
            <Plus size={16} />
            {creating ? "Creating..." : "Create Board"}
          </button>
        </form>
      </div>
    </div>
  );
}
