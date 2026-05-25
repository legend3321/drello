"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";

import { api } from "@/lib/api";
import { connectBoardSocket, type BoardSocketConnection } from "@/lib/websocket";
import { useBoardStore } from "@/store/boardStore";
import type { BoardChatMessage } from "@/types/board";
import type { TeamMembership } from "@/types/team";

import { InlineEdit } from "./InlineEdit";
import { KanbanBoard } from "./KanbanBoard";
import { ToastStack } from "./ToastStack";
import { HistoryModal } from "./HistoryModal";
import styles from "./BoardWorkspace.module.css";

type Props = {
  boardId: number;
};

export function BoardWorkspace({ boardId }: Props) {
  const router = useRouter();
  const board = useBoardStore((s) => s.board);
  const loading = useBoardStore((s) => s.loading);
  const connected = useBoardStore((s) => s.connected);

  const [showHistory, setShowHistory] = useState(false);
  const [members, setMembers] = useState<TeamMembership[]>([]);
  const [loadingMembers, setLoadingMembers] = useState(false);
  
  const [showMembersSidebar, setShowMembersSidebar] = useState(true);
  const [showChatSidebar, setShowChatSidebar] = useState(true);

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [chatMessages, setChatMessages] = useState<BoardChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [loadingChat, setLoadingChat] = useState(false);

  const socketRef = useRef<BoardSocketConnection | null>(null);

  const loadBoard = useBoardStore((s) => s.loadBoard);
  const setConnected = useBoardStore((s) => s.setConnected);
  const updateBoardTitle = useBoardStore((s) => s.updateBoardTitle);
  const applyRemoteBoardUpdate = useBoardStore((s) => s.applyRemoteBoardUpdate);
  const applyRemoteList = useBoardStore((s) => s.applyRemoteList);
  const removeRemoteList = useBoardStore((s) => s.removeRemoteList);
  const applyRemoteCard = useBoardStore((s) => s.applyRemoteCard);
  const removeRemoteCard = useBoardStore((s) => s.removeRemoteCard);
  const addToast = useBoardStore((s) => s.addToast);

  useEffect(() => {
    void loadBoard(boardId);
  }, [boardId, loadBoard]);

  useEffect(() => {
    const conn = connectBoardSocket(
      boardId,
      (event) => {
        window.dispatchEvent(new CustomEvent("drello_board_event", { detail: event }));
        switch (event.type) {
          case "board_updated":
            applyRemoteBoardUpdate(event.payload);
            break;
          case "list_created":
          case "list_updated":
            applyRemoteList(event.payload);
            break;
          case "list_deleted":
            removeRemoteList(event.payload.id);
            break;
          case "card_created":
          case "card_updated":
          case "card_moved":
            applyRemoteCard(event.payload);
            break;
          case "card_deleted":
            removeRemoteCard(event.payload.id);
            break;
          case "presence_updated":
            setOnlineUsers(event.payload.online_users);
            break;
          case "chat_message_created":
            setChatMessages((prev) => [...prev, event.payload]);
            break;
          default:
            break;
        }
      },
      setConnected,
    );

    socketRef.current = conn;

    return () => {
      conn.disconnect();
      socketRef.current = null;
    };
  }, [
    boardId,
    applyRemoteBoardUpdate,
    applyRemoteList,
    removeRemoteList,
    applyRemoteCard,
    removeRemoteCard,
    setConnected,
  ]);

  useEffect(() => {
    if (!board) return;
    if (board.team_id == null) {
      setMembers([]);
      return;
    }
    const fetchMembers = async () => {
      setLoadingMembers(true);
      try {
        const data = await api.getTeamMembers(board.team_id!);
        setMembers(data);
      } catch (e) {
        console.error("Failed to fetch board team members", e);
      } finally {
        setLoadingMembers(false);
      }
    };
    void fetchMembers();
  }, [board?.team_id]);

  useEffect(() => {
    const fetchChatHistory = async () => {
      setLoadingChat(true);
      try {
        const history = await api.getBoardChatHistory(boardId);
        setChatMessages(history);
      } catch (e) {
        console.error("Failed to load chat history", e);
      } finally {
        setLoadingChat(false);
      }
    };
    void fetchChatHistory();
  }, [boardId]);

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    const text = chatInput.trim();
    if (!text || !socketRef.current) return;

    socketRef.current.sendJson({
      type: "chat_message",
      text,
    });
    setChatInput("");
  };

  const deleteBoard = async () => {
    if (!board) return;
    if (!window.confirm(`Delete board "${board.title}"? This cannot be undone.`)) {
      return;
    }
    try {
      await api.deleteBoard(board.id);
      router.push("/");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to delete board", "error");
    }
  };

  if (loading && !board) {
    return <p className={styles.status}>Loading board…</p>;
  }

  if (!board) {
    return <p className={styles.status}>Board not found.</p>;
  }

  return (
    <div className={styles.workspaceLayout}>
      {/* Left Sidebar - Board Members */}
      {showMembersSidebar && (
        <aside className={styles.leftSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Board Members</h3>
            <button
              type="button"
              className={styles.closeSidebarBtn}
              onClick={() => setShowMembersSidebar(false)}
              title="Close sidebar"
            >
              ×
            </button>
          </div>
          
          <div className={styles.sidebarContent}>
            {board.team_id ? (
              <>
                <p className={styles.sidebarSub}>
                  Team: <strong>{board.team_name}</strong>
                </p>
                {loadingMembers ? (
                  <p className={styles.sidebarLoading}>Loading members…</p>
                ) : (
                  <ul className={styles.memberList}>
                    {members.map((m) => {
                      const isOnline = onlineUsers.includes(m.user.username);
                      return (
                        <li key={m.id} className={styles.memberItem}>
                          <span
                            className={`${styles.statusIndicator} ${
                              isOnline ? styles.onlineIndicator : styles.offlineIndicator
                            }`}
                            title={isOnline ? "Online" : "Offline"}
                          />
                          <div className={styles.memberAvatar}>
                            {m.user.username.charAt(0).toUpperCase()}
                          </div>
                          <div className={styles.memberInfo}>
                            <span className={styles.memberUsername}>@{m.user.username}</span>
                            <span className={styles.memberRoleBadge}>{m.role_level.name}</span>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </>
            ) : (
              <>
                <p className={styles.sidebarSub}>Personal Board</p>
                <ul className={styles.memberList}>
                  {(() => {
                    const isOnline = board.owner_username ? onlineUsers.includes(board.owner_username) : false;
                    return (
                      <li className={styles.memberItem}>
                        <span
                          className={`${styles.statusIndicator} ${
                            isOnline ? styles.onlineIndicator : styles.offlineIndicator
                          }`}
                          title={isOnline ? "Online" : "Offline"}
                        />
                        <div className={styles.memberAvatar}>
                          {board.owner_username?.charAt(0).toUpperCase() || "O"}
                        </div>
                        <div className={styles.memberInfo}>
                          <span className={styles.memberUsername}>@{board.owner_username || "owner"}</span>
                          <span className={styles.memberRoleBadge}>Owner</span>
                        </div>
                      </li>
                    );
                  })()}
                </ul>
              </>
            )}
          </div>
        </aside>
      )}

      {/* Middle - Board Workspace Content */}
      <div className={styles.boardContent}>
        <header className={styles.header}>
          <div className={styles.titleRow}>
            <InlineEdit
              as="heading"
              value={board.title}
              onSave={updateBoardTitle}
              className={styles.boardTitle}
              disabled={!board.permissions?.can_edit}
            />
            <div className={styles.headerActions}>
              {!showMembersSidebar && (
                <button
                  type="button"
                  className={styles.membersToggleBtn}
                  onClick={() => setShowMembersSidebar(true)}
                >
                  👥 Members
                </button>
              )}
              {!showChatSidebar && (
                <button
                  type="button"
                  className={styles.chatToggleBtn}
                  onClick={() => setShowChatSidebar(true)}
                >
                  💬 Chat
                </button>
              )}
              <button type="button" className={styles.historyBtn} onClick={() => setShowHistory(true)}>
                History
              </button>
              {board.permissions?.can_delete ? (
                <button type="button" className={styles.deleteBoard} onClick={() => void deleteBoard()}>
                  Delete board
                </button>
              ) : null}
            </div>
          </div>
          <p className={styles.meta}>
            {board.lists.length} column{board.lists.length === 1 ? "" : "s"} ·{" "}
            <span className={connected ? styles.live : styles.offline}>
              {connected ? "Live" : "Reconnecting…"}
            </span>
          </p>
        </header>
        <KanbanBoard />
      </div>

      {/* Right Sidebar - Chat */}
      {showChatSidebar && (
        <aside className={styles.rightSidebar}>
          <div className={styles.sidebarHeader}>
            <h3>Board Chat</h3>
            <button
              type="button"
              className={styles.closeSidebarBtn}
              onClick={() => setShowChatSidebar(false)}
              title="Close chat"
            >
              ×
            </button>
          </div>
          
          <div className={styles.chatFeed}>
            {loadingChat ? (
              <p className={styles.sidebarLoading}>Loading history…</p>
            ) : chatMessages.length === 0 ? (
              <p className={styles.noMessages}>No messages yet. Say hello!</p>
            ) : (
              <div className={styles.chatMessagesList}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={styles.chatMessageItem}>
                    <div className={styles.chatMessageHeader}>
                      <span className={styles.chatMessageUser}>@{msg.username}</span>
                      <span className={styles.chatMessageTime}>
                        {new Date(msg.created_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <p className={styles.chatMessageText}>{msg.text}</p>
                  </div>
                ))}
                <div ref={(el) => { el?.scrollIntoView({ behavior: "smooth" }); }} />
              </div>
            )}
          </div>

          <form onSubmit={sendChatMessage} className={styles.chatInputForm}>
            <input
              type="text"
              placeholder="Type a message…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className={styles.chatInputField}
              required
            />
            <button type="submit" className={styles.chatSendBtn}>
              Send
            </button>
          </form>
        </aside>
      )}

      <ToastStack />
      {showHistory ? (
        <HistoryModal boardId={board.id} onClose={() => setShowHistory(false)} />
      ) : null}
    </div>
  );
}
