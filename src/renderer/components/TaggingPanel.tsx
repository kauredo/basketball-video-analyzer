import React, { useState } from "react";

interface TaggingPanelProps {
  currentTime: number;
  onAddTag: (tagType: string, description?: string, player?: string) => void;
  isVideoLoaded: boolean;
}

const BASKETBALL_TAGS = {
  Offense: {
    color: "#4CAF50",
    tags: [
      "Shot Made - 2PT",
      "Shot Made - 3PT",
      "Shot Made - Free Throw",
      "Shot Missed - 2PT",
      "Shot Missed - 3PT",
      "Shot Missed - Free Throw",
      "Assist",
      "Offensive Rebound",
      "Fast Break",
      "Turnover",
    ],
  },
  Defense: {
    color: "#f44336",
    tags: [
      "Defensive Rebound",
      "Steal",
      "Block",
      "Defensive Foul",
      "Charge",
      "Force Turnover",
    ],
  },
  "Game Flow": {
    color: "#2196F3",
    tags: [
      "Timeout",
      "Substitution",
      "Technical Foul",
      "Flagrant Foul",
      "Quarter End",
      "Half Time",
      "Game End",
    ],
  },
  "Player Performance": {
    color: "#FF9800",
    tags: [
      "Good Defense",
      "Great Pass",
      "Hustle Play",
      "Poor Decision",
      "Good Screen",
      "Communication",
    ],
  },
};

const COMMON_PLAYERS = [
  "Player 1",
  "Player 2",
  "Player 3",
  "Player 4",
  "Player 5",
  "Player 6",
  "Player 7",
  "Player 8",
  "Player 9",
  "Player 10",
];

export const TaggingPanel: React.FC<TaggingPanelProps> = ({
  currentTime,
  onAddTag,
  isVideoLoaded,
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string>("");
  const [customDescription, setCustomDescription] = useState<string>("");
  const [activeCategory, setActiveCategory] = useState<string>("Offense");
  const [showPlayerSelect, setShowPlayerSelect] = useState<boolean>(false);

  const handleTagClick = (tagType: string) => {
    if (!isVideoLoaded) return;

    const description = customDescription.trim() || undefined;
    const player = selectedPlayer || undefined;

    onAddTag(tagType, description, player);

    // Clear custom description after tagging
    setCustomDescription("");
  };

  const handleQuickTag = (tagType: string) => {
    // Quick tag without opening player selection
    if (!isVideoLoaded) return;
    onAddTag(tagType);
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    const milliseconds = Math.floor((time % 1) * 100);
    return `${minutes}:${seconds.toString().padStart(2, "0")}.${milliseconds
      .toString()
      .padStart(2, "0")}`;
  };

  if (!isVideoLoaded) {
    return (
      <div className="tagging-panel disabled">
        <h3>Basketball Tags</h3>
        <div className="disabled-message">
          <p>Load a video to start tagging</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tagging-panel">
      <div className="panel-header">
        <h3>Basketball Tags</h3>
        <div className="current-time">
          Time: <span className="time-display">{formatTime(currentTime)}</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="quick-actions">
        <h4>Quick Tags</h4>
        <div className="quick-buttons">
          <button
            onClick={() => handleQuickTag("Shot Made")}
            className="quick-btn success"
          >
            ✓ Shot Made
          </button>
          <button
            onClick={() => handleQuickTag("Shot Missed")}
            className="quick-btn miss"
          >
            ✗ Shot Missed
          </button>
          <button
            onClick={() => handleQuickTag("Turnover")}
            className="quick-btn turnover"
          >
            🔄 Turnover
          </button>
          <button
            onClick={() => handleQuickTag("Foul")}
            className="quick-btn foul"
          >
            ⚠️ Foul
          </button>
        </div>
      </div>

      {/* Category Tabs */}
      <div className="category-tabs">
        {Object.keys(BASKETBALL_TAGS).map(category => (
          <button
            key={category}
            onClick={() => setActiveCategory(category)}
            className={`category-tab ${
              activeCategory === category ? "active" : ""
            }`}
            style={{
              borderBottomColor:
                activeCategory === category
                  ? BASKETBALL_TAGS[category as keyof typeof BASKETBALL_TAGS]
                      .color
                  : "transparent",
            }}
          >
            {category}
          </button>
        ))}
      </div>

      {/* Tag Buttons */}
      <div className="tag-category">
        <div className="tag-buttons">
          {BASKETBALL_TAGS[
            activeCategory as keyof typeof BASKETBALL_TAGS
          ].tags.map(tag => (
            <button
              key={tag}
              onClick={() => handleTagClick(tag)}
              className="tag-button"
              style={{
                borderLeftColor:
                  BASKETBALL_TAGS[
                    activeCategory as keyof typeof BASKETBALL_TAGS
                  ].color,
              }}
            >
              {tag}
            </button>
          ))}
        </div>
      </div>

      {/* Player Selection */}
      <div className="player-section">
        <div className="section-header">
          <h4>Player (Optional)</h4>
          <button
            onClick={() => setShowPlayerSelect(!showPlayerSelect)}
            className="toggle-btn"
          >
            {showPlayerSelect ? "▼" : "▶"}
          </button>
        </div>

        {showPlayerSelect && (
          <div className="player-select">
            <select
              value={selectedPlayer}
              onChange={e => setSelectedPlayer(e.target.value)}
              className="player-dropdown"
            >
              <option value="">Select Player</option>
              {COMMON_PLAYERS.map(player => (
                <option key={player} value={player}>
                  {player}
                </option>
              ))}
            </select>

            <div className="player-quick-buttons">
              {["#1", "#2", "#3", "#4", "#5"].map(num => (
                <button
                  key={num}
                  onClick={() => setSelectedPlayer(`Player ${num.slice(1)}`)}
                  className={`player-quick-btn ${
                    selectedPlayer === `Player ${num.slice(1)}` ? "active" : ""
                  }`}
                >
                  {num}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Custom Description */}
      <div className="description-section">
        <h4>Notes (Optional)</h4>
        <textarea
          value={customDescription}
          onChange={e => setCustomDescription(e.target.value)}
          placeholder="Add notes about this play..."
          className="description-input"
          rows={3}
        />
      </div>

      {/* Keyboard Shortcuts Info */}
      <div className="keyboard-shortcuts">
        <h4>Keyboard Shortcuts</h4>
        <div className="shortcuts-list">
          <div>
            <kbd>1</kbd> Shot Made
          </div>
          <div>
            <kbd>2</kbd> Shot Missed
          </div>
          <div>
            <kbd>3</kbd> Turnover
          </div>
          <div>
            <kbd>4</kbd> Foul
          </div>
        </div>
      </div>
    </div>
  );
};
