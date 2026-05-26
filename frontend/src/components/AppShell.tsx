"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
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
  ChevronDown
} from "lucide-react";

import { useAuthStore } from "@/store/authStore";
import { useBoardStore } from "@/store/boardStore";
import { api } from "@/lib/api";
import type { ActivityLog, BoardSummary } from "@/types/board";
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
  const [settingsExpanded, setSettingsExpanded] = useState(false);
  const [themeMode, setThemeMode] = useState<"light" | "dark">("dark");
  
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
      return (
        <>
          <span>Drello</span>
          <ChevronRight size={14} />
          <Link href="/">Boards</Link>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbActive}>
            {board ? board.title : "Board Workspace"}
          </span>
        </>
      );
    }
    if (pathname.startsWith("/teams")) {
      return (
        <>
          <span>Drello</span>
          <ChevronRight size={14} />
          <span className={styles.breadcrumbActive}>Teams</span>
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
          <ul className={styles.menuList}>
            <li>
              <Link 
                href="/" 
                className={`${styles.menuLink} ${pathname === "/" ? styles.menuLinkActive : ""}`}
              >
                <span className={styles.menuLinkIcon}><Grid size={18} /></span>
                <span className={styles.menuLinkText}>Boards</span>
              </Link>
            </li>
            <li>
              <Link 
                href="/teams" 
                className={`${styles.menuLink} ${pathname.startsWith("/teams") ? styles.menuLinkActive : ""}`}
              >
                <span className={styles.menuLinkIcon}><Users size={18} /></span>
                <span className={styles.menuLinkText}>Teams</span>
              </Link>
            </li>
            
            {/* Collapsible Settings */}
            <li>
              <div 
                className={styles.menuLink} 
                onClick={() => setSettingsExpanded(!settingsExpanded)}
              >
                <span className={styles.menuLinkIcon}><Settings size={18} /></span>
                <span className={styles.menuLinkText}>Workspace settings</span>
                <ChevronDown 
                  size={16} 
                  className={`${styles.menuArrow} ${settingsExpanded ? styles.menuArrowExpanded : ""}`}
                />
              </div>
              {settingsExpanded && (
                <ul className={styles.submenuList}>
                  <li>
                    <Link href="/settings" className={styles.submenuLink}>
                      Profile Settings
                    </Link>
                  </li>
                </ul>
              )}
            </li>
          </ul>
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
