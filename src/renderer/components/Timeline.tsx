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
} from "@fortawesome/free-solid-svg-icons";

import { Clip, Category } from "../../types/global";

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
  const timelineRef = useRef<HTMLDivElement>(null);

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

  // Convert clips to timeline format with percentages
  const timelineClips: TimelineClip[] = filteredClips.map(clip => {
    let category_ids: number[] = [];
    try {
      category_ids = JSON.parse(clip.categories || "[]");
    } catch (e) {
      category_ids = [];
    }

    return {
      ...clip,
      category_ids,
      startPercentage: (clip.start_time / videoDuration) * 100,
      widthPercentage:
        ((clip.end_time - clip.start_time) / videoDuration) * 100,
    };
  });

  // Group clips by category for timeline tracks
  const clipsByCategory = categories.map(category => ({
    category,
    clips: timelineClips.filter(clip =>
      clip.category_ids.includes(category.id!)
    ),
  }));

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
    const percentage = (clickX / rect.width) * 100;
    const newTime = (percentage / 100) * videoDuration;

    onTimeSeek(Math.max(0, Math.min(videoDuration, newTime)));
  };

  // Handle clip selection
  const handleClipClick = (clip: Clip, event: React.MouseEvent) => {
    event.stopPropagation();
    setSelectedClip(clip);
    onClipSelect(clip);
    onTimeSeek(clip.start_time);
  };

  // Calculate current time indicator position
  const currentTimePercentage = (currentTime / videoDuration) * 100;

  // Get category color for a clip
  const getClipColor = (clip: TimelineClip): string => {
    if (clip.category_ids.length === 0) return "#4CAF50";
    const category = categories.find(c => c.id === clip.category_ids[0]);
    return category?.color || "#4CAF50";
  };

  return (
    <div className={styles.timeline}>
      {/* Timeline Header */}
      <div className={styles.timelineHeader}>
        <div className={styles.headerLeft}>
          <h3>
            <FontAwesomeIcon icon={faLayerGroup} />
            {t("app.timeline.title")}
          </h3>
          <span className={styles.clipCount}>
            {filteredClips.length} {t("app.timeline.clips")}
          </span>
        </div>
      </div>

      <div className={styles.timelineContent}>
        {/* Left Panel: Clips Table */}
        <div className={styles.clipsPanel}>
          <div className={styles.clipsPanelHeader}>
            <h4>{t("app.timeline.clipsList")}</h4>

            {/* Search and Filter Controls */}
            <div className={styles.controls}>
              <div className={styles.searchBox}>
                <FontAwesomeIcon icon={faSearch} />
                <input
                  type="text"
                  placeholder={t("app.timeline.search")}
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className={styles.searchInput}
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
              >
                <option value="">{t("app.timeline.allCategories")}</option>
                {categories.map(category => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
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
              <div className={styles.clipsGrid}>
                {filteredClips.map(clip => {
                  // Parse clip categories to get the first one for display
                  let clipCategoryIds: number[] = [];
                  try {
                    clipCategoryIds = JSON.parse(clip.categories || "[]");
                  } catch (e) {
                    clipCategoryIds = [];
                  }
                  const category = categories.find(
                    c => c.id === clipCategoryIds[0]
                  );

                  return (
                    <div
                      key={clip.id}
                      className={`${styles.clipRow} ${
                        selectedClip?.id === clip.id ? styles.selected : ""
                      }`}
                      onClick={() =>
                        handleClipClick(clip, {
                          stopPropagation: () => {},
                        } as React.MouseEvent)
                      }
                    >
                      <div
                        className={styles.categoryIndicator}
                        style={{
                          backgroundColor: category?.color || "#4CAF50",
                        }}
                      />
                      <div className={styles.clipInfo}>
                        <div className={styles.clipTitle}>{clip.title}</div>
                        <div className={styles.clipCategory}>
                          {clipCategoryIds.length > 1
                            ? `${category?.name} +${clipCategoryIds.length - 1}`
                            : category?.name || "No Category"}
                        </div>
                        <div className={styles.clipTiming}>
                          {formatTime(clip.start_time)} -{" "}
                          {formatTime(clip.end_time)}
                          <span className={styles.duration}>
                            ({formatTime(clip.end_time - clip.start_time)})
                          </span>
                        </div>
                        {clip.notes && (
                          <div className={styles.clipNotes}>{clip.notes}</div>
                        )}
                      </div>
                      <button
                        className={styles.playBtn}
                        onClick={e => handleClipClick(clip, e)}
                        title={t("app.timeline.playClip")}
                      >
                        <FontAwesomeIcon icon={faPlay} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right Panel: Visual Timeline */}
        <div className={styles.timelinePanel}>
          <div className={styles.timelinePanelHeader}>
            <h4>{t("app.timeline.visualTimeline")}</h4>
            <div className={styles.timelineInfo}>
              <span>
                {t("app.timeline.duration")}: {formatTime(videoDuration)}
              </span>
              <span>
                {t("app.timeline.currentTime")}: {formatTime(currentTime)}
              </span>
            </div>
          </div>

          {/* Timeline Ruler */}
          <div className={styles.timelineRuler}>
            {Array.from({ length: 11 }, (_, i) => {
              const time = (i / 10) * videoDuration;
              return (
                <div key={i} className={styles.rulerMark}>
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
                <div className={styles.trackLabel}>
                  <div
                    className={styles.trackColorIndicator}
                    style={{ backgroundColor: category.color }}
                  />
                  <span className={styles.trackName}>{category.name}</span>
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

          {/* Timeline Footer */}
          <div className={styles.timelineFooter}>
            <div className={styles.legend}>
              <span>{t("app.timeline.legend")}:</span>
              <div className={styles.legendItems}>
                <div className={styles.legendItem}>
                  <div
                    className={styles.legendColor}
                    style={{ backgroundColor: "#ff6b6b" }}
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
