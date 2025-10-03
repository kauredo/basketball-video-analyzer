import React, { useState, useEffect, useRef } from "react";
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
import { useToast } from "../hooks/useToast";
import { ToastContainer } from "./Toast";

interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
  parent_id?: number;
  children?: Category[];
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
  const { toasts, removeToast, showError, showSuccess, showWarning } =
    useToast();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<number[]>([]);
  const [clipTitle, setClipTitle] = useState("");
  const [clipNotes, setClipNotes] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [currentProcessId, setCurrentProcessId] = useState<string | null>(null);

  // Refs for input focus management
  const clipTitleInputRef = useRef<HTMLInputElement>(null);
  const clipNotesInputRef = useRef<HTMLTextAreaElement>(null);

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
      setCurrentProcessId(null);
      showSuccess(t("app.clips.creator.clipCreatedSuccess"));
      resetForm();
      onClipCreated();
      onClearMarks();
    });

    // Listen for clip process ID
    window.electronAPI.onClipProcessId(data => {
      setCurrentProcessId(data.processId);
    });

    return () => {
      window.electronAPI.removeAllListeners("clip-progress");
      window.electronAPI.removeAllListeners("clip-created");
      window.electronAPI.removeAllListeners("clip-process-id");
    };
  }, [onClipCreated, onClearMarks]);

  const loadCategories = async () => {
    try {
      if (!currentProject) return;
      const cats = await window.electronAPI.getCategoriesHierarchical(
        currentProject.id
      );
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
    setRetryCount(0);
    setCurrentProcessId(null);
  };

  const handleCancelCreation = async () => {
    if (currentProcessId) {
      try {
        const result = await window.electronAPI.cancelClipCreation(
          currentProcessId
        );
        if (result.success) {
          setIsCreating(false);
          setProgress(0);
          setCurrentProcessId(null);
          showWarning(t("app.clips.creator.clipCreationCancelled"));
        } else {
          showError(t("app.clips.creator.clipCancellationFailed"));
        }
      } catch (error) {
        console.error("Error cancelling clip creation:", error);
        showError(t("app.clips.creator.clipCancellationFailed"));
      }
    }
  };

  const isRetryableError = (errorMessage: string) => {
    return [
      "ERROR_INSUFFICIENT_SPACE",
      "ERROR_NO_WRITE_ACCESS",
      "ERROR_FFMPEG_FAILED",
      "ERROR_THUMBNAIL_FAILED",
    ].includes(errorMessage);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const handleCategoryToggle = (categoryId: number) => {
    setSelectedCategories(prev =>
      prev.includes(categoryId)
        ? prev.filter(id => id !== categoryId)
        : [...prev, categoryId]
    );
  };

  const generateClipTitle = () => {
    if (selectedCategories.length === 0) return "Untitled Clip";

    // Get all categories (including children) for proper name lookup
    const allCategories: Category[] = [];
    categories.forEach(cat => {
      allCategories.push(cat);
      if (cat.children) {
        allCategories.push(...cat.children);
      }
    });

    const selectedCategoryNames = allCategories
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
    // Prevent multiple simultaneous clip creations
    if (isCreating) {
      return;
    }

    if (!videoPath || markInTime === null || markOutTime === null) {
      showError(t("app.clips.creator.errorMarkPoints"));
      return;
    }

    if (!currentProject) {
      showError("No project loaded. Please select a video first.");
      return;
    }

    if (selectedCategories.length === 0) {
      showError(t("app.clips.creator.errorSelectCategory"));
      return;
    }

    // Validate video file format
    const supportedFormats = [
      ".mp4",
      ".avi",
      ".mov",
      ".mkv",
      ".wmv",
      ".flv",
      ".webm",
      ".m4v",
    ];
    const fileExtension = videoPath
      .toLowerCase()
      .substring(videoPath.lastIndexOf("."));

    if (!supportedFormats.includes(fileExtension)) {
      showError(
        t("app.clips.creator.unsupportedFormat", { format: fileExtension })
      );
      return;
    }

    // Run pre-flight system checks
    try {
      const systemCheck = await window.electronAPI.systemCheck();

      if (!systemCheck.success) {
        for (const issue of systemCheck.issues) {
          showError(t(`app.clips.creator.systemCheck.${issue.toLowerCase()}`));
        }
        return;
      }

      if (systemCheck.warnings.length > 0) {
        for (const warning of systemCheck.warnings) {
          showWarning(
            t(`app.clips.creator.systemCheck.${warning.toLowerCase()}`)
          );
        }
      }
    } catch (error) {
      console.error("System check failed:", error);
      showError(t("app.clips.creator.systemCheck.error_system_check_failed"));
      return;
    }

    await attemptCreateClip();
  };

  const attemptCreateClip = async (attempt: number = 1): Promise<void> => {
    const maxRetries = 3;
    const title = clipTitle.trim() || generateClipTitle();

    try {
      setIsCreating(true);
      setRetryCount(attempt - 1);

      await window.electronAPI.cutVideoClip({
        inputPath: videoPath!,
        startTime: markInTime!,
        endTime: markOutTime!,
        title: title,
        categories: selectedCategories,
        notes: clipNotes.trim() || undefined,
        projectId: currentProject.id,
      });
    } catch (error) {
      // Enhanced error logging for diagnostics
      const errorInfo = {
        attempt,
        timestamp: new Date().toISOString(),
        videoPath,
        markInTime,
        markOutTime,
        duration: markOutTime! - markInTime!,
        selectedCategoriesCount: selectedCategories.length,
        clipTitle: title,
        error:
          error instanceof Error
            ? {
                message: error.message,
                stack: error.stack,
                name: error.name,
              }
            : String(error),
        userAgent: navigator.userAgent,
        currentProject: currentProject
          ? {
              id: currentProject.id,
              name: currentProject.name,
            }
          : null,
      };

      console.error(`Error creating clip (attempt ${attempt}):`, errorInfo);
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Check if error is retryable and we haven't exceeded max retries
      if (isRetryableError(errorMessage) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt - 1) * 1000; // Exponential backoff: 1s, 2s, 4s
        showWarning(
          t("app.clips.creator.retryingClipCreation", {
            attempt,
            maxRetries,
            delay: delay / 1000,
          })
        );

        await sleep(delay);
        return attemptCreateClip(attempt + 1);
      }

      // Handle specific error codes with appropriate translations
      let translationKey = "app.clips.creator.errorCreating";

      switch (errorMessage) {
        case "ERROR_NO_WRITE_ACCESS":
          translationKey = "app.clips.creator.errorNoWriteAccess";
          break;
        case "ERROR_INSUFFICIENT_SPACE":
          translationKey = "app.clips.creator.errorInsufficientSpace";
          break;
        case "ERROR_FILE_NOT_FOUND":
          translationKey = "app.clips.creator.errorFileNotFound";
          break;
        case "ERROR_FFMPEG_FAILED":
          translationKey = "app.clips.creator.errorFFmpegFailed";
          break;
        case "ERROR_DATABASE_FAILED":
          translationKey = "app.clips.creator.errorDatabaseFailed";
          break;
        case "ERROR_THUMBNAIL_FAILED":
          translationKey = "app.clips.creator.errorThumbnailFailed";
          break;
        case "ERROR_INVALID_DURATION":
          translationKey = "app.clips.creator.errorInvalidDuration";
          break;
        case "ERROR_INVALID_TIME":
          translationKey = "app.clips.creator.errorInvalidTime";
          break;
        case "ERROR_INVALID_TITLE":
          translationKey = "app.clips.creator.errorInvalidTitle";
          break;
        case "ERROR_NO_CATEGORIES":
          translationKey = "app.clips.creator.errorNoCategories";
          break;
        default:
          translationKey = "app.clips.creator.errorCreating";
      }

      if (attempt >= maxRetries) {
        showError(
          t("app.clips.creator.errorAfterRetries", {
            translationKey: t(translationKey),
          })
        );
      } else {
        showError(t(translationKey));
      }

      setIsCreating(false);
      setRetryCount(0);
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
              onClick={() => {
                // Get all category IDs including children
                const allCategoryIds: number[] = [];
                categories.forEach(cat => {
                  allCategoryIds.push(cat.id);
                  if (cat.children) {
                    cat.children.forEach(child =>
                      allCategoryIds.push(child.id)
                    );
                  }
                });
                setSelectedCategories(allCategoryIds);
              }}
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
          {categories
            .filter(cat => !cat.parent_id) // Only show parent categories
            .map(parentCategory => (
              <div key={parentCategory.id} className={styles.categoryGroup}>
                {/* Parent Category Button */}
                <button
                  onClick={() => handleCategoryToggle(parentCategory.id)}
                  className={`${styles.categoryBtn} ${
                    selectedCategories.includes(parentCategory.id)
                      ? styles.selected
                      : ""
                  }`}
                  style={{
                    borderColor: parentCategory.color,
                    backgroundColor: selectedCategories.includes(
                      parentCategory.id
                    )
                      ? parentCategory.color
                      : "transparent",
                    color: selectedCategories.includes(parentCategory.id)
                      ? "#fff"
                      : parentCategory.color,
                  }}
                >
                  <span className={styles.categoryName}>
                    {parentCategory.name}
                  </span>
                  {selectedCategories.includes(parentCategory.id) && (
                    <span className={styles.selectedIndicator}>✓</span>
                  )}
                </button>

                {/* Subcategory Buttons */}
                {parentCategory.children &&
                  parentCategory.children.length > 0 && (
                    <div className={styles.subcategoryGrid}>
                      {parentCategory.children.map((subcategory: Category) => (
                        <button
                          key={subcategory.id}
                          onClick={() => handleCategoryToggle(subcategory.id)}
                          className={`${styles.categoryBtn} ${
                            styles.subcategoryBtn
                          } ${
                            selectedCategories.includes(subcategory.id)
                              ? styles.selected
                              : ""
                          }`}
                          style={{
                            borderColor: subcategory.color,
                            backgroundColor: selectedCategories.includes(
                              subcategory.id
                            )
                              ? subcategory.color
                              : "transparent",
                            color: selectedCategories.includes(subcategory.id)
                              ? "#fff"
                              : subcategory.color,
                          }}
                        >
                          <span className={styles.categoryName}>
                            └ {subcategory.name}
                          </span>
                          {selectedCategories.includes(subcategory.id) && (
                            <span className={styles.selectedIndicator}>✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            ))}
        </div>
      </div>

      {/* Clip Details */}
      <div className={styles.clipDetails}>
        <div className={styles.formGroup}>
          <label>{t("app.clips.creator.title")}</label>
          <input
            ref={clipTitleInputRef}
            type="text"
            value={clipTitle}
            onChange={e => {
              e.stopPropagation();
              setClipTitle(e.target.value);
            }}
            onKeyDown={e => {
              e.stopPropagation();
            }}
            placeholder={t("app.clips.creator.titlePlaceholder")}
            className={styles.clipTitleInput}
          />
        </div>

        <div className={styles.formGroup}>
          <label>{t("app.clips.creator.notes")}</label>
          <textarea
            ref={clipNotesInputRef}
            value={clipNotes}
            onChange={e => {
              e.stopPropagation();
              setClipNotes(e.target.value);
            }}
            onKeyDown={e => {
              e.stopPropagation();
            }}
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
          <div className={styles.progressActions}>
            <button
              onClick={handleCancelCreation}
              className={styles.cancelBtn}
              disabled={!currentProcessId}
            >
              {t("app.clips.creator.cancel")}
            </button>
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

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onRemoveToast={removeToast} />
    </div>
  );
};
