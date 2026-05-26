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
import { EmojiAvatar } from "./EmojiAvatar";
import { CardDetailPanel } from "./CardDetailPanel";
import { motion, AnimatePresence } from "framer-motion";
import { Settings as CogIcon, History as HistoryIcon, Trash2 as TrashIcon } from "lucide-react";
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
  
  const [activeTab, setActiveTab] = useState<"board" | "members" | "chat" | "dashboard">("board");
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const activeTabRef = useRef(activeTab);

  useEffect(() => {
    activeTabRef.current = activeTab;
    if (activeTab === "chat") {
      setUnreadChatCount(0);
    }
  }, [activeTab]);

  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [activeCardDetail, setActiveCardDetail] = useState<{
    cardId?: number;
    listId?: number;
    isCreate: boolean;
  } | null>(null);

  const settingsRef = useRef<HTMLDivElement>(null);

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
            if (activeTabRef.current !== "chat") {
              setUnreadChatCount((c) => c + 1);
            }
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



  useEffect(() => {
    const handleOpenCard = (e: Event) => {
      const cardId = (e as CustomEvent).detail;
      setActiveCardDetail({ cardId, isCreate: false });
    };
    window.addEventListener("drello_open_card", handleOpenCard);
    return () => window.removeEventListener("drello_open_card", handleOpenCard);
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettingsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);


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

  const [memberSearchQuery, setMemberSearchQuery] = useState("");

  if (loading && !board) {
    return <p className={styles.status}>Loading board…</p>;
  }

  if (!board) {
    return <p className={styles.status}>Board not found.</p>;
  }

  const displayMembers = board.team_id && members.length > 0 ? members : [
    {
      id: 9999,
      user: {
        id: board.owner_id || 1,
        username: board.owner_username || "owner",
        email: "owner@drello.com",
        avatar_emoji: board.owner_avatar_emoji || "👑"
      },
      role_level: { name: "Owner" }
    }
  ];

  const filteredMembers = displayMembers.filter(m => 
    m.user.username.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
    (m.user.email && m.user.email.toLowerCase().includes(memberSearchQuery.toLowerCase()))
  );

  const renderMembersView = () => {
    return (
      <div className={styles.membersView}>
        <div className={styles.viewHeader}>
          <h3>Team Members ({displayMembers.length})</h3>
          <input 
            type="text" 
            placeholder="Search members by username or email..." 
            value={memberSearchQuery}
            onChange={(e) => setMemberSearchQuery(e.target.value)}
            className={styles.memberSearchInput}
          />
        </div>

        {filteredMembers.length === 0 ? (
          <p className={styles.noResultsHint}>No team members found.</p>
        ) : (
          <div className={styles.membersGrid}>
            {filteredMembers.map((m) => {
              const isOnline = onlineUsers.includes(m.user.username);
              const isOwner = m.user.id === board.owner_id;
              return (
                <div key={m.id} className={styles.memberCard}>
                  <div className={styles.memberCardAvatar}>
                    <EmojiAvatar emoji={m.user.avatar_emoji || "😀"} username={m.user.username} size={54} />
                    <span 
                      className={`${styles.onlineDot} ${isOnline ? styles.online : styles.offline}`} 
                      title={isOnline ? "Online" : "Offline"}
                    />
                  </div>
                  <div className={styles.memberCardInfo}>
                    <h4 className={styles.memberCardUsername}>@{m.user.username}</h4>
                    <p className={styles.memberCardEmail}>{m.user.email || "No email added"}</p>
                    <span className={`${styles.roleBadge} ${isOwner ? styles.ownerBadge : ""}`}>
                      {isOwner ? "Owner" : m.role_level.name}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  };

  const renderChatView = () => {
    return (
      <div className={styles.chatViewContainer}>
        {/* Chat area */}
        <div className={styles.chatArea}>
          <div className={styles.chatFeed}>
            {loadingChat ? (
              <p className={styles.sidebarLoading}>Loading history…</p>
            ) : chatMessages.length === 0 ? (
              <p className={styles.noMessages}>No messages yet. Say hello!</p>
            ) : (
              <div className={styles.chatMessagesList}>
                {chatMessages.map((msg) => (
                  <div key={msg.id} className={styles.chatMessageItem}>
                    <EmojiAvatar emoji={msg.avatar_emoji || "😀"} username={msg.username} size={32} />
                    <div className={styles.chatMessageContent}>
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
                  </div>
                ))}
                <div ref={(el) => { el?.scrollIntoView({ behavior: "smooth" }); }} />
              </div>
            )}
          </div>

          <form onSubmit={sendChatMessage} className={styles.chatInputForm}>
            <input
              type="text"
              placeholder="Type a message to the team…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className={styles.chatInputField}
              required
            />
            <button type="submit" className={styles.chatSendBtn}>
              Send
            </button>
          </form>
        </div>

        {/* Sidebar panel inside Chat */}
        <div className={styles.chatSidebar}>
          <h4>Active Users ({onlineUsers.length})</h4>
          <ul className={styles.onlineUsersList}>
            {onlineUsers.map(u => (
              <li key={u} className={styles.onlineUserItem}>
                <span className={styles.onlineUserDot} />
                <span>@{u}</span>
              </li>
            ))}
            {onlineUsers.length === 0 && (
              <p className={styles.noOnlineUsers}>No other users online.</p>
            )}
          </ul>
        </div>
      </div>
    );
  };

  const renderDashboardView = () => {
    const cards = board.lists.flatMap((l) => l.cards);
    const totalCards = cards.length;

    // Columns progress
    const columnStats = board.lists.map((list) => ({
      name: list.title,
      count: list.cards.length,
      percentage: totalCards > 0 ? Math.round((list.cards.length / totalCards) * 100) : 0,
    }));

    // Priority counts
    const highestCount = cards.filter((c) => c.priority === "highest").length;
    const mediumCount = cards.filter((c) => c.priority === "medium" || !c.priority).length;
    const lowCount = cards.filter((c) => c.priority === "low").length;

    // Story Points counts
    const totalPoints = cards.reduce((sum, c) => sum + (c.story_points || 0), 0);
    const completedList = board.lists.find((l) => 
      l.title.toLowerCase().includes("done") || 
      l.title.toLowerCase().includes("completed")
    );
    const completedPoints = completedList
      ? completedList.cards.reduce((sum, c) => sum + (c.story_points || 0), 0)
      : 0;
    const pointsPercentage = totalPoints > 0 ? Math.round((completedPoints / totalPoints) * 100) : 0;

    // Workload
    const activeWorkload = displayMembers.map((m) => {
      const assignedCount = cards.filter((c) => 
        (c.assigned_users || []).some((u) => u.id === m.user.id)
      ).length;
      return {
        username: m.user.username,
        avatar: m.user.avatar_emoji || "😀",
        count: assignedCount,
      };
    });

    return (
      <div className={styles.dashboardView}>
        <div className={styles.dashboardGrid}>
          {/* Card: Total tasks summary */}
          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>Total Tasks</span>
            <span className={styles.statCardValue}>{totalCards}</span>
            <div className={styles.statCardSub}>Across {board.lists.length} columns</div>
          </div>

          {/* Card: Story points status */}
          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>Story Points Progress</span>
            <span className={styles.statCardValue}>
              {completedPoints} <span className={styles.statSlash}>/</span> {totalPoints}
            </span>
            <div className={styles.progressBarBg}>
              <div className={styles.progressBarFill} style={{ width: `${pointsPercentage}%` }} />
            </div>
            <div className={styles.statCardSub}>{pointsPercentage}% points completed</div>
          </div>

          {/* Card: Priority Breakdown */}
          <div className={styles.statCard}>
            <span className={styles.statCardLabel}>Priority Distribution</span>
            <div className={styles.priorityDistribution}>
              <div className={styles.priorityItem}>
                <span className={styles.priorityDot} style={{ background: "#ef4444" }} />
                <span className={styles.priorityLabel}>Highest: {highestCount}</span>
              </div>
              <div className={styles.priorityItem}>
                <span className={styles.priorityDot} style={{ background: "#f59e0b" }} />
                <span className={styles.priorityLabel}>Medium: {mediumCount}</span>
              </div>
              <div className={styles.priorityItem}>
                <span className={styles.priorityDot} style={{ background: "#3b82f6" }} />
                <span className={styles.priorityLabel}>Low: {lowCount}</span>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.dashboardRow}>
          {/* Tasks by Column List */}
          <div className={styles.dashboardSection}>
            <h3>Task Allocation by Column</h3>
            <div className={styles.columnsList}>
              {columnStats.map((col, i) => (
                <div key={i} className={styles.columnRow}>
                  <div className={styles.columnRowLabel}>
                    <span className={styles.columnName}>{col.name}</span>
                    <span className={styles.columnCount}>{col.count} tasks</span>
                  </div>
                  <div className={styles.progressBarBg}>
                    <div 
                      className={styles.progressBarFill} 
                      style={{ 
                        width: `${col.percentage}%`,
                        background: col.name.toLowerCase().includes("done") ? "#10b981" : "#3b82f6" 
                      }} 
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Team Workload Card */}
          <div className={styles.dashboardSection}>
            <h3>Team Tasks Workload</h3>
            <div className={styles.workloadList}>
              {activeWorkload.map((user, i) => (
                <div key={i} className={styles.workloadItem}>
                  <div className={styles.workloadUser}>
                    <EmojiAvatar emoji={user.avatar} username={user.username} size={28} />
                    <span className={styles.workloadUsername}>@{user.username}</span>
                  </div>
                  <span className={styles.workloadCountBadge}>
                    {user.count} tasks
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className={styles.workspaceLayout}>
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
            <div className={styles.headerActions} ref={settingsRef}>
              <button
                type="button"
                className={styles.settingsBtn}
                onClick={() => setShowSettingsDropdown(!showSettingsDropdown)}
                title="Board settings"
              >
                <CogIcon size={16} /> Settings
              </button>

              {showSettingsDropdown && (
                <div className={styles.settingsDropdown}>
                  <button 
                    type="button" 
                    className={styles.dropdownItem}
                    onClick={() => {
                      setShowHistory(true);
                      setShowSettingsDropdown(false);
                    }}
                  >
                    <HistoryIcon size={14} style={{ marginRight: "8px" }} /> Board History
                  </button>
                  {board.permissions?.can_delete && (
                    <button 
                      type="button" 
                      className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                      onClick={() => {
                        void deleteBoard();
                        setShowSettingsDropdown(false);
                      }}
                    >
                      <TrashIcon size={14} style={{ marginRight: "8px" }} /> Delete Board
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
          <p className={styles.meta}>
            {board.lists.length} column{board.lists.length === 1 ? "" : "s"} ·{" "}
            <span className={connected ? styles.live : styles.offline}>
              {connected ? "Live" : "Reconnecting…"}
            </span>
          </p>
        </header>

        {/* View Tabs Bar */}
        <div className={styles.tabsBar}>
          <button 
            type="button" 
            className={`${styles.tab} ${activeTab === "board" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("board")}
          >
            Board
          </button>
          <button 
            type="button" 
            className={`${styles.tab} ${activeTab === "members" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("members")}
          >
            Members
          </button>
          <button 
            type="button" 
            className={`${styles.tab} ${activeTab === "chat" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("chat")}
          >
            Chat {unreadChatCount > 0 && <span className={styles.chatTabBadge}>{unreadChatCount}</span>}
          </button>
          <button 
            type="button" 
            className={`${styles.tab} ${activeTab === "dashboard" ? styles.tabActive : ""}`}
            onClick={() => setActiveTab("dashboard")}
          >
            Dashboard
          </button>
        </div>

        {activeTab === "board" && (
          <KanbanBoard 
            onSelectCard={(id) => setActiveCardDetail({ cardId: id, isCreate: false })} 
            onCreateCard={(listId) => setActiveCardDetail({ listId, isCreate: true })}
          />
        )}

        {activeTab === "members" && renderMembersView()}

        {activeTab === "chat" && renderChatView()}

        {activeTab === "dashboard" && renderDashboardView()}
      </div>

      <ToastStack />
      {showHistory ? (
        <HistoryModal boardId={board.id} onClose={() => setShowHistory(false)} />
      ) : null}

      {/* Slide-out Card Detail Right Panel */}
      <AnimatePresence>
        {activeCardDetail && (
          <CardDetailPanel 
            cardId={activeCardDetail.cardId} 
            listId={activeCardDetail.listId}
            isCreate={activeCardDetail.isCreate}
            onClose={() => setActiveCardDetail(null)} 
          />
        )}
      </AnimatePresence>
    </div>
  );
}
