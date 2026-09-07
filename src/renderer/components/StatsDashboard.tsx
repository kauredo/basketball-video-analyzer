import React, { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilm, faClock, faStopwatch, faTags } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/StatsDashboard.module.css";
import { Court, COURT_VB_W, COURT_VB_H } from "./Court";
import { Clip, Category, Player } from "../../types/global";

interface StatsDashboardProps {
  clips: Clip[];
  categories: Category[];
  videoDuration: number;
  projectId?: number;
}

const NUM_BUCKETS = 8;

const parseCategoryIds = (clip: Clip): number[] => {
  try {
    const ids = JSON.parse(clip.categories);
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

const parsePlayerIds = (clip: Clip): number[] => {
  try {
    const ids = JSON.parse(clip.players || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

// mm:ss, or h:mm:ss when an hour or more
const formatDuration = (seconds: number): string => {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m}:${s.toString().padStart(2, "0")}`;
};

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  clips,
  categories,
  videoDuration,
  projectId,
}) => {
  const { t } = useTranslation();
  const [tab, setTab] = useState<"overview" | "shotChart">("overview");
  const [players, setPlayers] = useState<Player[]>([]);
  const [filterPlayer, setFilterPlayer] = useState<number | "all">("all");
  const [filterQuarter, setFilterQuarter] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<number | "all">("all");

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    window.electronAPI
      .getPlayers(projectId)
      .then(p => {
        if (!cancelled) setPlayers(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  // Flatten hierarchical categories into a single lookup-friendly list
  const flatCategories = useMemo(() => {
    const flat: Category[] = [];
    categories.forEach(cat => {
      flat.push(cat);
      cat.children?.forEach(child => flat.push(child));
    });
    return flat;
  }, [categories]);

  const summary = useMemo(() => {
    const totalDuration = clips.reduce((sum, c) => sum + c.duration, 0);
    const usedIds = new Set<number>();
    clips.forEach(c => parseCategoryIds(c).forEach(id => usedIds.add(id)));
    return {
      count: clips.length,
      totalDuration,
      avgDuration: clips.length > 0 ? totalDuration / clips.length : 0,
      categoriesUsed: usedIds.size,
    };
  }, [clips]);

  // Count + total duration of clips per category, highest first.
  // Single O(clips) pass tallies every category, then maps over the catalog.
  const byCategory = useMemo(() => {
    const tally = new Map<number, { count: number; duration: number }>();
    clips.forEach(c => {
      parseCategoryIds(c).forEach(id => {
        const cur = tally.get(id) || { count: 0, duration: 0 };
        cur.count += 1;
        cur.duration += c.duration;
        tally.set(id, cur);
      });
    });
    // Keep every category, at zero when it has no clips. Absence and zero are
    // different facts, and for a scouting tool the zero is often the finding.
    const rows = flatCategories
      .filter(cat => cat.id !== undefined)
      .map(cat => ({
        id: cat.id!,
        name: cat.name,
        color: cat.color,
        ...(tally.get(cat.id!) ?? { count: 0, duration: 0 }),
      }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name));
    const maxCount = rows.reduce((max, r) => Math.max(max, r.count), 0);
    return { rows, maxCount };
  }, [flatCategories, clips]);

  // Clips per quarter, in game order (unset quarters grouped last)
  const byQuarter = useMemo(() => {
    const order = ["Q1", "Q2", "Q3", "Q4", "OT"];
    const counts = new Map<string, number>();
    let noQuarter = 0;
    clips.forEach(c => {
      if (c.quarter) {
        counts.set(c.quarter, (counts.get(c.quarter) || 0) + 1);
      } else {
        noQuarter += 1;
      }
    });
    const rows = order.map(q => ({ label: q, count: counts.get(q) ?? 0 }));
    // Any custom quarter values not in the canonical order, sorted for stability
    Array.from(counts.keys())
      .filter(q => !order.includes(q))
      .sort()
      .forEach(q => rows.push({ label: q, count: counts.get(q)! }));
    if (noQuarter > 0) {
      rows.push({ label: t("app.stats.noQuarter"), count: noQuarter });
    }
    const maxCount = rows.reduce((max, r) => Math.max(max, r.count), 0);
    return { rows, maxCount };
  }, [clips, t]);

  // Distribution of clips across the game timeline, by clip start time
  const distribution = useMemo(() => {
    const span =
      videoDuration > 0
        ? videoDuration
        : clips.reduce((max, c) => Math.max(max, c.end_time), 0);
    const buckets = new Array(NUM_BUCKETS).fill(0);
    if (span > 0) {
      clips.forEach(c => {
        const idx = Math.min(
          NUM_BUCKETS - 1,
          Math.floor((c.start_time / span) * NUM_BUCKETS),
        );
        buckets[idx] += 1;
      });
    }
    const maxBucket = buckets.reduce((max, b) => Math.max(max, b), 0);
    return { buckets, maxBucket, span };
  }, [clips, videoDuration]);

  const catColorMap = useMemo(() => {
    const m = new Map<number, string>();
    flatCategories.forEach(c => {
      if (c.id != null) m.set(c.id, c.color);
    });
    return m;
  }, [flatCategories]);

  const locatedClips = useMemo(
    () => clips.filter(c => c.court_x != null && c.court_y != null),
    [clips]
  );

  const chartClips = useMemo(
    () =>
      locatedClips.filter(c => {
        if (filterQuarter !== "all" && (c.quarter || "") !== filterQuarter)
          return false;
        if (
          filterCategory !== "all" &&
          !parseCategoryIds(c).includes(filterCategory)
        )
          return false;
        if (filterPlayer !== "all" && !parsePlayerIds(c).includes(filterPlayer))
          return false;
        return true;
      }),
    [locatedClips, filterQuarter, filterCategory, filterPlayer]
  );

  const chartQuarters = useMemo(() => {
    const set = new Set<string>();
    clips.forEach(c => {
      if (c.quarter) set.add(c.quarter);
    });
    const canonical = ["Q1", "Q2", "Q3", "Q4", "OT"];
    return [
      ...canonical.filter(q => set.has(q)),
      ...[...set].filter(q => !canonical.includes(q)),
    ];
  }, [clips]);

  if (clips.length === 0) {
    return (
      <div className={styles.emptyState}>
        <FontAwesomeIcon icon={faFilm} />
        <p>{t("app.stats.noData")}</p>
      </div>
    );
  }

  const summaryCards = [
    { icon: faFilm, label: t("app.stats.totalClips"), value: String(summary.count) },
    { icon: faClock, label: t("app.stats.totalDuration"), value: formatDuration(summary.totalDuration) },
    { icon: faStopwatch, label: t("app.stats.avgDuration"), value: formatDuration(summary.avgDuration) },
    { icon: faTags, label: t("app.stats.categoriesUsed"), value: String(summary.categoriesUsed) },
  ];

  return (
    <div className={styles.dashboard}>
      <div className={styles.tabBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
          onClick={() => setTab("overview")}
        >
          {t("app.stats.tabOverview")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "shotChart"}
          className={`${styles.tab} ${tab === "shotChart" ? styles.tabActive : ""}`}
          onClick={() => setTab("shotChart")}
        >
          {t("app.stats.tabShotChart")}
        </button>
      </div>

      {tab === "overview" ? (
        <>
      {/* Summary cards */}
      <div className={styles.summaryGrid}>
        {summaryCards.map(card => (
          <div key={card.label} className={styles.summaryCard}>
            <FontAwesomeIcon icon={card.icon} className={styles.summaryIcon} />
            <div className={styles.summaryValue}>{card.value}</div>
            <div className={styles.summaryLabel}>{card.label}</div>
          </div>
        ))}
      </div>

      {/* Clips by category */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t("app.stats.clipsByCategory")}</h3>
        <div className={styles.barList}>
          {byCategory.rows.map(row => (
            <div key={row.id} className={styles.barRow}>
              <span className={styles.barLabel} title={row.name}>{row.name}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{
                    width: `${byCategory.maxCount > 0 ? (row.count / byCategory.maxCount) * 100 : 0}%`,
                    backgroundColor: row.color,
                  }}
                />
              </div>
              <span className={styles.barValue}>
                {row.count} · {formatDuration(row.duration)}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* Clips by quarter */}
      {byQuarter.rows.length > 0 && (
        <section className={styles.section}>
          <h3 className={styles.sectionTitle}>{t("app.stats.byQuarter")}</h3>
          <div className={styles.barList}>
            {byQuarter.rows.map(row => (
              <div key={row.label} className={styles.barRow}>
                <span className={styles.barLabel} title={row.label}>{row.label}</span>
                <div className={styles.barTrack}>
                  <div
                    className={styles.barFill}
                    style={{
                      width: `${byQuarter.maxCount > 0 ? (row.count / byQuarter.maxCount) * 100 : 0}%`,
                      backgroundColor: "var(--color-primary)",
                    }}
                  />
                </div>
                <span className={styles.barValue}>{row.count}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Distribution across the game */}
      <section className={styles.section}>
        <h3 className={styles.sectionTitle}>{t("app.stats.distribution")}</h3>
        <div className={styles.histogram}>
          {distribution.buckets.map((value, i) => (
            <div key={`bucket-${i}`} className={styles.histColumn}>
              <div className={styles.histBarTrack}>
                <div
                  className={styles.histBar}
                  style={{
                    height: `${distribution.maxBucket > 0 ? (value / distribution.maxBucket) * 100 : 0}%`,
                  }}
                  title={t("app.stats.clipsCountLabel", { count: value })}
                />
              </div>
              <span className={styles.histLabel}>
                {formatDuration((distribution.span / NUM_BUCKETS) * i)}
              </span>
            </div>
          ))}
        </div>
      </section>
        </>
      ) : (
        <div className={styles.shotChart}>
          <div className={styles.chartFilters}>
            <label className={styles.chartFilter}>
              <span>{t("app.stats.filterPlayer")}</span>
              <select
                value={String(filterPlayer)}
                onChange={e =>
                  setFilterPlayer(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
              >
                <option value="all">{t("app.stats.allOption")}</option>
                {players.map(p => (
                  <option key={p.id} value={p.id}>
                    {p.number ? `${p.number} ${p.name}` : p.name}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.chartFilter}>
              <span>{t("app.stats.filterQuarter")}</span>
              <select
                value={filterQuarter}
                onChange={e => setFilterQuarter(e.target.value)}
              >
                <option value="all">{t("app.stats.allOption")}</option>
                {chartQuarters.map(q => (
                  <option key={q} value={q}>
                    {q}
                  </option>
                ))}
              </select>
            </label>
            <label className={styles.chartFilter}>
              <span>{t("app.stats.filterCategory")}</span>
              <select
                value={String(filterCategory)}
                onChange={e =>
                  setFilterCategory(
                    e.target.value === "all" ? "all" : Number(e.target.value)
                  )
                }
              >
                <option value="all">{t("app.stats.allOption")}</option>
                {flatCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {locatedClips.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faFilm} />
              <p>{t("app.stats.noLocatedClips")}</p>
            </div>
          ) : (
            <div className={styles.courtWrap}>
              <Court>
                {chartClips.map(c => {
                  const firstCat = parseCategoryIds(c)[0];
                  const color =
                    (firstCat != null && catColorMap.get(firstCat)) ||
                    "var(--color-primary)";
                  return (
                    <circle
                      key={c.id}
                      cx={(c.court_x as number) * COURT_VB_W}
                      cy={(c.court_y as number) * COURT_VB_H}
                      r={8}
                      fill={color}
                      fillOpacity={0.85}
                      stroke="var(--bg-main)"
                      strokeWidth={1}
                    >
                      <title>{c.title}</title>
                    </circle>
                  );
                })}
              </Court>
              {clips.length - locatedClips.length > 0 && (
                <p className={styles.unlocatedNote}>
                  {t("app.stats.unlocatedCount", {
                    count: clips.length - locatedClips.length,
                  })}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
