import React, { useState } from "react";

interface Tag {
  id: number;
  timestamp: number;
  tag_type: string;
  description?: string;
  player?: string;
  created_at?: string;
}

interface TimelineProps {
  tags: Tag[];
  duration: number;
  currentTime: number;
  onTagClick: (timestamp: number) => void;
  onDeleteTag: (tagId: number) => void;
  onCreateClip: (startTime: number, endTime: number) => void;
}

const TAG_COLORS: { [key: string]: string } = {
  "Shot Made": "#4CAF50",
  "Shot Missed": "#f44336",
  Assist: "#2196F3",
  Turnover: "#FF5722",
  Foul: "#FF9800",
  Rebound: "#9C27B0",
  Block: "#607D8B",
  Steal: "#795548",
  default: "#666",
};

export const Timeline: React.FC<TimelineProps> = ({
  tags,
  duration,
  currentTime,
  onTagClick,
  onDeleteTag,
  onCreateClip,
}) => {
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [clipStartTime, setClipStartTime] = useState<number | null>(null);
  const [clipEndTime, setClipEndTime] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"time" | "type">("time");
  const [showClipCreator, setShowClipCreator] = useState(false);

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
      .toString()
      .padStart(2, "0")}`;
  };

  const getTagColor = (tagType: string): string => {
    // Find best match for tag color
    for (const key in TAG_COLORS) {
      if (tagType.toLowerCase().includes(key.toLowerCase())) {
        return TAG_COLORS[key];
      }
    }
    return TAG_COLORS.default;
  };

  const filteredTags = tags.filter(tag => {
    if (filterType === "all") return true;
    return tag.tag_type.toLowerCase().includes(filterType.toLowerCase());
  });

  const sortedTags = [...filteredTags].sort((a, b) => {
    if (sortBy === "time") {
      return a.timestamp - b.timestamp;
    } else {
      return a.tag_type.localeCompare(b.tag_type);
    }
  });

  const handleTagSelect = (tagId: number) => {
    if (selectedTags.includes(tagId)) {
      setSelectedTags(selectedTags.filter(id => id !== tagId));
    } else {
      setSelectedTags([...selectedTags, tagId]);
    }
  };

  const handleSetClipStart = () => {
    setClipStartTime(currentTime);
    if (clipEndTime && currentTime > clipEndTime) {
      setClipEndTime(null);
    }
  };

  const handleSetClipEnd = () => {
    setClipEndTime(currentTime);
    if (clipStartTime && currentTime < clipStartTime) {
      setClipStartTime(null);
    }
  };

  const handleCreateClip = () => {
    if (clipStartTime !== null && clipEndTime !== null) {
      onCreateClip(clipStartTime, clipEndTime);
      setClipStartTime(null);
      setClipEndTime(null);
      setShowClipCreator(false);
    }
  };

  const clearSelection = () => {
    setSelectedTags([]);
  };

  const deleteSelected = () => {
    selectedTags.forEach(tagId => onDeleteTag(tagId));
    setSelectedTags([]);
  };

  const getUniqueTagTypes = () => {
    const types = new Set(tags.map(tag => tag.tag_type));
    return Array.from(types).sort();
  };

  return (
    <div className="timeline">
      <div className="timeline-header">
        <h3>Timeline & Analysis</h3>

        <div className="timeline-controls">
          <div className="filter-controls">
            <select
              value={filterType}
              onChange={e => setFilterType(e.target.value)}
              className="filter-select"
            >
              <option value="all">All Tags</option>
              <option value="shot">Shots</option>
              <option value="foul">Fouls</option>
              <option value="turnover">Turnovers</option>
              <option value="rebound">Rebounds</option>
            </select>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as "time" | "type")}
              className="sort-select"
            >
              <option value="time">Sort by Time</option>
              <option value="type">Sort by Type</option>
            </select>
          </div>

          <div className="action-controls">
            <button
              onClick={() => setShowClipCreator(!showClipCreator)}
              className="clip-btn"
            >
              {showClipCreator ? "✂️ Cancel" : "✂️ Create Clip"}
            </button>

            {selectedTags.length > 0 && (
              <>
                <button onClick={clearSelection} className="clear-btn">
                  Clear ({selectedTags.length})
                </button>
                <button onClick={deleteSelected} className="delete-btn">
                  Delete Selected
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Clip Creator */}
      {showClipCreator && (
        <div className="clip-creator">
          <h4>Create Video Clip</h4>
          <div className="clip-controls">
            <div className="clip-time-controls">
              <button onClick={handleSetClipStart} className="clip-time-btn">
                Set Start (
                {clipStartTime !== null ? formatTime(clipStartTime) : "Not Set"}
                )
              </button>
              <button onClick={handleSetClipEnd} className="clip-time-btn">
                Set End (
                {clipEndTime !== null ? formatTime(clipEndTime) : "Not Set"})
              </button>
            </div>

            {clipStartTime !== null && clipEndTime !== null && (
              <div className="clip-preview">
                <p>Clip Duration: {formatTime(clipEndTime - clipStartTime)}</p>
                <button onClick={handleCreateClip} className="create-clip-btn">
                  Create Clip
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Visual Timeline Bar */}
      <div
        className="timeline-bar"
        style={{
          position: "relative",
          height: "60px",
          background: "#f5f5f5",
          border: "1px solid #ddd",
          borderRadius: "4px",
        }}
      >
        {/* Current time indicator */}
        <div
          className="current-time-indicator"
          style={{
            position: "absolute",
            left: `${duration > 0 ? (currentTime / duration) * 100 : 0}%`,
            width: "3px",
            height: "100%",
            background: "#ff4444",
            zIndex: 10,
            boxShadow: "0 0 3px rgba(255, 68, 68, 0.5)",
          }}
        />

        {/* Clip markers */}
        {clipStartTime !== null && (
          <div
            style={{
              position: "absolute",
              left: `${(clipStartTime / duration) * 100}%`,
              width: "2px",
              height: "100%",
              background: "#4CAF50",
              zIndex: 8,
            }}
            title={`Clip Start: ${formatTime(clipStartTime)}`}
          />
        )}

        {clipEndTime !== null && (
          <div
            style={{
              position: "absolute",
              left: `${(clipEndTime / duration) * 100}%`,
              width: "2px",
              height: "100%",
              background: "#4CAF50",
              zIndex: 8,
            }}
            title={`Clip End: ${formatTime(clipEndTime)}`}
          />
        )}

        {clipStartTime !== null && clipEndTime !== null && (
          <div
            style={{
              position: "absolute",
              left: `${(clipStartTime / duration) * 100}%`,
              width: `${((clipEndTime - clipStartTime) / duration) * 100}%`,
              height: "100%",
              background: "rgba(76, 175, 80, 0.2)",
              zIndex: 5,
            }}
          />
        )}

        {/* Tag markers */}
        {sortedTags.map(tag => (
          <div
            key={tag.id}
            className={`tag-marker ${
              selectedTags.includes(tag.id) ? "selected" : ""
            }`}
            style={{
              position: "absolute",
              left: `${duration > 0 ? (tag.timestamp / duration) * 100 : 0}%`,
              width: "8px",
              height: "100%",
              background: getTagColor(tag.tag_type),
              cursor: "pointer",
              border: selectedTags.includes(tag.id) ? "2px solid #000" : "none",
              borderRadius: "2px",
              zIndex: 7,
            }}
            onClick={e => {
              e.stopPropagation();
              if (e.ctrlKey || e.metaKey) {
                handleTagSelect(tag.id);
              } else {
                onTagClick(tag.timestamp);
              }
            }}
            title={`${tag.tag_type} at ${formatTime(tag.timestamp)}${
              tag.player ? ` - ${tag.player}` : ""
            }`}
          />
        ))}
      </div>

      {/* Statistics */}
      <div className="timeline-stats">
        <div className="stats-grid">
          <div className="stat-item">
            <span className="stat-label">Total Tags:</span>
            <span className="stat-value">{tags.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Filtered:</span>
            <span className="stat-value">{filteredTags.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Selected:</span>
            <span className="stat-value">{selectedTags.length}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Duration:</span>
            <span className="stat-value">{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {/* Tag List */}
      <div className="tag-list">
        <div className="tag-list-header">
          <h4>Tagged Events ({filteredTags.length})</h4>
        </div>

        <div className="tag-items">
          {sortedTags.map(tag => (
            <div
              key={tag.id}
              className={`tag-item ${
                selectedTags.includes(tag.id) ? "selected" : ""
              }`}
              onClick={() => onTagClick(tag.timestamp)}
            >
              <div className="tag-item-content">
                <div className="tag-info">
                  <div
                    className="tag-color-indicator"
                    style={{ backgroundColor: getTagColor(tag.tag_type) }}
                  />
                  <span className="tag-time">{formatTime(tag.timestamp)}</span>
                  <span className="tag-type">{tag.tag_type}</span>
                  {tag.player && (
                    <span className="tag-player">({tag.player})</span>
                  )}
                </div>

                {tag.description && (
                  <div className="tag-description">{tag.description}</div>
                )}

                <div className="tag-actions">
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      handleTagSelect(tag.id);
                    }}
                    className={`select-btn ${
                      selectedTags.includes(tag.id) ? "selected" : ""
                    }`}
                  >
                    {selectedTags.includes(tag.id) ? "✓" : "○"}
                  </button>
                  <button
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteTag(tag.id);
                    }}
                    className="delete-btn"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {sortedTags.length === 0 && (
          <div className="empty-state">
            <p>No tags found. Start tagging events in the video!</p>
          </div>
        )}
      </div>
    </div>
  );
};
