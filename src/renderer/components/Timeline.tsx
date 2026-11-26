import React, { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/Timeline.module.css";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faClock,
  faSearch,
  faMagnifyingGlassMinus,
  faMagnifyingGlassPlus,
} from "@fortawesome/free-solid-svg-icons";

import { Clip, Category } from "../../types/global";
import {
  CategoryNode,
  categoryFamily,
  clipInCategory,
  parseIds,
} from "../utils/clipFilters";
import { formatDuration } from "../utils/format";
import { inkOn } from "../utils/contrast";
import { statusLabelKey } from "../utils/constants";
import {
  LIST_WIDTHS,
  ListColumn,
  ListWidth,
  clipNumbers,
  compareByStart,
  listColumns,
} from "../utils/clipList";

// A category with no colour of its own. Deliberately a neutral: it reads as
// unset rather than impersonating a real category. The old #4CAF50 sat dE 7.4
// from Transition in the new palette and failed 3:1 on the light theme.
const DEFAULT_CATEGORY_COLOR = "#7F7F7F";

const WIDTH_CLASS: Record<ListWidth, string> = {
  narrow: styles.listNarrow,
  wide: styles.listWide,
  full: styles.listFull,
};

interface TimelineProps {
  clips: Clip[];
  categories: Category[];
  currentTime: number;
  videoDuration: number;
  onTimeSeek: (time: number) => void;
  onClipSelect: (clip: Clip) => void;
  listWidth: ListWidth;
  onListWidthChange: (width: ListWidth) => void;
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
  listWidth,
  onListWidthChange,
}) => {
  const { t } = useTranslation();
  const [selectedClip, setSelectedClip] = useState<Clip | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterCategory, setFilterCategory] = useState<number | null>(null);
  const [zoomLevel, setZoomLevel] = useState(1);
  const timelineRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Every category, parents and their children, for lookup by id
  const allCategories = useMemo(
    () => categories.flatMap(cat => [cat, ...(cat.children ?? [])]),
    [categories]
  );

  // A parent filter takes in its subcategories' clips, as the side panel does.
  // Categories from the database always carry an id.
  const family = useMemo(
    () => categoryFamily(categories as CategoryNode[]),
    [categories]
  );

  // Filter clips based on search and category filter
  const filteredClips = clips.filter(clip => {
    const matchesSearch =
      clip.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      clip.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCategory =
      filterCategory === null || clipInCategory(clip, filterCategory, family);
    return matchesSearch && matchesCategory;
  });

  // Position along the timeline as a percentage; 0 until the duration is known,
  // so nothing is placed at NaN% while the video loads.
  const percentOf = (seconds: number): number =>
    videoDuration > 0 ? (seconds / videoDuration) * 100 : 0;

  // Convert clips to timeline format with percentages and expand clips for multiple categories
  const expandClipsForCategories = (): TimelineClip[] => {
    const expandedClips: TimelineClip[] = [];

    filteredClips.forEach(clip => {
      const category_ids = parseIds(clip.categories);

      // Create a separate timeline clip for each category the clip belongs to
      category_ids.forEach(categoryId => {
        expandedClips.push({
          ...clip,
          category_ids: [categoryId], // Single category for this instance
          startPercentage: percentOf(clip.start_time),
          widthPercentage: percentOf(clip.end_time - clip.start_time),
        });
      });

      // If no categories, create one clip with empty category
      if (category_ids.length === 0) {
        expandedClips.push({
          ...clip,
          category_ids: [],
          startPercentage: percentOf(clip.start_time),
          widthPercentage: percentOf(clip.end_time - clip.start_time),
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

  // Flattened hierarchical order (each parent followed by its children) so a
  // clip's category chips in the list always sort parent-before-child.
  const categoryOrder = new Map<number, number>();
  categories
    .filter(cat => !cat.parent_id)
    .forEach(parent => {
      categoryOrder.set(parent.id!, categoryOrder.size);
      parent.children?.forEach(child =>
        categoryOrder.set(child.id!, categoryOrder.size)
      );
    });

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

  // Handle a click on a timeline segment, seeking to the clicked point inside it
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
  const currentTimePercentage = percentOf(currentTime);

  // Get category color for a clip (now works with single category per timeline clip)
  const getClipColor = (clip: TimelineClip): string => {
    if (clip.category_ids.length === 0) return DEFAULT_CATEGORY_COLOR;
    const category = allCategories.find(c => c.id === clip.category_ids[0]);
    return category?.color || DEFAULT_CATEGORY_COLOR;
  };

  // The list: one row per clip, numbered by position in the whole recording
  const numbers = useMemo(() => clipNumbers(clips), [clips]);
  const shownClips = [...filteredClips].sort(compareByStart);
  const columns = listColumns({
    width: listWidth,
    singleCategory: filterCategory !== null,
    anyStatus: shownClips.some(c => c.status),
  });

  const selectFromList = (clip: Clip) => {
    setSelectedClip(clip);
    onClipSelect(clip); // App seeks to start_time, switching recording if needed
  };

  // Only Enter belongs to the row. Space, Escape and quick-tag digits bubble to
  // VideoPlayer's document listener, so "click a clip, press Space" plays it.
  const onRowKey = (e: React.KeyboardEvent, clip: Clip) => {
    if (e.key === "Enter") {
      e.stopPropagation();
      selectFromList(clip);
    } else if (e.key === " ") {
      e.preventDefault(); // stop the list scrolling; VideoPlayer ignores defaultPrevented
    }
  };

  const chip = (key: React.Key, color: string, label: React.ReactNode) => (
    <span
      key={key}
      className={styles.chip}
      style={{ backgroundColor: color, color: inkOn(color) }}
    >
      {label}
    </span>
  );

  const categoryChips = (clip: Clip) => {
    const ids = parseIds(clip.categories).sort(
      (a, b) =>
        (categoryOrder.get(a) ?? Number.MAX_SAFE_INTEGER) -
        (categoryOrder.get(b) ?? Number.MAX_SAFE_INTEGER)
    );
    if (ids.length === 0) {
      return chip("none", DEFAULT_CATEGORY_COLOR, t("app.categories.noCategory"));
    }
    return ids.map((id, index) => {
      const category = allCategories.find(c => c.id === id);
      if (!category) {
        return chip(`${id}-${index}`, DEFAULT_CATEGORY_COLOR, t("app.categories.unknownCategory"));
      }
      return chip(
        `${id}-${index}`,
        category.color || DEFAULT_CATEGORY_COLOR,
        category.parent_id ? (
          <span className={styles.chipSub}>└ {category.name}</span>
        ) : (
          category.name
        )
      );
    });
  };

  const headerLabel = (col: ListColumn): React.ReactNode => {
    switch (col) {
      case "number":
        return <abbr title={t("app.timeline.clipNumber")}>#</abbr>;
      case "time":
        return t("app.timeline.time");
      case "category":
        return t("app.timeline.category");
      case "title":
        return t("app.timeline.clipTitle");
      case "notes":
        return t("app.timeline.notes");
      case "duration":
        return t("app.timeline.durationHeader");
      case "status":
        return t("app.clips.table.columnStatus");
    }
  };

  const cell = (col: ListColumn, clip: Clip): React.ReactNode => {
    switch (col) {
      case "number":
        return numbers.get(clip.id);
      case "time":
        return formatDuration(clip.start_time);
      case "category":
        return <div className={styles.chips}>{categoryChips(clip)}</div>;
      case "title":
        return (
          <>
            <span className={styles.clipTitle}>{clip.title}</span>
            {listWidth === "narrow" && clip.notes && (
              <span className={styles.rowNote}>{clip.notes}</span>
            )}
          </>
        );
      case "notes":
        return <span className={styles.notes}>{clip.notes}</span>;
      case "duration":
        return formatDuration(clip.end_time - clip.start_time);
      case "status":
        return clip.status ? t(statusLabelKey(clip.status)) : "";
    }
  };

  return (
    <div className={styles.timeline}>
      <div className={styles.timelineContent}>
        {/* Left Panel: Clips Table */}
        <div className={`${styles.clipsPanel} ${WIDTH_CLASS[listWidth]}`}>
          <div className={styles.clipsPanelHeader}>
            {/* Search, filter and list width, one row that wraps only when it runs out of room */}
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

              <div className={styles.listWidthRow}>
                <span className={styles.listWidthLabel} id="timeline-list-width">
                  {t("app.timeline.listWidth")}
                </span>
                <div
                  role="group"
                  aria-labelledby="timeline-list-width"
                  className={styles.segmented}
                >
                  {LIST_WIDTHS.map(w => (
                    <button
                      key={w}
                      type="button"
                      aria-pressed={listWidth === w}
                      className={`${styles.segment} ${listWidth === w ? styles.segmentOn : ""}`}
                      onClick={() => onListWidthChange(w)}
                    >
                      {t(`app.timeline.width${w[0].toUpperCase()}${w.slice(1)}`)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Clips Table */}
          <div className={styles.clipsTable}>
            {shownClips.length === 0 ? (
              <div className={styles.emptyState}>
                <FontAwesomeIcon icon={faClock} />
                <p>{t("app.timeline.noClips")}</p>
                <p className={styles.emptyStateGuidance}>{t("app.timeline.noClipsGuidance")}</p>
              </div>
            ) : (
              <table className={styles.clipsTableElement}>
                <thead>
                  <tr>
                    {columns.map(col => <th key={col} scope="col" className={styles[`col_${col}`]}>{headerLabel(col)}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {shownClips.map(clip => (
                    <tr
                      key={clip.id}
                      className={selectedClip?.id === clip.id ? styles.selected : undefined}
                      onClick={() => selectFromList(clip)}
                      onKeyDown={e => onRowKey(e, clip)}
                      tabIndex={0}
                      aria-current={selectedClip?.id === clip.id ? "true" : undefined}
                    >
                      {columns.map(col => <td key={col} className={styles[`col_${col}`]}>{cell(col, clip)}</td>)}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Right Panel: Visual Timeline, hidden while the list takes the whole panel */}
        {listWidth !== "full" && (
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
                    <div key={i} className={styles.rulerMark} style={{ left: `${percentOf(time)}%` }}>
                      <div className={styles.rulerLine} />
                      <span className={styles.rulerLabel}>{formatTime(time)}</span>
                    </div>
                  );
                })}
              </div>

              {/* Timeline Tracks */}
              <div className={styles.timelineTracks}>
                {clipsByCategory.map(({ category, clips: categoryClips }, trackIndex) => (
                  <div key={category.id} className={styles.timelineTrack}>
                    <div className={styles.trackLabelSticky}>
                      <div
                        className={`${styles.trackColorIndicator} ${
                          styles[`markerShape${trackIndex % 3}`]
                        }`}
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
                            styles[`markerShape${trackIndex % 3}`]
                          } ${selectedClip?.id === clip.id ? styles.selectedClip : ""}`}
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
        )}
      </div>
    </div>
  );
};
