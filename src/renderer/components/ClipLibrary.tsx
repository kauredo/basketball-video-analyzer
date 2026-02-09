import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
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
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ClipLibrary.module.css";
import { useToastContext } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { ContextualHint } from "./ContextualHint";
import { loadPref, savePref, STORAGE_KEYS } from "../utils/storage";

// Helper function to format file paths for img src
const formatVideoSrc = (path: string): string => {
  // Check if it's already a file URL
  if (path.startsWith("file://")) {
    return path;
  }

  // For Windows paths (detected by drive letter pattern like C:\ or C:/)
  if (/^[A-Za-z]:[\\/]/.test(path)) {
    // Convert backslashes to forward slashes for URL format
    const normalizedPath = path.replace(/\\/g, "/");
    // Windows file URLs need three slashes
    return `file:///${normalizedPath}`;
  }

  // For Unix-like paths (starting with /)
  if (path.startsWith("/")) {
    return `file://${path}`;
  }

  // Fallback - just prepend file://
  return `file://${path}`;
};

interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
  parent_id?: number;
  children?: Category[];
}

interface Clip {
  id: number;
  video_path: string;
  output_path: string;
  thumbnail_path?: string;
  start_time: number;
  end_time: number;
  duration: number;
  title: string;
  categories: string; // JSON array of category IDs
  notes?: string;
  created_at: string;
}

interface ClipLibraryProps {
  onRefresh: number; // Trigger refresh when this changes
  currentProject: any | null;
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({
  onRefresh,
  currentProject,
}) => {
  const { t } = useTranslation();
  const { showSuccess, showError, showWarning } = useToastContext();
  const { confirm } = useConfirm();
  const [clips, setClips] = useState<Clip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "duration" | "title">(() => loadPref(STORAGE_KEYS.CLIP_SORT_BY, "date") as "date" | "duration" | "title");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">(() => loadPref(STORAGE_KEYS.CLIP_SORT_ORDER, "desc") as "asc" | "desc");
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [onRefresh, currentProject]);

  const loadData = async () => {
    try {
      if (!currentProject) return;

      const [clipsData, categoriesData] = await Promise.all([
        window.electronAPI.getClips(currentProject.id),
        window.electronAPI.getCategoriesHierarchical(currentProject.id),
      ]);

      setClips(clipsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const filteredClips = clips.filter(clip => {
    const matchesSearch =
      clip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clip.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    let matchesCategory = true;
    if (selectedCategory) {
      try {
        const clipCategories = JSON.parse(clip.categories || "[]");
        matchesCategory = clipCategories.includes(selectedCategory);
      } catch (e) {
        matchesCategory = false;
      }
    }

    return matchesSearch && matchesCategory;
  });

  const sortedClips = [...filteredClips].sort((a, b) => {
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
      showError(t("app.clips.errorPlayingClip"));
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
      showError(t("app.clips.errorDeletingClip"));
    }
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
      }
    } catch (error) {
      console.error("Error exporting clips:", error);
      showError(t("app.clips.exportErrorGeneric", { error: error instanceof Error ? error.message : "Unknown error" }));
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
          <button
            type="button"
            onClick={openClipFolder}
            className={styles.folderBtn}
          >
            <FontAwesomeIcon icon={faFolder} /> {t("app.clips.openFolder")}
          </button>
          <button
            type="button"
            onClick={selectedCategory ? handleExportCategory : handleExportAll}
            disabled={isExporting || filteredClips.length === 0}
            className={styles.exportBtn}
          >
            {isExporting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin />{" "}
                {t("app.clips.exportingClips")}
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faFileExport} /> {t("app.clips.export")}
              </>
            )}
          </button>
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

            {/* Clips Grid */}
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
                              style={{ backgroundColor: category.color }}
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
    </div>
  );
};
