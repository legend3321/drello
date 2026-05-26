"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { motion, type Variants } from "framer-motion";
import { useSearchParams } from "next/navigation";

import { api } from "@/lib/api";
import type { BoardSummary } from "@/types/board";
import type { TeamSummary } from "@/types/team";

import { InlineEdit } from "./InlineEdit";
import { Trash2, ArrowRight } from "lucide-react";
import styles from "../app/page.module.css";

const containerVariants: Variants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 15 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 300, damping: 24 } },
};

export function Dashboard() {
  const searchParams = useSearchParams();
  const filterTeamId = searchParams.get("team") ? Number(searchParams.get("team")) : null;

  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [boardTeamId, setBoardTeamId] = useState<string>("");

  useEffect(() => {
    if (filterTeamId) {
      setBoardTeamId(String(filterTeamId));
    } else {
      setBoardTeamId("");
    }
  }, [filterTeamId]);

  const loadBoards = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [data, teamList] = await Promise.all([
        api.listBoards(),
        api.listTeams(),
      ]);
      setBoards(data);
      setTeams(teamList);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load boards");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBoards();
  }, [loadBoards]);

  const createBoard = async (event: FormEvent) => {
    event.preventDefault();
    const title = newBoardTitle.trim() || "Untitled board";
    try {
      const teamId = boardTeamId ? Number(boardTeamId) : null;
      const board = await api.createBoard(title, teamId);
      await api.createList(board.id, "To do");
      setNewBoardTitle("");
      await loadBoards();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create board");
    }
  };

  const renameBoard = async (id: number, title: string) => {
    try {
      await api.updateBoard(id, title);
      setBoards((prev) =>
        prev.map((b) => (b.id === id ? { ...b, title } : b)),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to rename board");
    }
  };

  const removeBoard = async (id: number, title: string) => {
    if (!window.confirm(`Delete board "${title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteBoard(id);
      setBoards((prev) => prev.filter((b) => b.id !== id));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete board");
    }
  };

  const activeTeam = teams.find((t) => t.id === filterTeamId);
  const filteredBoards = filterTeamId
    ? boards.filter((b) => b.team_id === filterTeamId)
    : boards;

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <h1>Your boards {activeTeam ? `— ${activeTeam.name}` : ""}</h1>
        <p>
          Create, complete, and manage your tasks using the Drello tasks board.
        </p>

        {filterTeamId ? (
          <p className={styles.hint} style={{ marginTop: "1rem", marginBottom: "1rem", textAlign: "left", padding: 0 }}>
            Showing boards for <strong>{activeTeam?.name || "Team"}</strong>.{" "}
            <Link href="/" style={{ color: "#3b82f6", textDecoration: "underline" }}>
              Show all boards
            </Link>
          </p>
        ) : null}

        <form className={styles.createForm} onSubmit={createBoard}>
          <input
            className={styles.createInput}
            value={newBoardTitle}
            onChange={(e) => setNewBoardTitle(e.target.value)}
            placeholder="New board name…"
          />
          <select
            className={styles.teamSelect}
            value={boardTeamId}
            onChange={(e) => setBoardTeamId(e.target.value)}
            aria-label="Board team"
          >
            <option value="">Personal board</option>
            {teams
              .filter((t) => t.my_role?.can_edit_boards)
              .map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
          </select>
          <button type="submit" className={styles.createBtn}>
            + New board
          </button>
        </form>
      </header>

      {/* Filter Row matching mockup dropdown styling */}
      <div className={styles.filterRow}>
        <select className={styles.filterSelect} defaultValue="sort">
          <option value="sort">Sort by</option>
          <option value="name">Name</option>
          <option value="date">Date</option>
        </select>
        <select className={styles.filterSelect} defaultValue="2-weeks">
          <option value="2-weeks">2 Weeks</option>
          <option value="1-month">1 Month</option>
          <option value="all-time">All Time</option>
        </select>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {loading ? <p className={styles.hint}>Loading boards…</p> : null}

      {!loading && !error && filteredBoards.length === 0 ? (
        <p className={styles.hint}>
          {filterTeamId
            ? "No boards for this team yet. Enter a name above and click New board."
            : "No boards yet. Enter a name above and click New board."}
        </p>
      ) : null}

      {!loading && filteredBoards.length > 0 ? (
        <motion.ul
          variants={containerVariants}
          initial="hidden"
          animate="show"
          className={styles.list}
        >
          {filteredBoards.map((board) => (
            <motion.li
              key={board.id}
              variants={itemVariants}
              className={styles.boardItem}
            >
              <div className={styles.boardMeta}>
                <InlineEdit
                  value={board.title}
                  onSave={(title) => renameBoard(board.id, title)}
                  className={styles.boardName}
                  disabled={!board.permissions?.can_edit}
                />
                {board.team_name ? (
                  <span className={styles.teamBadge}>{board.team_name}</span>
                ) : (
                  <span className={styles.teamBadgePersonal}>Personal</span>
                )}
              </div>
              <div className={styles.boardFooter}>
                <Link href={`/boards/${board.id}`} className={styles.boardLink}>
                  Open <ArrowRight size={14} />
                </Link>
                {board.permissions?.can_delete ? (
                  <button
                    type="button"
                    className={styles.deleteBtn}
                    onClick={() => void removeBoard(board.id, board.title)}
                    aria-label={`Delete ${board.title}`}
                    title="Delete board"
                  >
                    <Trash2 size={14} />
                  </button>
                ) : null}
              </div>
            </motion.li>
          ))}
        </motion.ul>
      ) : null}
    </main>
  );
}
