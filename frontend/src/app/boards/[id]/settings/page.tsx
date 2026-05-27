"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { Board, BoardMembership, BoardRole } from "@/types/board";
import type { User } from "@/types/auth";
import { EmojiAvatar } from "@/components/EmojiAvatar";
import {
  Settings as CogIcon,
  Save as SaveIcon,
  Trash2 as TrashIcon,
  AlertTriangle as WarningIcon,
  CheckCircle as CheckIcon,
  ArrowLeft,
  Users as UsersIcon,
  UserPlus as UserPlusIcon,
  X as XIcon,
  ChevronDown,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

import styles from "./page.module.css";

const ROLE_OPTIONS: { value: BoardRole; label: string; description: string }[] = [
  { value: "admin", label: "Admin", description: "Can manage members and edit content" },
  { value: "editor", label: "Editor", description: "Can create, edit, and delete cards" },
  { value: "commenter", label: "Commenter", description: "Can view and comment on cards" },
  { value: "viewer", label: "Viewer", description: "Can view the board (read-only)" },
];

const ROLE_COLORS: Record<BoardRole, string> = {
  owner: "#f59e0b",
  admin: "#8b5cf6",
  editor: "#3b82f6",
  commenter: "#10b981",
  viewer: "#64748b",
};

type Props = {
  params: Promise<{ id: string }>;
};

export default function BoardSettingsPage({ params }: Props) {
  const { id } = use(params);
  const boardId = Number(id);
  const router = useRouter();

  const [board, setBoard] = useState<Board | null>(null);
  const [loading, setLoading] = useState(true);
  const [titleDraft, setTitleDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  // Members state
  const [boardMembers, setBoardMembers] = useState<BoardMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [showAddMember, setShowAddMember] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [addRole, setAddRole] = useState<BoardRole>("editor");
  const [memberFeedback, setMemberFeedback] = useState<{ type: "success" | "error"; message: string } | null>(null);

  useEffect(() => {
    if (Number.isNaN(boardId)) return;
    const fetchBoard = async () => {
      setLoading(true);
      try {
        const data = await api.getBoard(boardId);
        setBoard(data);
        setTitleDraft(data.title);
      } catch (e) {
        console.error("Failed to load board", e);
      } finally {
        setLoading(false);
      }
    };
    void fetchBoard();
  }, [boardId]);

  useEffect(() => {
    if (Number.isNaN(boardId)) return;
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const data = await api.getBoardMembers(boardId);
        setBoardMembers(data);
      } catch (e) {
        console.error("Failed to load board members", e);
      } finally {
        setLoadingMembers(false);
      }
    };
    void fetchMembers();
  }, [boardId]);

  // Debounced user search
  useEffect(() => {
    if (searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setSearching(true);
      try {
        const users = await api.searchUsers(searchQuery.trim());
        // Filter out users already on the board
        const existingIds = new Set(boardMembers.map((m) => m.user.id));
        setSearchResults(users.filter((u) => !existingIds.has(u.id)));
      } catch (e) {
        console.error("Search failed", e);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, boardMembers]);

  const handleSaveTitle = async () => {
    if (!board) return;
    const trimmed = titleDraft.trim();
    if (!trimmed || trimmed === board.title) return;

    setSaving(true);
    setFeedback(null);
    try {
      const updated = await api.updateBoard(board.id, trimmed);
      setBoard((prev) => (prev ? { ...prev, title: updated.title } : prev));
      setFeedback({ type: "success", message: "Board name updated successfully." });
    } catch (e) {
      setFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Failed to update board name.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!board) return;
    if (!window.confirm(`Permanently delete "${board.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteBoard(board.id);
      router.push("/");
    } catch (e) {
      setFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Failed to delete board.",
      });
    }
  };

  const handleAddMember = async (userId: number) => {
    if (!board) return;
    setMemberFeedback(null);
    try {
      const newMembership = await api.addBoardMember(board.id, userId, addRole);
      setBoardMembers((prev) => [...prev, newMembership]);
      setSearchQuery("");
      setSearchResults([]);
      setMemberFeedback({ type: "success", message: `Member added as ${addRole}.` });
    } catch (e) {
      setMemberFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Failed to add member.",
      });
    }
  };

  const handleUpdateRole = async (userId: number, newRole: BoardRole) => {
    if (!board) return;
    setMemberFeedback(null);
    try {
      const updated = await api.updateBoardMemberRole(board.id, userId, newRole);
      setBoardMembers((prev) =>
        prev.map((m) => (m.user.id === userId ? updated : m))
      );
      setMemberFeedback({ type: "success", message: "Role updated." });
    } catch (e) {
      setMemberFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Failed to update role.",
      });
    }
  };

  const handleRemoveMember = async (userId: number, username: string) => {
    if (!board) return;
    if (!window.confirm(`Remove @${username} from this board?`)) return;
    setMemberFeedback(null);
    try {
      await api.removeBoardMember(board.id, userId);
      setBoardMembers((prev) => prev.filter((m) => m.user.id !== userId));
      setMemberFeedback({ type: "success", message: `@${username} removed.` });
    } catch (e) {
      setMemberFeedback({
        type: "error",
        message: e instanceof Error ? e.message : "Failed to remove member.",
      });
    }
  };

  if (Number.isNaN(boardId)) {
    return <p className={styles.loadingState}>Invalid board id.</p>;
  }

  if (loading) {
    return <p className={styles.loadingState}>Loading board settings…</p>;
  }

  if (!board) {
    return (
      <div className={styles.permissionsGuard}>
        <p>Board not found or you don&apos;t have access.</p>
        <button type="button" className={styles.backBtn} onClick={() => router.push("/")}>
          <ArrowLeft size={14} /> Back to Boards
        </button>
      </div>
    );
  }

  const canEdit = board.permissions?.can_edit ?? false;
  const canDelete = board.permissions?.can_delete ?? false;
  const canManageMembers = board.permissions?.can_manage_members ?? false;
  const myRole = board.permissions?.my_role;

  return (
    <main className={styles.main}>
      <nav className={styles.nav}>
        <Link href={`/boards/${board.id}`}>
          <ArrowLeft size={14} /> Back to Board
        </Link>
      </nav>

      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
      >
        <h1 className={styles.pageTitle}>
          <CogIcon size={24} style={{ verticalAlign: "middle", marginRight: "0.4rem" }} />
          Board Settings
        </h1>
        <p className={styles.pageSub}>
          Manage your board configuration, members, roles, and more.
          {myRole && (
            <span className={styles.myRoleBadge} style={{ background: `${ROLE_COLORS[myRole]}20`, color: ROLE_COLORS[myRole] }}>
              Your role: {myRole.charAt(0).toUpperCase() + myRole.slice(1)}
            </span>
          )}
        </p>

        {/* Section: General Information */}
        <motion.div
          className={styles.section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>General Information</h2>
          <p className={styles.sectionDescription}>
            View board metadata and basic information.
          </p>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Board ID</span>
              <span className={styles.infoValue}>#{board.id}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Team</span>
              <span className={styles.infoValue}>{board.team_name || "Personal Board"}</span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Created</span>
              <span className={styles.infoValue}>
                {new Date(board.created_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Last Updated</span>
              <span className={styles.infoValue}>
                {new Date(board.updated_at).toLocaleDateString("en-US", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Owner</span>
              <span className={styles.infoValue}>
                {board.owner_avatar_emoji || "👤"} @{board.owner_username || "unknown"}
              </span>
            </div>
            <div className={styles.infoItem}>
              <span className={styles.infoLabel}>Columns</span>
              <span className={styles.infoValue}>{board.lists.length}</span>
            </div>
          </div>
        </motion.div>

        {/* Section: Members & Roles */}
        <motion.div
          className={styles.section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>
            <UsersIcon size={16} /> Members &amp; Roles
          </h2>
          <p className={styles.sectionDescription}>
            {canManageMembers
              ? "Manage board members and assign specific roles to control their access level."
              : "View current board members and their roles."}
          </p>

          {/* Add Member */}
          {canManageMembers && (
            <div className={styles.addMemberSection}>
              {!showAddMember ? (
                <button
                  type="button"
                  className={styles.addMemberBtn}
                  onClick={() => setShowAddMember(true)}
                >
                  <UserPlusIcon size={14} /> Add Member
                </button>
              ) : (
                <div className={styles.addMemberForm}>
                  <div className={styles.addMemberRow}>
                    <div className={styles.searchInputWrapper}>
                      <input
                        type="text"
                        className={styles.fieldInput}
                        placeholder="Search by username…"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        autoFocus
                      />
                      {searching && <span className={styles.searchingHint}>Searching…</span>}
                    </div>
                    <div className={styles.roleSelectWrapper}>
                      <select
                        className={styles.roleSelect}
                        value={addRole}
                        onChange={(e) => setAddRole(e.target.value as BoardRole)}
                      >
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r.value} value={r.value}>
                            {r.label}
                          </option>
                        ))}
                      </select>
                      <ChevronDown size={12} className={styles.selectChevron} />
                    </div>
                    <button
                      type="button"
                      className={styles.cancelBtn}
                      onClick={() => {
                        setShowAddMember(false);
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                    >
                      Cancel
                    </button>
                  </div>

                  {/* Search results dropdown */}
                  <AnimatePresence>
                    {searchResults.length > 0 && (
                      <motion.div
                        className={styles.searchResultsDropdown}
                        initial={{ opacity: 0, y: -4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -4 }}
                      >
                        {searchResults.map((user) => (
                          <button
                            key={user.id}
                            type="button"
                            className={styles.searchResultItem}
                            onClick={() => void handleAddMember(user.id)}
                          >
                            <EmojiAvatar emoji={user.avatar_emoji || "😀"} username={user.username} size={28} />
                            <div className={styles.searchResultInfo}>
                              <span className={styles.searchResultName}>@{user.username}</span>
                              <span className={styles.searchResultEmail}>{user.email}</span>
                            </div>
                            <span className={styles.addHint}>+ Add as {addRole}</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </div>
          )}

          {/* Members Feedback */}
          <AnimatePresence>
            {memberFeedback && (
              <motion.div
                className={memberFeedback.type === "success" ? styles.successMessage : styles.errorMessage}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {memberFeedback.type === "success" ? <CheckIcon size={14} /> : <WarningIcon size={14} />}
                {memberFeedback.message}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Members Table */}
          {loadingMembers ? (
            <p className={styles.loadingState}>Loading members…</p>
          ) : boardMembers.length === 0 ? (
            <p className={styles.sectionDescription}>No explicit board members yet.</p>
          ) : (
            <div className={styles.membersTable}>
              {boardMembers.map((m) => (
                <div key={m.id} className={styles.memberRow}>
                  <div className={styles.memberRowLeft}>
                    <EmojiAvatar emoji={m.user.avatar_emoji || "😀"} username={m.user.username} size={36} />
                    <div className={styles.memberRowInfo}>
                      <span className={styles.memberRowName}>@{m.user.username}</span>
                      <span className={styles.memberRowEmail}>{m.user.email}</span>
                    </div>
                  </div>
                  <div className={styles.memberRowRight}>
                    {m.role === "owner" ? (
                      <span
                        className={styles.rolePill}
                        style={{ background: `${ROLE_COLORS.owner}20`, color: ROLE_COLORS.owner }}
                      >
                        Owner
                      </span>
                    ) : canManageMembers ? (
                      <div className={styles.roleSelectWrapper}>
                        <select
                          className={styles.roleSelect}
                          value={m.role}
                          onChange={(e) => void handleUpdateRole(m.user.id, e.target.value as BoardRole)}
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>
                              {r.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown size={12} className={styles.selectChevron} />
                      </div>
                    ) : (
                      <span
                        className={styles.rolePill}
                        style={{ background: `${ROLE_COLORS[m.role]}20`, color: ROLE_COLORS[m.role] }}
                      >
                        {m.role.charAt(0).toUpperCase() + m.role.slice(1)}
                      </span>
                    )}
                    {canManageMembers && m.role !== "owner" && (
                      <button
                        type="button"
                        className={styles.removeMemberBtn}
                        onClick={() => void handleRemoveMember(m.user.id, m.user.username)}
                        title="Remove member"
                      >
                        <XIcon size={14} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* Section: Rename Board */}
        <motion.div
          className={styles.section}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3 }}
        >
          <h2 className={styles.sectionTitle}>
            <SaveIcon size={16} /> Rename Board
          </h2>
          <p className={styles.sectionDescription}>
            {canEdit
              ? "Change the display name of your board. This will be visible to all team members."
              : "You don't have permission to rename this board."}
          </p>

          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel} htmlFor="board-name-input">
              Board Name
            </label>
            <input
              id="board-name-input"
              type="text"
              className={styles.fieldInput}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              disabled={!canEdit || saving}
              placeholder="Enter board name"
              maxLength={120}
            />
            <span className={styles.fieldHint}>
              {titleDraft.length}/120 characters
            </span>
          </div>

          {canEdit && (
            <div className={styles.actionsRow}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => setTitleDraft(board.title)}
                disabled={titleDraft === board.title}
              >
                Reset
              </button>
              <button
                type="button"
                className={styles.saveBtn}
                onClick={() => void handleSaveTitle()}
                disabled={saving || !titleDraft.trim() || titleDraft.trim() === board.title}
              >
                <SaveIcon size={14} />
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}

          {feedback && (
            <div className={feedback.type === "success" ? styles.successMessage : styles.errorMessage}>
              {feedback.type === "success" ? <CheckIcon size={14} /> : <WarningIcon size={14} />}
              {feedback.message}
            </div>
          )}
        </motion.div>

        {/* Section: Danger Zone */}
        {canDelete && (
          <motion.div
            className={styles.dangerSection}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.3 }}
          >
            <h2 className={styles.dangerTitle}>
              <WarningIcon size={16} /> Danger Zone
            </h2>
            <p className={styles.dangerDescription}>
              Deleting this board is permanent and cannot be undone. All cards, lists, comments,
              and activity history will be permanently removed.
            </p>
            <button type="button" className={styles.deleteBtn} onClick={() => void handleDelete()}>
              <TrashIcon size={14} /> Delete This Board
            </button>
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}
