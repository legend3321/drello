"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";

import { api } from "@/lib/api";
import type { TeamSummary } from "@/types/team";

import styles from "./page.module.css";

export default function TeamsPage() {
  const [teams, setTeams] = useState<TeamSummary[]>([]);
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadTeams = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTeams(await api.listTeams());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load teams");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();
  }, [loadTeams]);

  const createTeam = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    try {
      await api.createTeam(trimmed);
      setName("");
      await loadTeams();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create team");
    }
  };

  const isAdmin = (team: TeamSummary) =>
    team.my_role?.can_manage_team ?? false;

  return (
    <main className={styles.main}>
      <header className={styles.hero}>
        <h1>Teams</h1>
        <p>
          Join multiple teams, each with its own role hierarchy backed by Django
          groups.
        </p>
        <form className={styles.createForm} onSubmit={createTeam}>
          <input
            className={styles.createInput}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New team name…"
          />
          <button type="submit" className={styles.createBtn}>
            + Create team
          </button>
        </form>
      </header>

      {loading ? <p className={styles.hint}>Loading teams…</p> : null}
      {error ? <p className={styles.error}>{error}</p> : null}

      {!loading && teams.length === 0 ? (
        <p className={styles.hint}>No teams yet. Create one above.</p>
      ) : null}

      {!loading && teams.length > 0 ? (
        <ul className={styles.list}>
          {teams.map((team) => (
            <li key={team.id} className={styles.teamItem}>
              <div className={styles.teamName}>
                {team.name}
                {team.my_role ? (
                  <span className={styles.badge} style={{ marginLeft: "0.5rem" }}>
                    {team.my_role.name}
                  </span>
                ) : null}
              </div>
              <span className={styles.hint}>{team.member_count} members</span>
              {isAdmin(team) ? (
                <Link
                  href={`/teams/${team.id}/admin`}
                  className={`${styles.linkBtn} ${styles.adminBtn}`}
                >
                  Admin dashboard
                </Link>
              ) : null}
              <Link href={`/?team=${team.id}`} className={styles.linkBtn}>
                Boards
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
