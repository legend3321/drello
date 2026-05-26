"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { 
  Grid, 
  Users, 
  Map, 
  BarChart, 
  AlertCircle, 
  Settings, 
  HelpCircle, 
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
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowUserDropdown(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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
                <span className={styles.menuLinkText}>Members</span>
              </Link>
            </li>
            <li>
              <div className={styles.menuLink}>
                <span className={styles.menuLinkIcon}><Map size={18} /></span>
                <span className={styles.menuLinkText}>Road map</span>
              </div>
            </li>
            <li>
              <div className={styles.menuLink}>
                <span className={styles.menuLinkIcon}><BarChart size={18} /></span>
                <span className={styles.menuLinkText}>Reports</span>
              </div>
            </li>
            <li>
              <div className={styles.menuLink}>
                <span className={styles.menuLinkIcon}><AlertCircle size={18} /></span>
                <span className={styles.menuLinkText}>Issues</span>
              </div>
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
                  <li>
                    <span className={styles.submenuLink} style={{ cursor: "pointer" }}>
                      Upgrade workspace
                    </span>
                  </li>
                </ul>
              )}
            </li>
          </ul>

          {/* Categories Grid Section */}
          <div>
            <div className={styles.sectionHeader}>
              <span>Categories</span>
              <button className={styles.sectionAddBtn}>+</button>
            </div>
            <ul className={styles.menuList}>
              <li className={styles.menuLink}>
                <span className={styles.categoryDot} style={{ background: "#2563eb" }} />
                <span className={styles.menuLinkText} style={{ marginLeft: "0.5rem" }}>Workspaces</span>
                <ChevronRight size={14} className={styles.menuArrow} />
              </li>
              <li className={styles.menuLink}>
                <span className={styles.categoryDot} style={{ background: "#f59e0b" }} />
                <span className={styles.menuLinkText} style={{ marginLeft: "0.5rem" }}>Recent</span>
                <ChevronRight size={14} className={styles.menuArrow} />
              </li>
              <li className={styles.menuLink}>
                <span className={styles.categoryDot} style={{ background: "#db2777" }} />
                <span className={styles.menuLinkText} style={{ marginLeft: "0.5rem" }}>Starred</span>
                <ChevronRight size={14} className={styles.menuArrow} />
              </li>
              <li className={styles.menuLink}>
                <span className={styles.categoryDot} style={{ background: "#10b981" }} />
                <span className={styles.menuLinkText} style={{ marginLeft: "0.5rem" }}>Templates</span>
                <ChevronRight size={14} className={styles.menuArrow} />
              </li>
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
            <div className={styles.searchWrapper}>
              <Search className={styles.searchIcon} size={16} />
              <input 
                type="text" 
                placeholder="Find the task what you're looking for..." 
                className={styles.searchInput}
              />
            </div>

            {/* Sun/Moon Toggle Mockup */}
            <div className={styles.themeToggle}>
              <button 
                className={`${styles.toggleBtn} ${themeMode === "light" ? styles.toggleBtnActive : ""}`}
                onClick={() => setThemeMode("light")}
              >
                <Sun size={12} style={{ display: "inline", marginRight: "3px" }} /> Light
              </button>
              <button 
                className={`${styles.toggleBtn} ${themeMode === "dark" ? styles.toggleBtnActive : ""}`}
                onClick={() => setThemeMode("dark")}
              >
                <Moon size={12} style={{ display: "inline", marginRight: "3px" }} /> Dark
              </button>
            </div>

            <div className={styles.actionIcons}>
              <button className={styles.iconBtn} aria-label="Help">
                <HelpCircle size={18} />
              </button>
              <button className={styles.iconBtn} aria-label="Notifications">
                <Bell size={18} />
                <span className={styles.badge}>2</span>
              </button>
            </div>

            <button className={styles.premiumBtn}>
              👑 Premium
            </button>
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
