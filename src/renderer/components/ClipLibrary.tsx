import React, { useState, useEffect } from "react";
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
} from "@fortawesome/free-solid-svg-icons";

interface Category {
  id: number;
  name: string;
  color: string;
  description?: string;
}

interface Clip {
  id: number;
  video_path: string;
  output_path: string;
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
}

export const ClipLibrary: React.FC<ClipLibraryProps> = ({ onRefresh }) => {
  const [clips, setClips] = useState<Clip[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [filteredClips, setFilteredClips] = useState<Clip[]>([]);
  const [isExporting, setIsExporting] = useState(false);

  useEffect(() => {
    loadData();
  }, [onRefresh]);

  useEffect(() => {
    filterClips();
  }, [clips, selectedCategory]);

  const loadData = async () => {
    try {
      const [clipsData, categoriesData] = await Promise.all([
        window.electronAPI.getClips(),
        window.electronAPI.getCategories(),
      ]);

      setClips(clipsData);
      setCategories(categoriesData);
    } catch (error) {
      console.error("Error loading data:", error);
    }
  };

  const filterClips = () => {
    if (selectedCategory === null) {
      setFilteredClips(clips);
    } else {
      const filtered = clips.filter(clip => {
        try {
          const clipCategories = JSON.parse(clip.categories);
          return clipCategories.includes(selectedCategory);
        } catch {
          return false;
        }
      });
      setFilteredClips(filtered);
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
      alert("Error playing clip. File may have been moved or deleted.");
    }
  };

  const handleDeleteClip = async (clipId: number) => {
    if (
      !confirm(
        "Are you sure you want to delete this clip? The video file will be permanently deleted."
      )
    ) {
      return;
    }

    try {
      await window.electronAPI.deleteClip(clipId);
      await loadData();
    } catch (error) {
      console.error("Error deleting clip:", error);
      alert("Error deleting clip.");
    }
  };

  const handleExportCategory = async () => {
    if (selectedCategory === null || filteredClips.length === 0) {
      alert("Please select a category with clips to export.");
      return;
    }

    try {
      setIsExporting(true);
      const result = await window.electronAPI.exportClipsByCategory([
        selectedCategory,
      ]);

      if (result) {
        alert(
          `Successfully exported ${result.count} clips to ${result.exportDir}`
        );
      }
    } catch (error) {
      console.error("Error exporting clips:", error);
      alert("Error exporting clips.");
    } finally {
      setIsExporting(false);
    }
  };

  const handleExportAll = async () => {
    if (clips.length === 0) {
      alert("No clips to export.");
      return;
    }

    try {
      setIsExporting(true);
      const categoryIds = categories.map(c => c.id);
      const result = await window.electronAPI.exportClipsByCategory(
        categoryIds
      );

      if (result) {
        alert(
          `Successfully exported ${result.count} clips to ${result.exportDir}`
        );
      }
    } catch (error) {
      console.error("Error exporting clips:", error);
      alert("Error exporting clips.");
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
    return category ? category.name : "Unknown";
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
    <div className="clip-library">
      <div className="library-header">
        <h3>
          <FontAwesomeIcon icon={faFilm} /> Clip Library
        </h3>
        <div className="library-actions">
          <button onClick={openClipFolder} className="folder-btn">
            <FontAwesomeIcon icon={faFolder} /> Open Folder
          </button>
          <button
            onClick={selectedCategory ? handleExportCategory : handleExportAll}
            disabled={isExporting || filteredClips.length === 0}
            className="export-btn"
          >
            {isExporting ? (
              <>
                <FontAwesomeIcon icon={faSpinner} spin /> Exporting...
              </>
            ) : (
              <>
                <FontAwesomeIcon icon={faFileExport} /> Export
              </>
            )}
          </button>
        </div>
      </div>

      {/* Category Filter */}
      <div className="category-filter">
        <h4>Filter by Category</h4>
        <div className="filter-buttons">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`filter-btn ${
              selectedCategory === null ? "active" : ""
            }`}
          >
            All ({clips.length})
          </button>
          {categories.map(category => {
            const count = clips.filter(clip => {
              try {
                const clipCategories = JSON.parse(clip.categories);
                return clipCategories.includes(category.id);
              } catch {
                return false;
              }
            }).length;

            return (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`filter-btn ${
                  selectedCategory === category.id ? "active" : ""
                }`}
                style={{
                  borderColor: category.color,
                  backgroundColor:
                    selectedCategory === category.id
                      ? category.color
                      : "transparent",
                  color:
                    selectedCategory === category.id ? "#fff" : category.color,
                }}
              >
                {category.name} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats */}
      <div className="library-stats">
        <div className="stat-item">
          <span className="stat-label">Clips:</span>
          <span className="stat-value">{stats.count}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Total Duration:</span>
          <span className="stat-value">{stats.totalDuration}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Avg Duration:</span>
          <span className="stat-value">{stats.avgDuration}</span>
        </div>
      </div>

      {/* Clips Grid */}
      <div className="clips-grid">
        {filteredClips.length === 0 ? (
          <div className="empty-state">
            {selectedCategory === null ? (
              <div>
                <h4>
                  <FontAwesomeIcon icon={faFilm} /> No clips yet
                </h4>
                <p>Start cutting clips from your video to build your library</p>
              </div>
            ) : (
              <div>
                <h4>
                  <FontAwesomeIcon icon={faFilm} /> No clips in{" "}
                  {getCategoryName(selectedCategory)}
                </h4>
                <p>Create clips with this category to see them here</p>
              </div>
            )}
          </div>
        ) : (
          filteredClips.map(clip => {
            const clipCategories = getClipCategories(clip);
            const createdDate = new Date(clip.created_at).toLocaleDateString();

            return (
              <div key={clip.id} className="clip-card">
                {/* Clip Thumbnail Placeholder */}
                <div className="clip-thumbnail">
                  <div className="thumbnail-placeholder">
                    <span className="play-icon">▶️</span>
                    <div className="clip-duration">
                      {formatTime(clip.duration)}
                    </div>
                  </div>
                </div>

                {/* Clip Info */}
                <div className="clip-info">
                  <h4 className="clip-title">{clip.title}</h4>

                  {/* Categories */}
                  <div className="clip-categories">
                    {clipCategories.map(category => (
                      <span
                        key={category.id}
                        className="category-tag"
                        style={{ backgroundColor: category.color }}
                      >
                        {category.name}
                      </span>
                    ))}
                  </div>

                  {/* Notes */}
                  {clip.notes && <div className="clip-notes">{clip.notes}</div>}

                  {/* Metadata */}
                  <div className="clip-metadata">
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
                <div className="clip-actions">
                  <button
                    onClick={() => handlePlayClip(clip.output_path)}
                    className="play-btn"
                    title="Play clip"
                  >
                    <FontAwesomeIcon icon={faPlay} /> Play
                  </button>

                  <button
                    onClick={() => handleDeleteClip(clip.id)}
                    className="delete-btn"
                    title="Delete clip"
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
        <div className="export-info">
          <h4>
            <FontAwesomeIcon icon={faShare} /> Sharing Clips
          </h4>
          <p>
            {selectedCategory
              ? `Export all "${getCategoryName(
                  selectedCategory
                )}" clips to share with your team`
              : "Export clips organized by category for easy team sharing"}
          </p>
        </div>
      )}
    </div>
  );
};
