import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faScissors,
  faLocationPin,
  faSpinner,
  faFilm,
  faCheck,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ClipCreator.module.css";

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
  currentProject: any | null;
}

export const ClipCreator: React.FC<ClipCreatorProps> = ({
  videoPath,
  markInTime,
  markOutTime,
  onClipCreated,
  onClearMarks,
  currentProject,
}) => {
  const { t } = useTranslation();
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
      alert(t("app.clips.creator.markInOutRequired"));
      return;
    }

    if (!currentProject) {
      alert("No project loaded. Please select a video first.");
      return;
    }

    if (selectedCategories.length === 0) {
      alert(t("app.clips.creator.categoryRequired"));
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
        projectId: currentProject.id,
      });
    } catch (error) {
      console.error("Error creating clip:", error);
      alert(t("app.clips.creator.errorCreating"));
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
    <div className={styles.clipCreator}>
      {/* Clip Creator Header */}
      <div className={styles.clipCreatorHeader}>
        <h3>
          <FontAwesomeIcon icon={faScissors} /> Create Clip
        </h3>
        {markInTime !== null && markOutTime !== null && (
          <div className={styles.clipDuration}>Duration: {getDuration()}</div>
        )}
      </div>

      {/* Category Selection */}
      <div className={styles.categorySelection}>
        <div className={styles.categoryHeader}>
          <h4>Categories ({selectedCategories.length} selected)</h4>
          <div className={styles.categoryActions}>
            <button
              onClick={() => setSelectedCategories(categories.map(c => c.id))}
              disabled={isCreating}
              className={styles.selectAllBtn}
            >
              <FontAwesomeIcon icon={faCheck} /> Select All
            </button>
            <button
              onClick={() => setSelectedCategories([])}
              disabled={isCreating}
              className={styles.clearSelectionBtn}
            >
              <FontAwesomeIcon icon={faTrash} /> Clear
            </button>
          </div>
        </div>
        <div className={styles.categoryGrid}>
          {categories.map(category => (
            <button
              key={category.id}
              onClick={() => handleCategoryToggle(category.id)}
              className={`${
                selectedCategories.includes(category.id) ? styles.selected : ""
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
              <span className={styles.categoryName}>{category.name}</span>
              {selectedCategories.includes(category.id) && (
                <span className={styles.selectedIndicator}>✓</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Clip Details */}
      <div className={styles.clipDetails}>
        <div className={styles.formGroup}>
          <label>{t("app.clips.creator.title")}</label>
          <input
            type="text"
            value={clipTitle}
            onChange={e => setClipTitle(e.target.value)}
            placeholder={t("app.clips.creator.titlePlaceholder")}
            className={styles.clipTitleInput}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t("app.clips.creator.notes")}</label>
          <textarea
            value={clipNotes}
            onChange={e => setClipNotes(e.target.value)}
            placeholder={t("app.clips.creator.notesPlaceholder")}
            className={styles.clipNotesInput}
            rows={3}
          />
        </div>
      </div>

      {/* Progress Bar */}
      {isCreating && (
        <div className={styles.creationProgress}>
          <div className={styles.progressBar}>
            <div
              className={styles.progressFill}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className={styles.progressText}>
            {t("app.clips.creator.creating")} {Math.round(progress)}%
          </div>
        </div>
      )}

      {/* Create Clip Button */}
      <div className={styles.clipCreationActions}>
        <button
          onClick={handleCreateClip}
          disabled={!canCreateClip || isCreating}
          className={styles.createClipBtn}
        >
          {isCreating ? (
            <>
              <FontAwesomeIcon icon={faSpinner} spin />{" "}
              {t("app.clips.creator.creating")}
            </>
          ) : (
            <>
              <FontAwesomeIcon icon={faFilm} />{" "}
              {t("app.clips.creator.createClip")}
            </>
          )}
        </button>
      </div>
    </div>
  );
};
