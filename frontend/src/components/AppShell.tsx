"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef, useCallback } from "react";
import { 
  Grid, 
  Users, 
  Settings, 
  Bell, 
  Search, 
  ChevronRight, 
  LogOut, 
  X, 
  Menu,
  Sun,
  Moon,
  Plus,
  Layout,
  Briefcase
} from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { useBoardStore } from "@/store/boardStore";
import { api } from "@/lib/api";
import type { ActivityLog, BoardSummary } from "@/types/board";
import type { TeamSummary } from "@/types/team";
import { EmojiAvatar } from "./EmojiAvatar";
import styles from "./AppShell.module.css";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const board = useBoardStore((s) => s.board);

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  
  // Sidebar data
  const [boards, setBoards] = useState<BoardSummary[]>([]);
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [isCreatingBoard, setIsCreatingBoard] = useState(false);
  const [newBoardTitle, setNewBoardTitle] = useState("");
  const [isCreatingTeam, setIsCreatingTeam] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [sidebarLoading, setSidebarLoading] = useState(false);

  // New States for Search & Notifications
  const [showSearchDropdown, setShowSearchDropdown] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [allBoards, setAllBoards] = useState<BoardSummary[]>([]);
  
  const [showNotificationsDropdown, setShowNotificationsDropdown] = useState(false);
  const [notifications, setNotifications] = useState<ActivityLog[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const notificationsRef = useRef<HTMLDivElement>(null);
  const boardInputRef = useRef<HTMLInputElement>(null);
  const teamInputRef = useRef<HTMLInputElement>(null);

  // Fetch sidebar data (boards & teams)
  const refreshSidebarData = useCallback(async () => {
    if (!user) return;
    try {
      setSidebarLoading(true);
      const [fetchedBoards, fetchedTeams] = await Promise.all([
        api.listBoards(),
        api.listTeams(),
      ]);
      setBoards(fetchedBoards);
      setTeams(fetchedTeams);
      setAllBoards(fetchedBoards);
    } catch (e) {
      console.error("Failed to load sidebar data", e);
    } finally {
      setSidebarLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refreshSidebarData();
    }
  }, [user, refreshSidebarData]);

  // Focus inputs when inline form opens
  useEffect(() => {
    if (isCreatingBoard) {
      setTimeout(() => boardInputRef.current?.focus(), 50);
    }
  }, [isCreatingBoard]);

  useEffect(() => {
    if (isCreatingTeam) {
      setTimeout(() => teamInputRef.current?.focus(), 50);
    }
  }, [isCreatingTeam]);

  // Handlers for adding Board & Team
  const handleCreateBoard = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newBoardTitle.trim();
    if (!title) return;
    try {
      const created = await api.createBoard(title);
      setNewBoardTitle("");
      setIsCreatingBoard(false);
      await refreshSidebarData();
      router.push(`/boards/${created.id}`);
    } catch (err) {
      console.error("Failed to create board:", err);
    }
  };

  const handleCreateTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newTeamName.trim();
    if (!name) return;
    try {
      const created = await api.createTeam(name);
      setNewTeamName("");
      setIsCreatingTeam(false);
      await refreshSidebarData();
      router.push(`/teams/${created.id}/admin`);
    } catch (err) {
      console.error("Failed to create team:", err);
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSearchDropdown(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target as Node)) {
        setShowNotificationsDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Theme Mode effect
  useEffect(() => {
    const savedTheme = localStorage.getItem("drello-theme") as "light" | "dark" | null;
    if (savedTheme) {
      setThemeMode(savedTheme);
    }
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (themeMode === "light") {
      root.classList.add("light");
      root.classList.remove("dark");
    } else {
      root.classList.add("dark");
      root.classList.remove("light");
    }
    localStorage.setItem("drello-theme", themeMode);
  }, [themeMode]);

  // Fetch boards for search
  const handleSearchFocus = async () => {
    setShowSearchDropdown(true);
    try {
      const data = await api.listBoards();
      setAllBoards(data);
    } catch (e) {
      console.error("Failed to load boards for search", e);
    }
  };

  const getFilteredBoards = () => {
    if (!searchQuery.trim()) return [];
    return allBoards.filter(b => 
      b.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  };

  const getFilteredCards = () => {
    if (!searchQuery.trim() || !board) return [];
    return board.lists.flatMap(l => l.cards).filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      (c.description && c.description.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  };

  // Notifications logic
  useEffect(() => {
    if (!board) {
      setNotifications([]);
      return;
    }
    api.getBoardHistory(board.id)
      .then(setNotifications)
      .catch(err => console.error("Failed to load history in AppShell", err));
  }, [board?.id]);

  useEffect(() => {
    const handleBoardEvent = (e: Event) => {
      const event = (e as CustomEvent).detail;
      if (event.type === "activity_created") {
        const newLog = event.payload as ActivityLog;
        if (newLog.username !== user?.username) {
          setNotifications(prev => [newLog, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      }
    };
    window.addEventListener("drello_board_event", handleBoardEvent);
    return () => window.removeEventListener("drello_board_event", handleBoardEvent);
  }, [user?.username]);

  const handleToggleNotifications = () => {
    setShowNotificationsDropdown(!showNotificationsDropdown);
    if (!showNotificationsDropdown) {
      setUnreadCount(0);
    }
  };

  const handleSelectCardResult = (cardId: number) => {
    setShowSearchDropdown(false);
    setSearchQuery("");
    window.dispatchEvent(new CustomEvent("drello_open_card", { detail: cardId }));
  };

  // Close sidebar on navigation change (mobile)
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  if (pathname.startsWith("/login") || pathname.startsWith("/register")) {
    return <>{children}</>;
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  // Dynamic breadcrumbs based on route
  const getBreadcrumbs = () => {
    if (pathname === "/") {
      return (
        <>
          <span>Drello</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbActive}>Boards</span>
        </>
      );
    }
    if (pathname.startsWith("/boards/")) {
      const isBoardSettings = pathname.includes("/settings");
      return (
        <>
          <span>Drello</span>
          <ChevronRight size={14} />
          <Link href="/">Boards</Link>
          <ChevronRight size={14} />
          {isBoardSettings ? (
            <>
              {board ? <Link href={`/boards/${board.id}`}>{board.title}</Link> : <Link href="/">Board</Link>}
              <ChevronRight size={14} />
              <span className={styles.breadcrumbActive}>Settings</span>
            </>
          ) : (
            <span className={styles.breadcrumbActive}>
              {board ? board.title : "Board Workspace"}
            </span>
          )}
        </>
      );
    }
    if (pathname.startsWith("/teams")) {
      const isTeamAdmin = pathname.includes("/admin");
      return (
        <>
          <span>Drello</span>
          <ChevronRight size={14} />
          {isTeamAdmin ? (
            <>
              <Link href="/teams">Teams</Link>
              <ChevronRight size={14} />
              <span className={styles.breadcrumbActive}>Admin</span>
            </>
          ) : (
            <span className={styles.breadcrumbActive}>Teams</span>
          )}
        </>
      );
    }
    if (pathname.startsWith("/settings")) {
      return (
        <>
          <span>Drello</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbActive}>User Settings</span>
        </>
      );
    }
    return (
      <>
        <span>Drello</span>
        <ChevronRight size={14} />
        <span className={styles.breadcrumbActive}>Workspace</span>
      </>
    );
  };

  return (
    <div className={styles.appLayout}>
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div 
          className={styles.sidebarOverlay} 
          onClick={() => setSidebarOpen(false)} 
        />
      )}

      {/* Left Sidebar */}
      <aside className={`${styles.sidebar} ${sidebarOpen ? styles.sidebarOpen : ""}`}>
        <div className={styles.brandArea}>
          <div className={styles.trelloIcon}>
            <div className={styles.trelloIconBar1} />
            <div className={styles.trelloIconBar2} />
          </div>
          <span className={styles.brandText}>Drello</span>
        </div>

        <div className={styles.navSection}>
          {/* Boards Category */}
          <div className={styles.categorySection}>
            <div className={styles.sectionHeader}>
              <div className={styles.categoryTitleWrapper}>
                <Layout size={14} className={styles.categoryIcon} />
                <span>Boards</span>
              </div>
              <button 
                type="button" 
                className={styles.sectionAddBtn}
                title="Add new board"
                onClick={() => {
                  setIsCreatingBoard(!isCreatingBoard);
                  setIsCreatingTeam(false);
                }}
                aria-label="Add new board"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Inline Add Board Form */}
            {isCreatingBoard && (
              <form onSubmit={handleCreateBoard} className={styles.inlineAddForm}>
                <input
                  ref={boardInputRef}
                  type="text"
                  placeholder="Board title..."
                  className={styles.inlineAddInput}
                  value={newBoardTitle}
                  onChange={(e) => setNewBoardTitle(e.target.value)}
                />
                <div className={styles.inlineAddActions}>
                  <button type="submit" className={styles.inlineSubmitBtn} disabled={!newBoardTitle.trim()}>
                    Add
                  </button>
                  <button 
                    type="button" 
                    className={styles.inlineCancelBtn}
                    onClick={() => {
                      setIsCreatingBoard(false);
                      setNewBoardTitle("");
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </form>
            )}

            {/* Boards List */}
            <ul className={styles.categoryList}>
              {boards.map((b) => {
                const isActive = pathname === `/boards/${b.id}`;
                return (
                  <li key={b.id}>
                    <Link
                      href={`/boards/${b.id}`}
                      className={`${styles.categoryItem} ${isActive ? styles.categoryItemActive : ""}`}
                    >
                      <span className={styles.categoryItemBullet} />
                      <span className={styles.categoryItemText}>{b.title}</span>
                    </Link>
                  </li>
                );
              })}
              {boards.length === 0 && !sidebarLoading && (
                <li className={styles.emptyNotice}>No boards yet</li>
              )}
            </ul>
          </div>

          {/* Teams Category */}
          <div className={styles.categorySection}>
            <div className={styles.sectionHeader}>
              <div className={styles.categoryTitleWrapper}>
                <Briefcase size={14} className={styles.categoryIcon} />
                <span>Teams</span>
              </div>
              <button 
                type="button" 
                className={styles.sectionAddBtn}
                title="Add new team"
                onClick={() => {
                  setIsCreatingTeam(!isCreatingTeam);
                  setIsCreatingBoard(false);
                }}
                aria-label="Add new team"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Inline Add Team Form */}
            {isCreatingTeam && (
              <form onSubmit={handleCreateTeam} className={styles.inlineAddForm}>
                <input
                  ref={teamInputRef}
                  type="text"
                  placeholder="Team name..."
                  className={styles.inlineAddInput}
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                />
                <div className={styles.inlineAddActions}>
                  <button type="submit" className={styles.inlineSubmitBtn} disabled={!newTeamName.trim()}>
                    Add
                  </button>
                  <button 
                    type="button" 
                    className={styles.inlineCancelBtn}
                    onClick={() => {
                      setIsCreatingTeam(false);
                      setNewTeamName("");
                    }}
                  >
                    <X size={12} />
                  </button>
                </div>
              </form>
            )}

            {/* Teams List */}
            <ul className={styles.categoryList}>
              {teams.map((t) => {
                const isActive = pathname.startsWith(`/teams/${t.id}`);
                return (
                  <li key={t.id}>
                    <Link
                      href={`/teams/${t.id}/admin`}
                      className={`${styles.categoryItem} ${isActive ? styles.categoryItemActive : ""}`}
                    >
                      <span className={styles.categoryItemBullet} />
                      <span className={styles.categoryItemText}>{t.name}</span>
                      {t.member_count !== undefined && (
                        <span className={styles.categoryBadge}>{t.member_count}</span>
                      )}
                    </Link>
                  </li>
                );
              })}
              {teams.length === 0 && !sidebarLoading && (
                <li className={styles.emptyNotice}>No teams yet</li>
              )}
            </ul>
          </div>
        </div>

        {/* Bottom User profile card */}
        {user && (
          <div className={styles.userSection} ref={dropdownRef}>
            <div 
              className={styles.userCard} 
              onClick={() => setShowUserDropdown(!showUserDropdown)}
            >
              <EmojiAvatar emoji={user.avatar_emoji || "😀"} username={user.username} size={36} />
              <div className={styles.userInfo}>
                <span className={styles.userName}>@{user.username}</span>
                <span className={styles.userEmail}>{user.email || "No email added"}</span>
              </div>
              <button type="button" className={styles.userOptionsBtn}>
                •••
              </button>
            </div>

            {/* Dropdown Options */}
            {showUserDropdown && (
              <div className={styles.userDropdown}>
                <Link href="/settings" className={styles.dropdownItem}>
                  <Settings size={14} />
                  <span>Profile Settings</span>
                </Link>
                <button 
                  type="button" 
                  className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`}
                  onClick={handleLogout}
                >
                  <LogOut size={14} />
                  <span>Log out</span>
                </button>
              </div>
            )}
          </div>
        )}
      </aside>

      {/* Main Right Area */}
      <div className={styles.mainContainer}>
        {/* Top Header */}
        <header className={styles.topHeader}>
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <button 
              className={styles.menuToggleBtn}
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu size={22} />
            </button>
            <div className={styles.breadcrumbs}>
              {getBreadcrumbs()}
            </div>
          </div>

          <div className={styles.headerRight}>
            {/* Global Search Component */}
            <div className={styles.searchWrapper} ref={searchRef}>
              <Search className={styles.searchIcon} size={16} />
              <input 
                type="text" 
                placeholder="Search boards or tasks..." 
                className={styles.searchInput}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={handleSearchFocus}
              />

              {showSearchDropdown && searchQuery.trim().length >= 2 && (
                <div className={styles.searchResultsDropdown}>
                  {getFilteredBoards().length === 0 && getFilteredCards().length === 0 ? (
                    <p className={styles.noResults}>No matches found</p>
                  ) : (
                    <>
                      {getFilteredBoards().length > 0 && (
                        <div className={styles.searchGroup}>
                          <span className={styles.searchGroupTitle}>Boards</span>
                          {getFilteredBoards().map(b => (
                            <Link
                              key={b.id}
                              href={`/boards/${b.id}`}
                              className={styles.searchResultItem}
                              onClick={() => {
                                setShowSearchDropdown(false);
                                setSearchQuery("");
                              }}
                            >
                              <span className={styles.searchResultTitle}>{b.title}</span>
                              <span className={styles.searchResultSubtitle}>Board Workspace</span>
                            </Link>
                          ))}
                        </div>
                      )}
                      {getFilteredCards().length > 0 && (
                        <div className={styles.searchGroup}>
                          <span className={styles.searchGroupTitle}>Cards / Tasks</span>
                          {getFilteredCards().map(c => (
                            <div
                              key={c.id}
                              className={styles.searchResultItem}
                              onClick={() => handleSelectCardResult(c.id)}
                            >
                              <span className={styles.searchResultTitle}>{c.title}</span>
                              <span className={styles.searchResultSubtitle}>
                                in column: {board?.lists.find(l => l.id === c.list_id)?.title || "Column"}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Sun/Moon Toggle */}
            <div className={styles.themeToggle}>
              <button 
                type="button"
                className={`${styles.toggleBtn} ${themeMode === "light" ? styles.toggleBtnActive : ""}`}
                onClick={() => setThemeMode("light")}
              >
                <Sun size={12} style={{ display: "inline", marginRight: "3px" }} /> Light
              </button>
              <button 
                type="button"
                className={`${styles.toggleBtn} ${themeMode === "dark" ? styles.toggleBtnActive : ""}`}
                onClick={() => setThemeMode("dark")}
              >
                <Moon size={12} style={{ display: "inline", marginRight: "3px" }} /> Dark
              </button>
            </div>

            <div className={styles.actionIcons}>
              {/* Notifications Dropdown Toggle */}
              <div className={styles.notificationsWrapper} ref={notificationsRef}>
                <button 
                  type="button"
                  className={styles.iconBtn} 
                  aria-label="Notifications"
                  onClick={handleToggleNotifications}
                >
                  <Bell size={18} />
                  {unreadCount > 0 && <span className={styles.badge}>{unreadCount}</span>}
                </button>

                {showNotificationsDropdown && (
                  <div className={styles.notificationsDropdown}>
                    <div className={styles.notificationsHeader}>
                      <h4>Notifications</h4>
                      {notifications.length > 0 && (
                        <button 
                          type="button" 
                          className={styles.markReadBtn} 
                          onClick={() => setUnreadCount(0)}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                    <div className={styles.notificationsList}>
                      {notifications.length === 0 ? (
                        <p className={styles.noNotifications}>No notifications yet.</p>
                      ) : (
                        notifications.slice(0, 10).map((n) => (
                          <div key={n.id} className={styles.notificationItem}>
                            <span className={styles.notificationUser}>@{n.username}</span>
                            <span className={styles.notificationDetail}> {n.detail}</span>
                            <span className={styles.notificationTime}>
                              {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <div className={styles.pageContent}>
          {children}
        </div>
      </div>
    </div>
  );
}
