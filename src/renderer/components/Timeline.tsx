import React, { useState, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Timeline.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faClock,
  faLayerGroup,
  faFilter,
  faSearch,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
} from "@fortawesome/free-solid-svg-icons";

import { Clip, Category } from "../../types/global";

const DEFAULT_CATEGORY_COLOR = "#4CAF50";

interface TimelineProps {
  clips: Clip[];
  categories: Category[];
  currentTime: number;
  videoDuration: number;
  onTimeSeek: (time: number) => void;
  onClipSelect: (clip: Clip) => void;
}

interface TimelineClip extends Clip {
  startPercentage: number;
  widthPercentage: number;
  category_ids: number[]; // Parsed from categories JSON string
}

export const Timeline: React.FC<TimelineProps> = ({
  clips,
  categories,
  currentTime,
  videoDuration,
  onTimeSeek,
  onClipSelect,
}) => {
  const { t } = useTranslation();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Filter clips based on search and category filter
  const filteredClips = clips.filter(clip => {
    const matchesSearch =
      clip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clip.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    // Parse categories JSON to check filter
    let clipCategoryIds: number[] = [];
    try {
      clipCategoryIds = JSON.parse(clip.categories || "[]");
    } catch (e) {
      clipCategoryIds = [];
    }

    const matchesCategory =
      filterCategory === null || clipCategoryIds.includes(filterCategory);
    return matchesSearch && matchesCategory;
  });

  // Convert clips to timeline format with percentages and expand clips for multiple categories
  const expandClipsForCategories = (): TimelineClip[] => {
    const expandedClips: TimelineClip[] = [];

    filteredClips.forEach(clip => {
      let category_ids: number[] = [];
      try {
        category_ids = JSON.parse(clip.categories || "[]");
      } catch (e) {
        category_ids = [];
      }

      // Create a separate timeline clip for each category the clip belongs to
      category_ids.forEach(categoryId => {
        expandedClips.push({
          ...clip,
          category_ids: [categoryId], // Single category for this instance
          startPercentage: (clip.start_time / videoDuration) * 100,
          widthPercentage:
            ((clip.end_time - clip.start_time) / videoDuration) * 100,
        });
      });

      // If no categories, create one clip with empty category
      if (category_ids.length === 0) {
        expandedClips.push({
          ...clip,
          category_ids: [],
          startPercentage: (clip.start_time / videoDuration) * 100,
          widthPercentage:
            ((clip.end_time - clip.start_time) / videoDuration) * 100,
        });
      }
    });

    return expandedClips;
  };

  const timelineClips = expandClipsForCategories();

  // Calculate timeline width based on zoom
  const timelineWidth = `${zoomLevel * 100}%`;

  // Group clips by category for timeline tracks - organize hierarchically
  const organizeCategories = (categories: Category[]) => {
    const result: Array<{ category: Category; clips: TimelineClip[] }> = [];

    // Get all categories (including children) flattened for easier lookup
    const allCategories: Category[] = [];
    categories.forEach(cat => {
      allCategories.push(cat);
      if (cat.children) {
        allCategories.push(...cat.children);
      }
    });

    // First add parent categories and their clips
    categories
      .filter(cat => !cat.parent_id)
      .forEach(parentCategory => {
        const parentClips = timelineClips.filter(clip =>
          clip.category_ids.includes(parentCategory.id!)
        );

        if (parentClips.length > 0) {
          result.push({ category: parentCategory, clips: parentClips });
        }

        // Then add subcategories and their clips
        if (parentCategory.children) {
          parentCategory.children.forEach(subcategory => {
            const subClips = timelineClips.filter(clip =>
              clip.category_ids.includes(subcategory.id!)
            );

            if (subClips.length > 0) {
              result.push({ category: subcategory, clips: subClips });
            }
          });
        }
      });

    return result;
  };

  const clipsByCategory = organizeCategories(categories);

  // Format time for display
  const formatTime = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  // Handle timeline click for seeking
  const handleTimelineClick = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!timelineRef.current) return;

    const rect = timelineRef.current.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    // Calculate percentage relative to the zoomed width
    const percentage = (clickX / rect.width) * 100;
    const newTime = (percentage / 100) * videoDuration;

    onTimeSeek(Math.max(0, Math.min(videoDuration, newTime)));
  };

  // Handle clip selection with accurate positioning
  const handleClipClick = (clip: Clip, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedClip(clip);
    onClipSelect(clip);

    // Calculate the exact time within the clip based on click position
    const clipElement = event.currentTarget as HTMLElement;
    const rect = clipElement.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickPercentage = clickX / rect.width;

    // Calculate the time within the clip's duration
    const clipDuration = clip.end_time - clip.start_time;
    const timeWithinClip = clickPercentage * clipDuration;
    const exactTime = clip.start_time + timeWithinClip;

    // Clamp to clip boundaries
    const clampedTime = Math.max(
      clip.start_time,
      Math.min(clip.end_time, exactTime)
    );

    onTimeSeek(clampedTime);
  };

  // Calculate current time indicator position
  const currentTimePercentage = (currentTime / videoDuration) * 100;

  // Get category color for a clip (now works with single category per timeline clip)
  const getClipColor = (clip: TimelineClip): string => {
    if (clip.category_ids.length === 0) return DEFAULT_CATEGORY_COLOR;

    // Get all categories (including children) for lookup
    const allCategories: Category[] = [];
    categories.forEach(cat => {
      allCategories.push(cat);
      if (cat.children) {
        allCategories.push(...cat.children);
      }
    });

    const category = allCategories.find(c => c.id === clip.category_ids[0]);
    return category?.color || DEFAULT_CATEGORY_COLOR;
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineContent}>
        {/* Left Panel: Clips Table */}
        <div className={styles.clipsPanel}>
          <div className={styles.clipsPanelHeader}>
            {/* Search and Filter Controls */}
            <div className={styles.controls}>
              <div className={styles.searchBox}>
                <FontAwesomeIcon icon={faSearch} />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder={t("app.timeline.search")}
                  value={searchTerm}
                  onChange={e => {
                    e.stopPropagation();
                    setSearchTerm(e.target.value);
                  }}
                  onKeyDown={e => {
                    e.stopPropagation();
                  }}
                  className={styles.searchInput}
                  aria-label={t("app.timeline.search")}
                />
              </div>

              <select
                value={filterCategory || ""}
                onChange={e =>
                  setFilterCategory(
                    e.target.value ? Number(e.target.value) : null
                  )
                }
                className={styles.categoryFilter}
                aria-label={t("app.timeline.category")}
              >
                <option value="">{t("app.timeline.allCategories")}</option>
                {categories
                  .filter(cat => !cat.parent_id) // Parent categories
                  .map(parentCategory => [
                    // Parent category option
                    <option key={parentCategory.id} value={parentCategory.id}>
                      {parentCategory.name}
                    </option>,
                    // Subcategory options
                    ...(parentCategory.children || []).map(subcategory => (
                      <option key={subcategory.id} value={subcategory.id}>
                        └ {subcategory.name}
                      </option>
                    )),
                  ])
                  .flat()}
              </select>
            </div>
          </div>

          {/* Clips Table */}
          <div className={styles.clipsTable}>
            {filteredClips.length === 0 ? (
              <div className={styles.emptyState}>
                <FontAwesomeIcon icon={faClock} />
                <p>{t("app.timeline.noClips")}</p>
              </div>
            ) : (
              <table className={styles.clipsTableElement}>
                <thead>
                  <tr>
                    <th>{t("app.timeline.category")}</th>
                    <th>{t("app.timeline.clipTitle")}</th>
                    <th>{t("app.timeline.time")}</th>
                    <th>{t("app.timeline.durationHeader")}</th>
                    <th>{t("app.timeline.notes")}</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Show clips expanded by categories */}
                  {filteredClips.flatMap(clip => {
                    // Parse clip categories
                    let clipCategoryIds: number[] = [];
                    try {
                      clipCategoryIds = JSON.parse(clip.categories || "[]");
                    } catch (e) {
                      clipCategoryIds = [];
                    }

                    // If no categories, show once with "No Category"
                    if (clipCategoryIds.length === 0) {
                      return [
                        <tr
                          key={`${clip.id}-no-category`}
                          className={`${styles.clipRow} ${
                            selectedClip?.id === clip.id ? styles.selected : ""
                          }`}
                          onClick={() =>
                            handleClipClick(clip, {
                              stopPropagation: () => {},
                            } as React.MouseEvent)
                          }
                        >
                          <td className={styles.categoryCell}>
                            <div className={styles.categoryContainer}>
                              <div
                                className={styles.categoryIndicator}
                                style={{ backgroundColor: DEFAULT_CATEGORY_COLOR }}
                              />
                              <span className={styles.categoryName}>
                                {t("app.categories.noCategory")}
                              </span>
                            </div>
                          </td>
                          <td className={styles.titleCell}>
                            <span className={styles.clipTitle}>
                              {clip.title}
                            </span>
                          </td>
                          <td className={styles.timeCell}>
                            <span className={styles.timeRange}>
                              {formatTime(clip.start_time)} -{" "}
                              {formatTime(clip.end_time)}
                            </span>
                          </td>
                          <td className={styles.durationCell}>
                            <span className={styles.duration}>
                              {formatTime(clip.end_time - clip.start_time)}
                            </span>
                          </td>
                          <td className={styles.notesCell}>
                            <span className={styles.notes}>
                              {clip.notes
                                ? clip.notes.length > 30
                                  ? `${clip.notes.substring(0, 30)}...`
                                  : clip.notes
                                : "-"}
                            </span>
                          </td>
                        </tr>,
                      ];
                    }

                    // Get all categories (including children) for lookup
                    const allCategories: Category[] = [];
                    categories.forEach(cat => {
                      allCategories.push(cat);
                      if (cat.children) {
                        allCategories.push(...cat.children);
                      }
                    });

                    // Show once per category
                    return clipCategoryIds.map((categoryId, index) => {
                      const category = allCategories.find(
                        c => c.id === categoryId
                      );

                      return (
                        <tr
                          key={`${clip.id}-cat-${categoryId}`}
                          className={`${styles.clipRow} ${
                            selectedClip?.id === clip.id ? styles.selected : ""
                          }`}
                          onClick={() =>
                            handleClipClick(clip, {
                              stopPropagation: () => {},
                            } as React.MouseEvent)
                          }
                        >
                          <td className={styles.categoryCell}>
                            <div className={styles.categoryContainer}>
                              <div
                                className={styles.categoryIndicator}
                                style={{
                                  backgroundColor: category?.color || DEFAULT_CATEGORY_COLOR,
                                }}
                              />
                              <span className={styles.categoryName}>
                                {category?.parent_id ? "└ " : ""}
                                {category?.name || t("app.categories.unknownCategory")}
                              </span>
                            </div>
                          </td>
                          <td className={styles.titleCell}>
                            <span className={styles.clipTitle}>
                              {clip.title}
                            </span>
                          </td>
                          <td className={styles.timeCell}>
                            <span className={styles.timeRange}>
                              {formatTime(clip.start_time)} -{" "}
                              {formatTime(clip.end_time)}
                            </span>
                          </td>
                          <td className={styles.durationCell}>
                            <span className={styles.duration}>
                              {formatTime(clip.end_time - clip.start_time)}
                            </span>
                          </td>
                          <td className={styles.notesCell}>
                            <span className={styles.notes}>
                              {clip.notes
                                ? clip.notes.length > 30
                                  ? `${clip.notes.substring(0, 30)}...`
                                  : clip.notes
                                : "-"}
                            </span>
                          </td>
                          <td className={styles.actionsCell}>
                            <button
                              className={styles.playBtn}
                              onClick={e => handleClipClick(clip, e)}
                              title={t("app.timeline.playClip")}
                            >
                              <FontAwesomeIcon icon={faPlay} />
                            </button>
                          </td>
                        </tr>
                      );
                    });
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Panel: Visual Timeline */}
        <div className={styles.timelinePanel}>
          <div className={styles.timelinePanelHeader}>
            <div className={styles.timelineInfo}>
              <span>
                {t("app.timeline.duration")}: {formatTime(videoDuration)}
              </span>
              <span>
                {t("app.timeline.currentTime")}: {formatTime(currentTime)}
              </span>
            </div>
            
            <div className={styles.zoomControls}>
              <FontAwesomeIcon icon={faMagnifyingGlassMinus} className={styles.zoomIcon} />
              <input
                type="range"
                min="1"
                max="10"
                step="0.1"
                value={zoomLevel}
                onChange={(e) => setZoomLevel(parseFloat(e.target.value))}
                className={styles.zoomSlider}
                title={t("app.video.zoomTimeline")}
                aria-label={t("app.video.zoomTimeline")}
              />
              <FontAwesomeIcon icon={faMagnifyingGlassPlus} className={styles.zoomIcon} />
              <span className={styles.zoomValue}>{Math.round(zoomLevel * 100)}%</span>
            </div>
          </div>

          {/* Timeline Scroll Container */}
          <div className={styles.timelineScrollContainer}>
            <div className={styles.timelineContentWrapper} style={{ width: timelineWidth }}>
              {/* Timeline Ruler */}
              <div className={styles.timelineRuler}>
                {Array.from({ length: Math.ceil(11 * zoomLevel) }, (_, i) => {
                  const time = (i / (10 * zoomLevel)) * videoDuration;
                  if (time > videoDuration) return null;
                  return (
                    <div key={i} className={styles.rulerMark} style={{ left: `${(time / videoDuration) * 100}%` }}>
                      <div className={styles.rulerLine} />
                      <span className={styles.rulerLabel}>{formatTime(time)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Timeline Tracks */}
              <div className={styles.timelineTracks}>
                {clipsByCategory.map(({ category, clips: categoryClips }) => (
                  <div key={category.id} className={styles.timelineTrack}>
                    <div className={styles.trackLabelSticky}>
                      <div
                        className={styles.trackColorIndicator}
                        style={{ backgroundColor: category.color }}
                      />
                      <span
                        className={`${styles.trackName} ${
                          category.parent_id ? styles.subcategoryTrack : ""
                        }`}
                      >
                        {category.parent_id && "└ "}
                        {category.name}
                      </span>
                      <span className={styles.trackCount}>
                        ({categoryClips.length})
                      </span>
                    </div>

                    <div
                      className={styles.trackTimeline}
                      ref={timelineRef}
                      onClick={handleTimelineClick}
                    >
                      {/* Track Background */}
                      <div className={styles.trackBackground} />

                      {/* Clip Segments */}
                      {categoryClips.map(clip => (
                        <div
                          key={clip.id}
                          className={`${styles.timelineClip} ${
                            selectedClip?.id === clip.id ? styles.selectedClip : ""
                          }`}
                          style={{
                            left: `${clip.startPercentage}%`,
                            width: `${clip.widthPercentage}%`,
                            backgroundColor: getClipColor(clip),
                          }}
                          onClick={e => handleClipClick(clip, e)}
                          title={`${clip.title} (${formatTime(
                            clip.start_time
                          )} - ${formatTime(clip.end_time)})`}
                        >
                          <div className={styles.clipHandle} />
                        </div>
                      ))}

                      {/* Current Time Indicator */}
                      <div
                        className={styles.currentTimeIndicator}
                        style={{ left: `${currentTimePercentage}%` }}
                      >
                        <div className={styles.timeIndicatorLine} />
                        <div className={styles.timeIndicatorHandle} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Timeline Footer */}
          <div className={styles.timelineFooter}>
            <div className={styles.legend}>
              <span>{t("app.timeline.legend")}:</span>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <div
                    className={styles.legendColor}
                    style={{ backgroundColor: "var(--color-danger)" }}
                  />
                  <span>{t("app.timeline.selectedClip")}</span>
                </div>
                <div className={styles.legendItem}>
                  <div className={styles.legendIndicator} />
                  <span>{t("app.timeline.currentPosition")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
