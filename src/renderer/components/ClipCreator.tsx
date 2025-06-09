import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faScissors,
  faLocationPin,
  faSpinner,
  faFilm,
  faCheck,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface ClipCreatorProps {
  videoPath: string | null;
  markInTime: number | null;
  markOutTime: number | null;
  onClipCreated: () => void;
  onClearMarks: () => void;
}

export const ClipCreator: React.FC<ClipCreatorProps> = ({
  videoPath,
  markInTime,
  markOutTime,
  onClipCreated,
  onClearMarks,
}) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [clipTitle, setClipTitle] = useState("");
  const [clipNotes, setClipNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    loadCategories();

    // Listen for clip progress
    window.electronAPI.onClipProgress(data => {
      setProgress(data.percent || 0);
    });

    // Listen for clip creation completion
    window.electronAPI.onClipCreated(clip => {
      setIsCreating(false);
      setProgress(0);
      resetForm();
      onClipCreated();
      onClearMarks();
    });

    return () => {
      window.electronAPI.removeAllListeners("clip-progress");
      window.electronAPI.removeAllListeners("clip-created");
    };
  }, [onClipCreated, onClearMarks]);

  const loadCategories = async () => {
    try {
      const cats = await window.electronAPI.getCategories();
      setCategories(cats);
    } catch (error) {
      console.error("Error loading categories:", error);
    }
  };

  const resetForm = () => {
    setClipTitle("");
    setClipNotes("");
    setSelectedCategories([]);
    setProgress(0);
  };

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const generateClipTitle = () => {
    if (selectedCategories.length === 0) return "Untitled Clip";

    const selectedCategoryNames = categories
      .filter(cat => selectedCategories.includes(cat.id))
      .map(cat => cat.name)
      .join(" + ");

    const timestamp = new Date().toLocaleTimeString("en-US", {
      hour12: false,
      hour: "2-digit",
      minute: "2-digit",
    });

    return `${selectedCategoryNames} - ${timestamp}`;
  };

  const handleCreateClip = async () => {
    if (!videoPath || markInTime === null || markOutTime === null) {
      alert("Please mark in and out points on the video first.");
      return;
    }

    if (selectedCategories.length === 0) {
      alert("Please select at least one category for this clip.");
      return;
    }

    const title = clipTitle.trim() || generateClipTitle();

    try {
      setIsCreating(true);

      await window.electronAPI.cutVideoClip({
        inputPath: videoPath,
        startTime: markInTime,
        endTime: markOutTime,
        title: title,
        categories: selectedCategories,
        notes: clipNotes.trim() || undefined,
      });
    } catch (error) {
      console.error("Error creating clip:", error);
      alert("Error creating clip. Please try again.");
      setIsCreating(false);
    }
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const getDuration = (): string => {
    if (markInTime !== null && markOutTime !== null) {
      return formatTime(markOutTime - markInTime);
    }
    return "--:--";
  };

  const canCreateClip =
    videoPath &&
    markInTime !== null &&
    markOutTime !== null &&
    selectedCategories.length > 0;

  return (
    <div className="clip-creator">
      <div className="clip-creator-header">
        <h3>
          <FontAwesomeIcon icon={faScissors} /> Create Clip
        </h3>
        {markInTime !== null && markOutTime !== null && (
          <div className="clip-duration">Duration: {getDuration()}</div>
        )}
      </div>

      {!canCreateClip && (
        <div className="clip-creator-instructions">
          {!videoPath && (
            <p>
              <FontAwesomeIcon icon={faFilm} /> Load a video file first
            </p>
          )}
          {videoPath && (markInTime === null || markOutTime === null) && (
            <p>
              <FontAwesomeIcon icon={faLocationPin} /> Mark in and out points on
              the video
            </p>
          )}
          {videoPath &&
            markInTime !== null &&
            markOutTime !== null &&
            selectedCategories.length === 0 && (
              <p>🏷️ Select categories for this clip</p>
            )}
        </div>
      )}

      {/* Category Selection */}
      <div className="category-selection">
        <h4>Categories ({selectedCategories.length} selected)</h4>
        <div className="category-grid">
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryToggle(category.id)}
              className={`category-btn ${
                selectedCategories.includes(category.id) ? "selected" : ""
              }`}
              style={{
                borderColor: category.color,
                backgroundColor: selectedCategories.includes(category.id)
                  ? category.color
                  : "transparent",
                color: selectedCategories.includes(category.id)
                  ? "#fff"
                  : category.color,
              }}
            >
              <span className="category-name">{category.name}</span>
              {selectedCategories.includes(category.id) && (
                <span className="selected-indicator">✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Clip Details */}
      <div className="clip-details">
        <div className="form-group">
          <label>Clip Title (optional)</label>
          <input
            type="text"
            value={clipTitle}
            onChange={e => setClipTitle(e.target.value)}
            placeholder={generateClipTitle()}
            className="clip-title-input"
          />
        </div>

        <div className="form-group">
          <label>Notes (optional)</label>
          <textarea
            value={clipNotes}
            onChange={e => setClipNotes(e.target.value)}
            placeholder="Add notes about this play..."
            className="clip-notes-input"
            rows={3}
          />
        </div>
      </div>

      {/* Progress Bar */}
      {isCreating && (
        <div className="creation-progress">
          <div className="progress-bar">
            <div className="progress-fill" style={{ width: `${progress}%` }} />
          </div>
          <div className="progress-text">
            Creating clip... {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="clip-creation-actions">
        <button
          onClick={handleCreateClip}
          disabled={!canCreateClip || isCreating}
          className="create-clip-btn"
        >
          {isCreating ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin /> Creating...
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faFilm} /> Create Clip
            </>
          )}
        </button>

        {(markInTime !== null || markOutTime !== null) && (
          <button
            onClick={onClearMarks}
            disabled={isCreating}
            className="clear-marks-btn"
          >
            <FontAwesomeIcon icon={faTrash} /> Clear Marks
          </button>
        )}
      </div>

      {/* Quick Category Actions */}
      <div className="quick-actions">
        <button
          onClick={() => setSelectedCategories(categories.map(c => c.id))}
          disabled={isCreating}
          className="select-all-btn"
        >
          <FontAwesomeIcon icon={faCheck} /> Select All
        </button>
        <button
          onClick={() => setSelectedCategories([])}
          disabled={isCreating}
          className="clear-selection-btn"
        >
          <FontAwesomeIcon icon={faTrash} /> Clear Selection
        </button>
      </div>
    </div>
  );
};
