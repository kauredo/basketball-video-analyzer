import type { ProjectVideo } from "../../main/projectVideos";
import { isSamePath } from "../../shared/clipDrawings";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilm, faClock, faStopwatch, faTags, faImage, faFilePdf } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/StatsDashboard.module.css";
import { Court, COURT_VB_W, COURT_VB_H } from "./Court";
import { CourtClipDetail } from "./CourtClipDetail";
import { courtSvg, courtSvgHeight, CourtLegendItem } from "../../shared/courtSvg";
import { svgToPng } from "../utils/svgToPng";
import { withCause } from "../utils/errors";
import { formatDuration } from "../utils/format";
import {
  dotCategoryId,
  familyLegendRows,
  legendRows,
  sameCategoryClips,
  type CategoryFilter,
  type CourtMapCategory,
} from "../utils/courtMap";
import { categoryFamily, clipInCategory, parseIds, type CategoryNode } from "../utils/clipFilters";
import { useToastContext } from "../contexts/ToastContext";
import { Clip, Category, Player } from "../../types/global";

interface StatsDashboardProps {
  clips: Clip[];
  categories: Category[];
  videoDuration: number;
  showDistribution: boolean;
  recordingId?: number;
  recordings: ProjectVideo[];
  projectId?: number;
  // Closes Stats and seeks the main video to the clip. Absent: no button.
  onOpenClip?: (clip: Clip) => void;
}

const NUM_BUCKETS = 8;
const PRIMARY = "#0b7972";
// The exported chart is printed or pasted into slides, so it uses fixed
// light colours whatever theme the app is in.
const EXPORT_COLORS = { background: "#ffffff", lines: "#4a4a4a", text: "#1f1f1f" };

// A located clip with its category ids parsed once, for the courtMap helpers.
type MapClip = Clip & { catIds: number[] };
const toMapClip = (c: Clip): MapClip => ({ ...c, catIds: parseIds(c.categories) });
const isLocated = (c: Clip) => c.court_x != null && c.court_y != null;

const focusDot = (id: number) => {
  // After the state update, so the dot is in the DOM and no longer re-rendering.
  requestAnimationFrame(() => {
    document.querySelector<SVGGElement>(`[data-clip-id="${id}"]`)?.focus();
  });
};

export const StatsDashboard: React.FC<StatsDashboardProps> = ({
  clips,
  categories,
  videoDuration,
  showDistribution,
  recordingId,
  recordings,
  projectId,
  onOpenClip,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToastContext();
  const [tab, setTab] = useState<"overview" | "courtMap">("overview");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [filterPlayer, setFilterPlayer] = useState<number | "all">("all");
  const [filterQuarter, setFilterQuarter] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<number | "all">("all");

  const switchTab = (next: "overview" | "courtMap") => {
    setTab(next);
    setSelectedId(null);
  };

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
    clips.forEach(c => parseIds(c.categories).forEach(id => usedIds.add(id)));
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
      parseIds(c.categories).forEach(id => {
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

  const locatedClips = useMemo(() => clips.filter(isLocated).map(toMapClip), [clips]);

  // A parent category owns its subcategories' clips, as in the clip library.
  const family = useMemo(() => categoryFamily(categories as CategoryNode[]), [categories]);
  const catFilter = useMemo<CategoryFilter>(
    () =>
      filterCategory === "all"
        ? "all"
        : { id: filterCategory, ids: family.get(filterCategory) ?? new Set([filterCategory]) },
    [filterCategory, family]
  );

  // The court map's Player / Quarter / Category filters, location ignored.
  const filteredClips = useMemo(
    () =>
      clips.filter(c => {
        if (filterQuarter !== "all" && (c.quarter || "") !== filterQuarter)
          return false;
        if (filterCategory !== "all" && !clipInCategory(c, filterCategory, family))
          return false;
        if (filterPlayer !== "all" && !parseIds(c.players).includes(filterPlayer))
          return false;
        return true;
      }),
    [clips, filterQuarter, filterCategory, filterPlayer, family]
  );

  const chartClips = useMemo(
    () => filteredClips.filter(isLocated).map(toMapClip),
    [filteredClips]
  );
  // Dots carry only the clip id.
  const clipById = useMemo(() => new Map(chartClips.map(c => [c.id, c])), [chartClips]);

  const mapCategories = useMemo<CourtMapCategory[]>(
    () =>
      flatCategories
        .filter((c): c is Category & { id: number } => c.id !== undefined)
        .map(c => ({ id: c.id, name: c.name, color: c.color, parentId: c.parent_id ?? null })),
    [flatCategories]
  );
  const knownIds = useMemo(() => new Set(mapCategories.map(c => c.id)), [mapCategories]);

  // A dot category's name and colour; null (uncategorised) uses PRIMARY.
  const categoryOf = useCallback(
    (id: number | null) => {
      const cat = id === null ? undefined : mapCategories.find(c => c.id === id);
      return cat
        ? { name: cat.name, color: cat.color || PRIMARY }
        : { name: t("app.categories.noCategory"), color: PRIMARY };
    },
    [mapCategories, t]
  );

  // One dot per located clip, coloured by its dot category, and the legend's
  // non-zero rows, so the exported image matches the screen.
  const chartOf = useCallback(
    (located: MapClip[], filter: CategoryFilter) => {
      const dots = located.map(c => {
        const catId = dotCategoryId(c, filter, knownIds);
        const color = categoryOf(catId).color;
        return { clipId: c.id, catId, x: c.court_x as number, y: c.court_y as number, color, label: c.title };
      });
      const legend: CourtLegendItem[] = legendRows(located, mapCategories, filter)
        .filter(row => row.count > 0)
        .map(row => ({ color: categoryOf(row.id).color, label: categoryOf(row.id).name }));
      return { dots, legend };
    },
    [mapCategories, knownIds, categoryOf]
  );
  const chart = useMemo(() => chartOf(chartClips, catFilter), [chartOf, chartClips, catFilter]);

  // A filter or the game scope dropped the selected clip: forget it, so it
  // does not reopen and autoplay when the filter changes back.
  useEffect(() => {
    if (selectedId !== null && !clipById.has(selectedId)) setSelectedId(null);
  }, [clipById, selectedId]);
  const selected = (selectedId !== null && clipById.get(selectedId)) || null;
  // null: uncategorised. undefined: nothing selected.
  const selectedCat = selected ? dotCategoryId(selected, catFilter, knownIds) : undefined;
  const legend = useMemo(
    () => familyLegendRows(legendRows(chartClips, mapCategories, catFilter), mapCategories),
    [chartClips, mapCategories, catFilter]
  );
  const siblings = selected
    ? sameCategoryClips(chartClips, selected.id, catFilter, knownIds, c =>
        recordings.findIndex(r => isSamePath(r.video_path, c.video_path)))
    : [];

  const closeDetail = () => {
    if (selectedId === null) return;
    const id = selectedId;
    setSelectedId(null);
    focusDot(id);
  };

  // The report uses the selected game scope, independent of court map filters.
  const handleExportReport = async () => {
    if (!projectId) return;
    const catName = new Map(flatCategories.map(c => [c.id, c.name]));
    const playerLabel = new Map(players.map(p => [p.id, p.number ? `${p.number} ${p.name}` : p.name]));
    const playerCounts = new Map<number, number>();
    clips.forEach(c => parseIds(c.players).forEach(id => playerCounts.set(id, (playerCounts.get(id) ?? 0) + 1)));
    const { dots, legend } = chartOf(locatedClips, "all");
    try {
      const result = await window.electronAPI.exportScoutingReport({
        projectId,
        recordingId,
        dots,
        legend,
        report: {
          labels: {
            title: t("app.stats.reportTitle"),
            madeWith: t("app.stats.reportMadeWith", { date: new Date().toLocaleDateString() }),
            totalClips: t("app.stats.totalClips"),
            totalDuration: t("app.stats.totalDuration"),
            avgDuration: t("app.stats.avgDuration"),
            categoriesUsed: t("app.stats.categoriesUsed"),
            clipsByCategory: t("app.stats.clipsByCategory"),
            byQuarter: t("app.stats.byQuarter"),
            byPlayer: t("app.stats.reportByPlayer"),
            shotChart: t("app.stats.tabCourtMap"),
            noLocatedClips: t("app.stats.reportNoLocated"),
            clipList: t("app.stats.reportClipList"),
            time: t("app.stats.reportTime"),
            clip: t("app.clips.table.columnTitle"),
            categories: t("app.stats.reportCategories"),
            players: t("app.stats.reportPlayers"),
            quarter: t("app.stats.filterQuarter"),
            notes: t("app.clips.table.columnNotes"),
          },
          data: {
            videoName: t("app.projects.allGames"),
            summary: {
              clips: String(summary.count),
              totalDuration: formatDuration(summary.totalDuration),
              avgDuration: formatDuration(summary.avgDuration),
              categoriesUsed: String(summary.categoriesUsed),
            },
            byCategory: byCategory.rows.map(r => ({ name: r.name, color: r.color, count: r.count, duration: formatDuration(r.duration) })),
            byQuarter: byQuarter.rows,
            byPlayer: [...playerCounts.entries()]
              .filter(([id]) => playerLabel.has(id))
              .map(([id, count]) => ({ label: playerLabel.get(id)!, count }))
              .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
            clips: [...clips]
              .sort((a, b) => a.start_time - b.start_time)
              .map(c => ({
                time: formatDuration(c.start_time),
                title: recordingId === undefined && recordings.length > 1
                  ? `${c.title} · ${recordings.find(video => isSamePath(video.video_path, c.video_path))?.video_name ?? ""}`
                  : c.title,
                categories: parseIds(c.categories).map(id => catName.get(id)).filter(Boolean).join(", "),
                players: parseIds(c.players).map(id => playerLabel.get(id)).filter(Boolean).join(", "),
                quarter: c.quarter ?? "",
                notes: c.notes ?? "",
              })),
          },
        },
      });
      if (result) showSuccess(t("app.stats.reportSuccess", { path: result.filePath }));
    } catch (error) {
      console.error("Error exporting scouting report:", error);
      showError(withCause(t("app.stats.reportError"), error));
    }
  };

  const handleSaveChartImage = async () => {
    if (!projectId) return;
    try {
      const svg = courtSvg(chart.dots, { ...EXPORT_COLORS, legend: chart.legend });
      const png = await svgToPng(svg, COURT_VB_W, courtSvgHeight(chart.legend.length));
      const result = await window.electronAPI.saveShotChart({ projectId, png });
      if (result) showSuccess(t("app.stats.saveChartImageSuccess", { path: result.filePath }));
    } catch (error) {
      console.error("Error saving court map:", error);
      showError(withCause(t("app.stats.saveChartImageError"), error));
    }
  };

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
      <div className={styles.tabRow}>
      <div className={styles.tabBar} role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "overview"}
          className={`${styles.tab} ${tab === "overview" ? styles.tabActive : ""}`}
          onClick={() => switchTab("overview")}
        >
          {t("app.stats.tabOverview")}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "courtMap"}
          className={`${styles.tab} ${tab === "courtMap" ? styles.tabActive : ""}`}
          onClick={() => switchTab("courtMap")}
        >
          {t("app.stats.tabCourtMap")}
        </button>
      </div>
        <button type="button" className={styles.chartAction} onClick={handleExportReport}>
          <FontAwesomeIcon icon={faFilePdf} /> {t("app.stats.exportReport")}
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

      {/* Distribution across the game */}
      {showDistribution && <section className={styles.section}>
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
      </section>}
        </>
      ) : (
        <div className={styles.courtMap}>
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
            <button
              type="button"
              className={styles.chartAction}
              onClick={handleSaveChartImage}
              disabled={chart.dots.length === 0}
            >
              <FontAwesomeIcon icon={faImage} /> {t("app.stats.saveChartImage")}
            </button>
          </div>

          {locatedClips.length === 0 ? (
            <div className={styles.emptyState}>
              <FontAwesomeIcon icon={faFilm} />
              <p>{t("app.stats.noLocatedClips")}</p>
            </div>
          ) : (
            <div
              className={`${styles.courtMapBody} ${selected ? styles.courtMapBodySplit : ""}`}
              onKeyDown={e => {
                if (e.key === "Escape" && selected) {
                  // Stops App's modal handler too, so Stats stays open.
                  e.stopPropagation();
                  closeDetail();
                }
              }}
            >
              {selected && (
                <CourtClipDetail
                  clip={selected}
                  categoryName={categoryOf(selectedCat ?? null).name}
                  categoryColor={categoryOf(selectedCat ?? null).color}
                  players={players}
                  siblings={siblings}
                  onSelect={setSelectedId}
                  onClose={closeDetail}
                  onOpenInMainVideo={onOpenClip}
                />
              )}
              <div className={styles.courtWrap}>
                <ul className={styles.legend}>
                  {legend.map(row => {
                    const cat = categoryOf(row.id);
                    const hollow = selectedCat !== undefined && row.id !== selectedCat;
                    return (
                      <li
                        key={row.id ?? "none"}
                        className={`${styles.legendItem} ${row.parentId !== null ? styles.legendSub : ""}`}
                      >
                        <span
                          className={`${styles.legendSwatch} ${hollow ? styles.legendSwatchHollow : ""}`}
                          style={hollow ? undefined : { backgroundColor: cat.color }}
                        />
                        {cat.name} <span className={styles.legendCount}>{row.count}</span>
                      </li>
                    );
                  })}
                  <li className={`${styles.legendItem} ${styles.legendTotal}`}>
                    {t("app.stats.onCourt", { shown: chartClips.length, total: filteredClips.length })}
                  </li>
                </ul>
                <div className={styles.courtBox}>
                <Court ariaLabel={t("app.stats.tabCourtMap")}>
                  {/* The focusable dots never change order: a moved node loses
                      focus, and Enter on a dot would drop it to <body>. */}
                  <g>
                  {chart.dots.map(d => {
                      const clip = clipById.get(d.clipId);
                      if (!clip) return null;
                      const cx = d.x * COURT_VB_W;
                      const cy = d.y * COURT_VB_H;
                      const isSelected = clip.id === selectedId;
                      const hollow = selectedCat !== undefined && d.catId !== selectedCat;
                      const base = `${clip.title}, ${categoryOf(d.catId).name}`;
                      return (
                        <g
                          key={clip.id}
                          data-clip-id={clip.id}
                          role="button"
                          tabIndex={0}
                          className={styles.dot}
                          aria-label={isSelected ? t("app.stats.dotPlaying", { label: base }) : base}
                          aria-pressed={isSelected}
                          onClick={() => setSelectedId(clip.id)}
                          onKeyDown={e => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              setSelectedId(clip.id);
                            }
                            // Keep Space/Z/M/1-9/Cmd+1/Cmd+2 away from VideoPlayer's
                            // and App's document listeners. Tab must move focus;
                            // Escape bubbles to the body handler, then App's modal.
                            if (e.key !== "Tab" && e.key !== "Escape") e.stopPropagation();
                          }}
                        >
                          <circle cx={cx} cy={cy} r={14} className={styles.dotHit} />
                          {hollow ? (
                            <circle cx={cx} cy={cy} r={8} className={styles.dotHollow} />
                          ) : (
                            <circle
                              cx={cx}
                              cy={cy}
                              r={8}
                              fill={d.color}
                              fillOpacity={0.85}
                              stroke="var(--bg-main)"
                              strokeWidth={1}
                            />
                          )}
                          <circle cx={cx} cy={cy} r={12} className={styles.dotFocus} />
                          <title>{clip.title}</title>
                        </g>
                      );
                    })}
                  </g>
                  {/* The selected category redrawn on top, so the hollow rings
                      never cover it. Not interactive: clicks reach the dots below. */}
                  {selectedCat !== undefined && (
                    <g className={styles.dotOverlay} aria-hidden="true">
                      {chart.dots
                        .filter(d => d.catId === selectedCat)
                        .map(d => {
                          const cx = d.x * COURT_VB_W;
                          const cy = d.y * COURT_VB_H;
                          return (
                            <g key={d.clipId}>
                              <circle
                                cx={cx}
                                cy={cy}
                                r={8}
                                fill={d.color}
                                fillOpacity={0.85}
                                stroke="var(--bg-main)"
                                strokeWidth={1}
                              />
                              {d.clipId === selectedId && (
                                <circle cx={cx} cy={cy} r={12} className={styles.dotSelected} />
                              )}
                            </g>
                          );
                        })}
                    </g>
                  )}
                </Court>
                </div>
                {!selected && <p className={styles.courtHint}>{t("app.stats.courtMapHint")}</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
