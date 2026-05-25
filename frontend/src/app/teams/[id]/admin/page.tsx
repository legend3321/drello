"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";

import { api } from "@/lib/api";
import type { User } from "@/types/auth";
import type { TeamAdminDashboard, TeamMembership } from "@/types/team";

import styles from "./page.module.css";

export default function TeamAdminDashboardPage() {
  const params = useParams();
  const teamId = Number(params.id);

  const [data, setData] = useState<TeamAdminDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUsername, setNewUsername] = useState("");
  const [newRoleLevelId, setNewRoleLevelId] = useState<number | "">("");

  const [suggestions, setSuggestions] = useState<User[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [inviteRoleLevelId, setInviteRoleLevelId] = useState<number | "">("");
  const [generatedLink, setGeneratedLink] = useState<string>("");
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!Number.isFinite(teamId)) return;
    setLoading(true);
    setError(null);
    try {
      const dashboard = await api.getTeamAdminDashboard(teamId);
      setData(dashboard);
      setNewRoleLevelId((current) => {
        if (current !== "") return current;
        if (dashboard.team.role_levels.length === 0) return "";
        const defaultLevel =
          dashboard.team.role_levels.find((r) => r.slug === "member") ??
          dashboard.team.role_levels[dashboard.team.role_levels.length - 1];
        return defaultLevel.id;
      });
      setInviteRoleLevelId((current) => {
        if (current !== "") return current;
        if (dashboard.team.role_levels.length === 0) return "";
        const defaultLevel =
          dashboard.team.role_levels.find((r) => r.slug === "member") ??
          dashboard.team.role_levels[dashboard.team.role_levels.length - 1];
        return defaultLevel.id;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void load();
  }, [load]);


  useEffect(() => {
    if (!newUsername.trim()) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const users = await api.searchUsers(newUsername.trim(), teamId);
        setSuggestions(users);
      } catch (e) {
        console.error("Failed to fetch user suggestions", e);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [newUsername, teamId]);

  const generateInviteLink = async () => {
    if (inviteRoleLevelId === "") return;
    try {
      const invitation = await api.createTeamInvitation(teamId, Number(inviteRoleLevelId));
      const url = `${window.location.origin}/invite/${invitation.code}`;
      setGeneratedLink(url);
      setCopied(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create invitation link");
    }
  };

  const copyInviteLink = async () => {
    if (!generatedLink) return;
    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      setError("Failed to copy link automatically. Please select and copy manually.");
    }
  };

  const addMember = async (event: FormEvent) => {
    event.preventDefault();
    if (!data || newRoleLevelId === "" || !newUsername.trim()) return;
    try {
      await api.addTeamMember(teamId, Number(newRoleLevelId), {
        username: newUsername.trim(),
      });
      setNewUsername("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add member");
    }
  };

  const changeMemberRole = async (member: TeamMembership, roleLevelId: number) => {
    try {
      await api.updateTeamMember(teamId, member.user.id, roleLevelId);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to update member");
    }
  };

  const removeMember = async (member: TeamMembership) => {
    if (!window.confirm(`Remove ${member.user.username} from the team?`)) return;
    try {
      await api.removeTeamMember(teamId, member.user.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to remove member");
    }
  };

  const assignableLevels = (member: TeamMembership) => {
    if (!data) return [];
    const myRank = data.team.my_role?.rank ?? 999;
    return data.team.role_levels.filter(
      (level) =>
        level.rank > myRank &&
        (member.role_level.rank > myRank || level.id !== member.role_level.id),
    );
  };

  if (loading) {
    return (
      <main className={styles.main}>
        <p className={styles.subtitle}>Loading admin dashboard…</p>
      </main>
    );
  }

  if (error && !data) {
    return (
      <main className={styles.main}>
        <Link href="/teams" className={styles.backLink}>
          ← Teams
        </Link>
        <p className={styles.error}>{error}</p>
      </main>
    );
  }

  if (!data) return null;

  const { team, stats, members, boards, permissions } = data;

  return (
    <main className={styles.main}>
      <Link href="/teams" className={styles.backLink}>
        ← Teams
      </Link>

      <header className={styles.header}>
        <h1>{team.name} — Admin</h1>
        <p className={styles.subtitle}>
          Manage members, hierarchy, and team boards. Roles map to Django auth
          groups per team.
        </p>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <div className={styles.stats}>
        <div className={styles.statCard}>
          <strong>{stats.member_count}</strong>
          <span>Members</span>
        </div>
        <div className={styles.statCard}>
          <strong>{stats.board_count}</strong>
          <span>Boards</span>
        </div>
        <div className={styles.statCard}>
          <strong>{stats.role_level_count}</strong>
          <span>Hierarchy levels</span>
        </div>
      </div>

      <section className={styles.section}>
        <h2>Role hierarchy</h2>
        <ul className={styles.hierarchyList}>
          {team.role_levels.map((level) => (
            <li key={level.id} className={styles.hierarchyItem}>
              <span className={styles.rank}>{level.rank}</span>
              <strong>{level.name}</strong>
              <span className={styles.perms}>
                {[
                  level.can_manage_team && "manage team",
                  level.can_manage_members && "manage members",
                  level.can_manage_boards && "manage boards",
                  level.can_edit_boards && "edit boards",
                ]
                  .filter(Boolean)
                  .join(" · ") || "view only"}
              </span>
              <span className={styles.perms}>
                {level.member_count ?? 0} member(s)
              </span>
            </li>
          ))}
        </ul>
        {permissions.is_owner ? (
          <p className={styles.subtitle}>
            Owners can add custom levels via the API (
            <code>POST /api/teams/{teamId}/role-levels/add/</code>).
          </p>
        ) : null}
      </section>

      {permissions.can_manage_members ? (
        <>
          <section className={styles.section}>
            <h2>Members</h2>
            <form className={styles.addMember} onSubmit={addMember}>
              <div className={styles.autocompleteContainer}>
                <input
                  placeholder="Username to invite"
                  value={newUsername}
                  onChange={(e) => {
                    setNewUsername(e.target.value);
                    setShowSuggestions(true);
                  }}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => {
                    setTimeout(() => setShowSuggestions(false), 200);
                  }}
                  required
                  autoComplete="off"
                />
                {showSuggestions && suggestions.length > 0 && (
                  <ul className={styles.suggestionsList}>
                    {suggestions.map((user) => (
                      <li
                        key={user.id}
                        onMouseDown={() => {
                          setNewUsername(user.username);
                          setSuggestions([]);
                          setShowSuggestions(false);
                        }}
                      >
                        <span className={styles.suggestionUsername}>@{user.username}</span>
                        <span className={styles.suggestionEmail}>{user.email}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <select
                value={newRoleLevelId}
                onChange={(e) => setNewRoleLevelId(Number(e.target.value))}
              >
                {team.role_levels
                  .filter((level) => level.rank > (team.my_role?.rank ?? 999))
                  .map((level) => (
                    <option key={level.id} value={level.id}>
                      {level.name}
                    </option>
                  ))}
              </select>
              <button type="submit">Add member</button>
            </form>

            <table className={styles.table}>
              <thead>
                <tr>
                  <th>User</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {members.map((member) => {
                  const levels = assignableLevels(member);
                  const canEdit =
                    permissions.can_manage_members &&
                    member.role_level.rank > (team.my_role?.rank ?? 999);
                  return (
                    <tr key={member.id}>
                      <td>@{member.user.username}</td>
                      <td>
                        {canEdit && levels.length > 0 ? (
                          <select
                            className={styles.roleSelect}
                            value={member.role_level.id}
                            onChange={(e) =>
                              void changeMemberRole(member, Number(e.target.value))
                            }
                          >
                            {levels.map((level) => (
                              <option key={level.id} value={level.id}>
                                {level.name}
                              </option>
                            ))}
                          </select>
                        ) : (
                          member.role_level.name
                        )}
                      </td>
                      <td>{new Date(member.joined_at).toLocaleDateString()}</td>
                      <td>
                        {canEdit ? (
                          <button
                            type="button"
                            className={styles.dangerBtn}
                            onClick={() => void removeMember(member)}
                          >
                            Remove
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>

          <section className={styles.section}>
            <h2>Invite links</h2>
            <p className={styles.subtitle}>
              Generate a secure invitation link to share with others. Anyone with the link will be able to join the team.
            </p>
            <div className={styles.inviteGenerator}>
              <select
                value={inviteRoleLevelId}
                onChange={(e) => setInviteRoleLevelId(Number(e.target.value))}
              >
                {team.role_levels
                  .filter((level) => level.rank > (team.my_role?.rank ?? 999))
                  .map((level) => (
                    <option key={level.id} value={level.id}>
                      Invite as {level.name}
                    </option>
                  ))}
              </select>
              <button type="button" onClick={generateInviteLink} className={styles.generateBtn}>
                Generate link
              </button>
            </div>
            
            {generatedLink && (
              <div className={styles.inviteResult}>
                <input readOnly value={generatedLink} className={styles.inviteUrlInput} />
                <button type="button" onClick={copyInviteLink} className={styles.copyBtn}>
                  {copied ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
          </section>
        </>
      ) : null}

      <section className={styles.section}>
        <h2>Team boards</h2>
        {boards.length === 0 ? (
          <p className={styles.subtitle}>
            No team boards yet. Create one from the home page with this team
            selected.
          </p>
        ) : (
          <ul className={styles.boardList}>
            {boards.map((board) => (
              <li key={board.id}>
                <Link href={`/boards/${board.id}`}>{board.title}</Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
