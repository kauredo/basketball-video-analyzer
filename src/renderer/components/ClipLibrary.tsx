import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDismissableMenu } from "../hooks/useDismissableMenu";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilm,
  faFolder,
  faFileExport,
  faSpinner,
  faPlay,
  faTrash,
  faCalendar,
  faClock,
  faShare,
  faVideo,
  faSort,
  faSortUp,
  faSortDown,
  faSearch,
  faChevronDown,
  faTable,
  faVideo as faVideoFile,
  faFloppyDisk,
  faFileCode,
  faPlayCircle,
  faTableCells,
  faList,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ClipLibrary.module.css";
import { useToastContext } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { ContextualHint } from "./ContextualHint";
import { PresentMode } from "./PresentMode";
import { ClipTable } from "./ClipTable";
import { loadPref, savePref, STORAGE_KEYS } from "../utils/storage";
import {
  CLIP_STATUSES,
  DONATION_NUDGE_THRESHOLD,
  statusLabelKey,
} from "../utils/constants";
import { formatVideoSrc } from "../utils/paths";
import { Player, ClipStatus } from "../../types/global";
import { inkOn } from "../utils/contrast";
import { withCause } from "../utils/errors";

// Parse a clip's JSON player-ID array, tolerating malformed values.
const parsePlayerIds = (playersJson?: string): number[] => {
  try {
    const ids = JSON.parse(playersJson || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

export interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
  parent_id?: number;
  children?: Category[];
}

export interface Clip {
  id: number;
  video_path: string;
  output_path: string;
  thumbnail_path?: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  categories: string; // JSON array of category IDs
  players?: string; // JSON array of player IDs
  quarter?: string | null;
  notes?: string;
  status?: ClipStatus | null;
  created_at: string;
}

interface ClipLibraryProps {
  onRefresh: number; // Trigger refresh when this changes
  currentProject: any | null;
  /** Ask the side panel for at least this many pixels. */
  onRequestWidth?: (minimum: number) => void;
}

/** What the clip table needs before its play calls stop truncating. Measured:
    the table's own floor is 737px and the panel's chrome takes another 35. */
const TABLE_MIN_PANEL_WIDTH = 790;

export const ClipLibrary: React.FC<ClipLibraryProps> = ({
  onRefresh,
  currentProject,
  onRequestWidth,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError, showWarning, showInfo } = useToastContext();
  const { confirm } = useConfirm();

  // Track total clips exported; nudge once toward supporting the project after
  // the user has clearly gotten value from it. Never blocks anything.
  const recordExportedClips = (count: number) => {
    const total = loadPref(STORAGE_KEYS.EXPORTED_CLIPS_TOTAL, 0) + count;
    savePref(STORAGE_KEYS.EXPORTED_CLIPS_TOTAL, total);
    if (
      total >= DONATION_NUDGE_THRESHOLD &&
      !loadPref(STORAGE_KEYS.DONATION_NUDGE_SHOWN, false)
    ) {
      savePref(STORAGE_KEYS.DONATION_NUDGE_SHOWN, true);
      showInfo(
        t("app.donation.nudge", { count: DONATION_NUDGE_THRESHOLD }),
        12000
      );
    }
  };
  const [clips, setClips] = useState<Clip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "duration" | "title">(() => loadPref(STORAGE_KEYS.CLIP_SORT_BY, "date") as "date" | "duration" | "title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => loadPref(STORAGE_KEYS.CLIP_SORT_ORDER, "desc") as "asc" | "desc");
  const [isExporting, setIsExporting] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [showPresent, setShowPresent] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState<ClipStatus | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "table">(
    () => loadPref(STORAGE_KEYS.CLIP_VIEW_MODE, "grid") as "grid" | "table"
  );
  const exportMenuRef = useRef<HTMLDivElement>(null);

  const changeViewMode = (mode: "grid" | "table") => {
    setViewMode(mode);
    savePref(STORAGE_KEYS.CLIP_VIEW_MODE, mode);
    if (mode === "table") onRequestWidth?.(TABLE_MIN_PANEL_WIDTH);
  };

  // Shared with the transport popovers, so Escape closes all of them alike.
  useDismissableMenu(
    exportMenuOpen,
    useCallback(() => setExportMenuOpen(false), []),
    [exportMenuRef],
  );

  useEffect(() => {
    loadData();
  }, [onRefresh, currentProject]);

  const loadData = async () => {
    try {
      if (!currentProject) return;

      const [clipsData, categoriesData, playersData] = await Promise.all([
        window.electronAPI.getClips(currentProject.id),
        window.electronAPI.getCategoriesHierarchical(currentProject.id),
        window.electronAPI.getPlayers(currentProject.id),
      ]);

      setClips(clipsData);
      setCategories(categoriesData);
      setPlayers(playersData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const filteredClips = useMemo(() => {
    const term = searchTerm.toLowerCase();
    return clips.filter(clip => {
      const matchesSearch =
        clip.title.toLowerCase().includes(term) ||
        clip.notes?.toLowerCase().includes(term);

      let matchesCategory = true;
      if (selectedCategory) {
        try {
          matchesCategory = JSON.parse(clip.categories || "[]").includes(selectedCategory);
        } catch {
          matchesCategory = false;
        }
      }

      const matchesPlayer = !selectedPlayer || parsePlayerIds(clip.players).includes(selectedPlayer);

      const matchesStatus = !selectedStatus || clip.status === selectedStatus;

      return matchesSearch && matchesCategory && matchesPlayer && matchesStatus;
    });
  }, [clips, searchTerm, selectedCategory, selectedPlayer, selectedStatus]);

  const sortedClips = useMemo(() => {
    return [...filteredClips].sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case "date":
          comparison =
            new Date(b.created_at || 0).getTime() -
            new Date(a.created_at || 0).getTime();
          break;
        case "duration":
          comparison =
            b.end_time - b.start_time - (a.end_time - a.start_time);
          break;
        case "title":
          comparison = a.title.localeCompare(b.title);
          break;
      }
      return sortOrder === "asc" ? -comparison : comparison;
    });
  }, [filteredClips, sortBy, sortOrder]);

  const toggleSort = (field: "date" | "duration" | "title") => {
    if (sortBy === field) {
      const newOrder = sortOrder === "asc" ? "desc" : "asc";
      setSortOrder(newOrder);
      savePref(STORAGE_KEYS.CLIP_SORT_ORDER, newOrder);
    } else {
      setSortBy(field);
      setSortOrder("desc");
      savePref(STORAGE_KEYS.CLIP_SORT_BY, field);
      savePref(STORAGE_KEYS.CLIP_SORT_ORDER, "desc");
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getClipCategories = (clip: Clip): Category[] => {
    try {
      const categoryIds = JSON.parse(clip.categories);
      return categories.filter(cat => categoryIds.includes(cat.id));
    } catch {
      return [];
    }
  };

  const handlePlayClip = async (clipPath: string) => {
    try {
      await window.electronAPI.playClip(clipPath);
    } catch (error) {
      console.error("Error playing clip:", error);
      showError(withCause(t("app.clips.errorPlayingClip"), error));
    }
  };

  const handleDeleteClip = async (clipId: number) => {
    if (!(await confirm({ message: t("app.clips.confirmDeleteClip"), danger: true }))) {
      return;
    }

    try {
      await window.electronAPI.deleteClip(clipId);
      await loadData();
    } catch (error) {
      console.error("Error deleting clip:", error);
      showError(withCause(t("app.clips.errorDeletingClip"), error));
    }
  };

  // The first renderer caller of updateClip. Local state is patched rather than
  // reloading everything: a reload would refetch clips, categories and players
  // over IPC on every committed edit. The catch resyncs, so a rejected write
  // never leaves a value on screen that the database does not hold.
  const handleUpdateClip = async (id: number, updates: Partial<Clip>) => {
    try {
      await window.electronAPI.updateClip(id, updates);
      setClips(prev => prev.map(c => (c.id === id ? { ...c, ...updates } : c)));
    } catch (error) {
      console.error("Error updating clip:", error);
      showError(withCause(t("app.clips.table.saveError"), error));
      await loadData();
    }
  };

  const handleUpdateEach = async (
    entries: Array<{ id: number; updates: Partial<Clip> }>
  ) => {
    // allSettled, not all: one clip that fails to write must not abort the
    // other nineteen, and the count reported has to be the count that landed.
    const results = await Promise.allSettled(
      entries.map(entry => window.electronAPI.updateClip(entry.id, entry.updates))
    );
    const failed = results.filter(r => r.status === "rejected").length;
    const applied = new Map(
      entries
        .filter((_, i) => results[i].status === "fulfilled")
        .map(entry => [entry.id, entry.updates])
    );
    setClips(prev =>
      prev.map(c => (applied.has(c.id) ? { ...c, ...applied.get(c.id) } : c))
    );

    if (failed > 0) {
      showWarning(
        t("app.clips.table.bulkPartialFailure", {
          done: entries.length - failed,
          total: entries.length,
          failed,
        })
      );
    } else {
      showSuccess(t("app.clips.table.bulkUpdateSuccess", { count: entries.length }));
    }
  };

  const handleDeleteMany = async (ids: number[]) => {
    if (
      !(await confirm({
        message: t("app.clips.table.confirmBulkDelete", { count: ids.length }),
        danger: true,
      }))
    ) {
      return;
    }

    const results = await Promise.allSettled(
      ids.map(id => window.electronAPI.deleteClip(id))
    );
    const failed = results.filter(r => r.status === "rejected").length;
    if (failed > 0) {
      showWarning(
        t("app.clips.table.bulkPartialFailure", {
          done: ids.length - failed,
          total: ids.length,
          failed,
        })
      );
    } else {
      showSuccess(t("app.clips.table.bulkDeleteSuccess", { count: ids.length }));
    }
    await loadData();
  };

  const handleExportCategory = async () => {
    if (selectedCategory === null || filteredClips.length === 0) {
      showWarning(t("app.clips.selectCategoryToExport"));
      return;
    }

    try {
      setIsExporting(true);

      // Get clips for the selected category
      const clipsToExport = filteredClips.filter(clip => {
        try {
          const clipCategories = JSON.parse(clip.categories);
          return clipCategories.includes(selectedCategory);
        } catch {
          return false;
        }
      });

      if (clipsToExport.length === 0) {
        showWarning(t("app.clips.noClipsInCategoryToExport"));
        return;
      }

      console.log("Attempting to export clips:", {
        categoryId: selectedCategory,
        clipsToExport: clipsToExport.map(c => ({
          id: c.id,
          title: c.title,
          path: c.output_path,
        })),
      });

      const result = await window.electronAPI.exportClipsByCategory({
        categoryIds: [selectedCategory],
        clips: clipsToExport.map(clip => ({
          id: clip.id,
          title: clip.title,
          output_path: clip.output_path,
          categories: clip.categories,
        })),
      });

      if (!result || typeof result.count !== "number") {
        throw new Error("Invalid export result received");
      }

      if (result.count === 0) {
        console.error("Export returned 0 clips. Export result:", result);
        showWarning(t("app.clips.exportNoneWarning"));
      } else {
        showSuccess(t("app.clips.exportSuccess", { count: result.count, dir: result.exportDir }));
        recordExportedClips(result.count);
      }
    } catch (error) {
      console.error("Error exporting clips:", error);
      showError(t("app.clips.exportErrorGeneric", { error: error instanceof Error ? error.message : "Unknown error" }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (filteredClips.length === 0) {
      showWarning(t("app.clips.noClipsToExport"));
      return;
    }

    try {
      setIsExporting(true);

      // Get all unique category IDs and their clips
      const categoryClips = new Map<number, Clip[]>();

      filteredClips.forEach(clip => {
        try {
          const clipCategories = JSON.parse(clip.categories);
          clipCategories.forEach((catId: number) => {
            const existing = categoryClips.get(catId) || [];
            categoryClips.set(catId, [...existing, clip]);
          });
        } catch {
          console.warn("Failed to parse categories for clip:", clip.id);
        }
      });

      const categoryIds = Array.from(categoryClips.keys());

      if (categoryIds.length === 0) {
        showWarning(t("app.clips.noCategoriesInClips"));
        return;
      }

      console.log("Attempting to export all clips:", {
        categories: categoryIds,
        clipsInfo: Array.from(categoryClips.entries()).map(
          ([catId, clips]) => ({
            categoryId: catId,
            clips: clips.map(c => ({
              id: c.id,
              title: c.title,
              path: c.output_path,
            })),
          })
        ),
      });

      const result = await window.electronAPI.exportClipsByCategory({
        categoryIds,
        clips: filteredClips.map(clip => ({
          id: clip.id,
          title: clip.title,
          output_path: clip.output_path,
          categories: clip.categories,
        })),
      });

      if (!result || typeof result.count !== "number") {
        throw new Error("Invalid export result received");
      }

      if (result.count === 0) {
        console.error("Export returned 0 clips. Export result:", result);
        const allClips = Array.from(categoryClips.values()).flat();

        showWarning(t("app.clips.exportNoneWarning"));
      } else {
        showSuccess(t("app.clips.exportSuccess", { count: result.count, dir: result.exportDir }));
        recordExportedClips(result.count);
      }
    } catch (error) {
      console.error("Error exporting clips:", error);
      showError(t("app.clips.exportErrorGeneric", { error: error instanceof Error ? error.message : "Unknown error" }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportData = async () => {
    if (!currentProject) return;

    try {
      setIsExporting(true);
      const result = await window.electronAPI.exportClipsData(currentProject.id);
      if (result) {
        showSuccess(t("app.clips.exportDataSuccess", { count: result.count, path: result.filePath }));
      }
    } catch (error) {
      console.error("Error exporting clips data:", error);
      showError(withCause(t("app.clips.exportDataError"), error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportXml = async () => {
    if (!currentProject) return;

    try {
      setIsExporting(true);
      const result = await window.electronAPI.exportClipsXml(currentProject.id);
      if (result) {
        showSuccess(t("app.clips.exportDataSuccess", { count: result.count, path: result.filePath }));
      }
    } catch (error) {
      console.error("Error exporting Sportscode XML:", error);
      showError(withCause(t("app.clips.exportDataError"), error));
    } finally {
      setIsExporting(false);
    }
  };

  const handleSaveSession = async () => {
    if (!currentProject) return;

    try {
      setIsExporting(true);
      const result = await window.electronAPI.saveSession(currentProject.id);
      if (result) {
        showSuccess(t("app.clips.saveSessionSuccess"));
      }
    } catch (error) {
      console.error("Error saving session:", error);
      showError(withCause(t("app.clips.saveSessionError"), error));
    } finally {
      setIsExporting(false);
    }
  };

  const openClipFolder = async () => {
    try {
      await window.electronAPI.openClipFolder();
    } catch (error) {
      console.error("Error opening clip folder:", error);
    }
  };

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : t("app.clips.unknown");
  };

  const getClipStats = () => {
    const totalDuration = filteredClips.reduce(
      (sum, clip) => sum + clip.duration,
      0
    );
    return {
      count: filteredClips.length,
      totalDuration: formatTime(totalDuration),
      avgDuration:
        filteredClips.length > 0
          ? formatTime(totalDuration / filteredClips.length)
          : "0:00",
    };
  };

  const stats = getClipStats();

  return (
    <div className={styles.clipLibrary}>
      {/* Fixed Header */}
      <div className={styles.clipLibraryHeader}>
        <h3>
          <FontAwesomeIcon icon={faFilm} /> {t("app.clips.library")}
        </h3>
        {currentProject && (
          <div className={styles.projectInfo}>
            <span className={styles.projectName}>{currentProject.name}</span>
            <span className={styles.projectDetails}>
              {t("app.clips.clipsSummary", { count: clips.length, video: currentProject.video_name })}
            </span>
          </div>
        )}
        <div className={styles.libraryActions}>
          <div className={styles.viewToggle} role="group" aria-label={t("app.clips.library")}>
            <button
              type="button"
              onClick={() => changeViewMode("grid")}
              aria-pressed={viewMode === "grid"}
              className={`${styles.viewToggleBtn} ${
                viewMode === "grid" ? styles.viewToggleActive : ""
              }`}
            >
              <FontAwesomeIcon icon={faTableCells} />{" "}
              {t("app.clips.table.viewGrid")}
            </button>
            <button
              type="button"
              onClick={() => changeViewMode("table")}
              aria-pressed={viewMode === "table"}
              className={`${styles.viewToggleBtn} ${
                viewMode === "table" ? styles.viewToggleActive : ""
              }`}
            >
              <FontAwesomeIcon icon={faList} /> {t("app.clips.table.viewTable")}
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowPresent(true)}
            disabled={sortedClips.length === 0}
            className={styles.presentBtn}
          >
            <FontAwesomeIcon icon={faPlayCircle} /> {t("app.present.present")}
          </button>
          <button
            type="button"
            onClick={openClipFolder}
            className={styles.folderBtn}
          >
            <FontAwesomeIcon icon={faFolder} /> {t("app.clips.openFolder")}
          </button>
          <div className={styles.exportDropdown} ref={exportMenuRef}>
            <button
              type="button"
              onClick={() => setExportMenuOpen(prev => !prev)}
              disabled={isExporting || clips.length === 0}
              className={styles.exportBtn}
              aria-expanded={exportMenuOpen}
              aria-haspopup="true"
            >
              {isExporting ? (
                <>
                  <FontAwesomeIcon icon={faSpinner} spin />{" "}
                  {t("app.clips.exportingClips")}
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faFileExport} /> {t("app.clips.export")}{" "}
                  <FontAwesomeIcon icon={faChevronDown} className={styles.exportChevron} />
                </>
              )}
            </button>
            {exportMenuOpen && (
              <div className={styles.exportMenu} role="menu">
                <button
                  type="button"
                  role="menuitem"
                  className={styles.exportMenuItem}
                  disabled={filteredClips.length === 0}
                  onClick={() => {
                    setExportMenuOpen(false);
                    selectedCategory ? handleExportCategory() : handleExportAll();
                  }}
                >
                  <FontAwesomeIcon icon={faVideoFile} />
                  {t("app.clips.exportVideoFiles")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.exportMenuItem}
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportData();
                  }}
                >
                  <FontAwesomeIcon icon={faTable} />
                  {t("app.clips.exportCsvJson")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.exportMenuItem}
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleSaveSession();
                  }}
                >
                  <FontAwesomeIcon icon={faFloppyDisk} />
                  {t("app.clips.saveSession")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className={styles.exportMenuItem}
                  onClick={() => {
                    setExportMenuOpen(false);
                    handleExportXml();
                  }}
                >
                  <FontAwesomeIcon icon={faFileCode} />
                  {t("app.clips.exportSportscode")}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Scrollable Content */}
      <div className={styles.clipLibraryContent}>
        {!currentProject ? (
          <div className={styles.emptyState}>
            <div>
              <h4>
                <FontAwesomeIcon icon={faVideo} /> {t("app.clips.noProjectLoaded")}
              </h4>
              <p>{t("app.clips.selectVideoToStart")}</p>
            </div>
          </div>
        ) : (
          <>
            {/* Category Filter */}
            <div className={styles.categoryFilterSection}>
              <h4>{t("app.clips.filterByCategory")}</h4>
              <div className={styles.filterButtons}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  className={`${styles.filterBtn} ${
                    selectedCategory === null ? styles.active : ""
                  }`}
                >
                  {t("app.clips.all")} ({clips.length})
                </button>
                {categories
                  .filter(category => !category.parent_id) // Only show parent categories
                  .map(category => {
                    const count = clips.filter(clip => {
                      try {
                        const clipCategories = JSON.parse(clip.categories);
                        return clipCategories.includes(category.id);
                      } catch {
                        return false;
                      }
                    }).length;

                    return (
                      <div key={category.id} className={styles.categoryGroup}>
                        <button
                          type="button"
                          onClick={() => setSelectedCategory(category.id)}
                          className={`${styles.filterBtn} ${
                            selectedCategory === category.id
                              ? styles.active
                              : ""
                          }`}
                          style={{
                            borderColor: category.color,
                            backgroundColor:
                              selectedCategory === category.id
                                ? category.color
                                : "transparent",
                            color:
                              selectedCategory === category.id
                                ? "var(--text-white)"
                                : "var(--text-primary)",
                          }}
                        >
                          {category.name} ({count})
                        </button>

                        {/* Show subcategories if parent is selected OR if any subcategory is selected */}
                        {(selectedCategory === category.id ||
                          (category.children &&
                            category.children.some(
                              child => child.id === selectedCategory
                            ))) &&
                          category.children &&
                          category.children.length > 0 && (
                            <div className={styles.subcategoryButtons}>
                              {category.children.map(
                                (subcategory: Category) => {
                                  const subCount = clips.filter(clip => {
                                    try {
                                      const clipCategories = JSON.parse(
                                        clip.categories
                                      );
                                      return clipCategories.includes(
                                        subcategory.id
                                      );
                                    } catch {
                                      return false;
                                    }
                                  }).length;

                                  return (
                                    <button
                                      type="button"
                                      key={subcategory.id}
                                      onClick={() =>
                                        setSelectedCategory(subcategory.id)
                                      }
                                      className={`${styles.filterBtn} ${
                                        styles.subcategoryBtn
                                      } ${
                                        selectedCategory === subcategory.id
                                          ? styles.active
                                          : ""
                                      }`}
                                      style={{
                                        borderColor: subcategory.color,
                                        backgroundColor:
                                          selectedCategory === subcategory.id
                                            ? subcategory.color
                                            : "transparent",
                                        color:
                                          selectedCategory === subcategory.id
                                            ? "var(--text-white)"
                                            : "var(--text-primary)",
                                      }}
                                    >
                                      {subcategory.name} ({subCount})
                                    </button>
                                  );
                                }
                              )}
                            </div>
                          )}
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* Player Filter */}
            {players.length > 0 && (
              <div className={styles.categoryFilterSection}>
                <h4>{t("app.clips.filterByPlayer")}</h4>
                <div className={styles.filterButtons}>
                  <button
                    type="button"
                    onClick={() => setSelectedPlayer(null)}
                    className={`${styles.filterBtn} ${
                      selectedPlayer === null ? styles.active : ""
                    }`}
                  >
                    {t("app.clips.all")} ({clips.length})
                  </button>
                  {players.map(player => {
                    const count = clips.filter(clip =>
                      parsePlayerIds(clip.players).includes(player.id)
                    ).length;
                    return (
                      <button
                        type="button"
                        key={player.id}
                        onClick={() => setSelectedPlayer(player.id)}
                        className={`${styles.filterBtn} ${
                          selectedPlayer === player.id ? styles.active : ""
                        }`}
                      >
                        {player.number ? `#${player.number} ` : ""}
                        {player.name} ({count})
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Status Filter. Only once a status exists, so a project that
                never uses one does not pay a row of vertical space for it. */}
            {clips.some(clip => clip.status) && (
            <div className={styles.categoryFilterSection}>
              <h4>{t("app.clips.table.filterByStatus")}</h4>
              <div className={styles.filterButtons}>
                <button
                  type="button"
                  onClick={() => setSelectedStatus(null)}
                  className={`${styles.filterBtn} ${
                    selectedStatus === null ? styles.active : ""
                  }`}
                >
                  {t("app.clips.all")} ({clips.length})
                </button>
                {CLIP_STATUSES.map(status => {
                  const count = clips.filter(clip => clip.status === status).length;
                  return (
                    <button
                      type="button"
                      key={status}
                      onClick={() => setSelectedStatus(status)}
                      className={`${styles.filterBtn} ${
                        selectedStatus === status ? styles.active : ""
                      }`}
                    >
                      {t(statusLabelKey(status))} ({count})
                    </button>
                  );
                })}
              </div>
            </div>
            )}

            {/* Stats */}
            <div className={styles.libraryStats}>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t("app.clips.clipsCount")}:</span>
                <span className={styles.statValue}>{stats.count}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t("app.clips.totalDuration")}:</span>
                <span className={styles.statValue}>{stats.totalDuration}</span>
              </div>
              <div className={styles.statItem}>
                <span className={styles.statLabel}>{t("app.clips.avgDuration")}:</span>
                <span className={styles.statValue}>{stats.avgDuration}</span>
              </div>
            </div>

            {/* Search and Sort Controls */}
            <div className={styles.searchAndSortContainer}>
              <div className={styles.searchContainer}>
                <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} />
                <input
                  type="text"
                  placeholder={t("app.library.searchPlaceholder")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
                  aria-label={t("app.library.searchPlaceholder")}
                />
              </div>

              <div className={styles.sortControls}>
                <button
                  className={`${styles.sortButton} ${
                    sortBy === "date" ? styles.activeSort : ""
                  }`}
                  onClick={() => toggleSort("date")}
                >
                  {t("app.clips.date")}
                  {sortBy === "date" && (
                    <FontAwesomeIcon
                      icon={sortOrder === "asc" ? faSortUp : faSortDown}
                    />
                  )}
                </button>
                <button
                  className={`${styles.sortButton} ${
                    sortBy === "duration" ? styles.activeSort : ""
                  }`}
                  onClick={() => toggleSort("duration")}
                >
                  {t("app.clips.sortDuration")}
                  {sortBy === "duration" && (
                    <FontAwesomeIcon
                      icon={sortOrder === "asc" ? faSortUp : faSortDown}
                    />
                  )}
                </button>
                <button
                  className={`${styles.sortButton} ${
                    sortBy === "title" ? styles.activeSort : ""
                  }`}
                  onClick={() => toggleSort("title")}
                >
                  {t("app.clips.sortTitle")}
                  {sortBy === "title" && (
                    <FontAwesomeIcon
                      icon={sortOrder === "asc" ? faSortUp : faSortDown}
                    />
                  )}
                </button>
              </div>
            </div>

            {/* First clip hint */}
            {clips.length === 1 && (
              <ContextualHint
                hintId="first-clip"
                message={t("app.hints.firstClip")}
              />
            )}

            {/* Nudge toward exporting once a few clips exist */}
            {clips.length >= 3 && (
              <ContextualHint
                hintId="first-export"
                message={t("app.hints.firstExport")}
              />
            )}

            {/* Clips, as cards or as the editable table */}
            {viewMode === "table" && sortedClips.length > 0 ? (
              <ClipTable
                clips={sortedClips}
                categories={categories}
                sortBy={sortBy}
                sortOrder={sortOrder}
                onToggleSort={toggleSort}
                onPlay={handlePlayClip}
                onUpdate={handleUpdateClip}
                onUpdateEach={handleUpdateEach}
                onDeleteMany={handleDeleteMany}
              />
            ) : (
            <div className={styles.clipsGrid}>
              {sortedClips.length === 0 ? (
                <div className={styles.emptyState}>
                  {selectedCategory === null ? (
                    <div>
                      <h4>
                        <FontAwesomeIcon icon={faFilm} />{" "}
                        {t("app.clips.noClipsYet")}
                      </h4>
                      <p>
                        {t("app.clips.startCuttingClips")}
                      </p>
                    </div>
                  ) : (
                    <div>
                      <h4>
                        <FontAwesomeIcon icon={faFilm} />{" "}
                        {t("app.clips.noClipsInCategory")}{" "}
                        {getCategoryName(selectedCategory)}
                      </h4>
                      <p>{t("app.clips.createClipsInCategory")}</p>
                    </div>
                  )}
                </div>
              ) : (
                sortedClips.map(clip => {
                  const clipCategories = getClipCategories(clip);
                  const createdDate = new Date(
                    clip.created_at
                  ).toLocaleDateString();

                  return (
                    <div key={clip.id} className={styles.clipCard}>
                      {/* Clip Thumbnail */}
                      <div className={styles.clipThumbnail}>
                        {clip.thumbnail_path ? (
                          <img
                            src={formatVideoSrc(clip.thumbnail_path)}
                            alt={clip.title}
                            className={styles.thumbnailImage}
                          />
                        ) : (
                          <div className={styles.thumbnailPlaceholder}>
                            <span className={styles.playIcon}>▶️</span>
                          </div>
                        )}
                        <div className={styles.clipDuration}>
                          {formatTime(clip.duration)}
                        </div>
                      </div>

                      {/* Clip Info */}
                      <div className={styles.clipInfo}>
                        <h4 className={styles.clipTitle}>{clip.title}</h4>

                        {/* Categories */}
                        <div className={styles.clipCategories}>
                          {clipCategories.map(category => (
                            <span
                              key={category.id}
                              className={styles.categoryTag}
                              style={{ backgroundColor: category.color, color: inkOn(category.color) }}
                            >
                              {category.name}
                            </span>
                          ))}
                        </div>

                        {/* Notes */}
                        {clip.notes && (
                          <div className={styles.clipNotes}>{clip.notes}</div>
                        )}

                        {/* Metadata */}
                        <div className={styles.clipMetadata}>
                          <span>
                            <FontAwesomeIcon icon={faCalendar} /> {createdDate}
                          </span>
                          <span>
                            <FontAwesomeIcon icon={faClock} />{" "}
                            {formatTime(clip.start_time)} -{" "}
                            {formatTime(clip.end_time)}
                          </span>
                        </div>
                      </div>

                      {/* Actions */}
                      <div className={styles.clipActions}>
                        <button
                          type="button"
                          onClick={() => handlePlayClip(clip.output_path)}
                          className={styles.playBtn}
                          title={t("app.clips.playClip")}
                        >
                          <FontAwesomeIcon icon={faPlay} /> {t("app.clips.play")}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDeleteClip(clip.id)}
                          className={styles.deleteBtn}
                          title={t("app.clips.deleteClipTooltip")}
                          aria-label={t("app.clips.deleteClipTooltip")}
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
            )}

            {/* Export Instructions */}
            {filteredClips.length > 0 && (
              <div className={styles.exportInfo}>
                <h4>
                  <FontAwesomeIcon icon={faShare} /> {t("app.clips.sharingClips")}
                </h4>
                <p>
                  {selectedCategory
                    ? t("app.clips.exportCategoryClips", { category: getCategoryName(selectedCategory) })
                    : t("app.clips.exportOrganizedClips")}
                </p>
              </div>
            )}
          </>
        )}
      </div>

      {showPresent && sortedClips.length > 0 && (
        <PresentMode
          clips={sortedClips}
          categories={categories}
          onClose={() => setShowPresent(false)}
        />
      )}
    </div>
  );
};
