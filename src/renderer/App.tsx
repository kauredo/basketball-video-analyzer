import React, { useState, useEffect, useCallback } from "react";
import { VideoPlayer } from "./components/VideoPlayer";
import { TaggingPanel } from "./components/TaggingPanel";
import { Timeline } from "./components/Timeline";
import "./App.css";

interface Tag {
  id: number;
  timestamp: number;
  tag_type: string;
  description?: string;
  player?: string;
  created_at?: string;
}

interface Clip {
  id: number;
  video_path: string;
  start_time: number;
  end_time: number;
  title: string;
  tags?: string;
  created_at?: string;
}

export const App: React.FC = () => {
  const [videoPath, setVideoPath] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [tags, setTags] = useState<Tag[]>([]);
  const [clips, setClips] = useState<Clip[]>([]);
  const [seekToTime, setSeekToTime] = useState<number | undefined>();
  const [playbackRate, setPlaybackRate] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Load tags when video changes
  useEffect(() => {
    if (videoPath) {
      loadTagsForVideo(videoPath);
      loadClipsForVideo(videoPath);
    }
  }, [videoPath]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Only handle shortcuts when not typing in an input
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (videoPath) {
        switch (e.key) {
          case "1":
            handleAddTag("Shot Made");
            break;
          case "2":
            handleAddTag("Shot Missed");
            break;
          case "3":
            handleAddTag("Turnover");
            break;
          case "4":
            handleAddTag("Foul");
            break;
          case "5":
            handleAddTag("Rebound");
            break;
          case "r":
            if (e.ctrlKey || e.metaKey) {
              e.preventDefault();
              setPlaybackRate(1); // Reset playback rate
            }
            break;
          case "-":
            setPlaybackRate(Math.max(0.25, playbackRate - 0.25));
            break;
          case "=":
          case "+":
            setPlaybackRate(Math.min(2, playbackRate + 0.25));
            break;
        }
      }
    };

    document.addEventListener("keydown", handleKeyPress);
    return () => document.removeEventListener("keydown", handleKeyPress);
  }, [videoPath, playbackRate]);

  const showNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => setNotification(null), 3000);
  };

  const loadTagsForVideo = async (path: string) => {
    try {
      const loadedTags = await window.electronAPI.loadTags(path);
      setTags(loadedTags);
    } catch (error) {
      console.error("Error loading tags:", error);
      showNotification("Error loading tags");
    }
  };

  const loadClipsForVideo = async (path: string) => {
    try {
      const loadedClips = await window.electronAPI.loadClips(path);
      setClips(loadedClips);
    } catch (error) {
      console.error("Error loading clips:", error);
      showNotification("Error loading clips");
    }
  };

  const handleSelectVideo = async () => {
    try {
      setIsLoading(true);
      const filePath = await window.electronAPI.selectVideoFile();
      if (filePath) {
        setVideoPath(filePath);
        setTags([]);
        setClips([]);
        setCurrentTime(0);
        setSeekToTime(0);
        showNotification("Video loaded successfully");
      }
    } catch (error) {
      console.error("Error selecting video:", error);
      showNotification("Error loading video");
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddTag = async (
    tagType: string,
    description?: string,
    player?: string
  ) => {
    if (!videoPath) {
      showNotification("Please select a video first");
      return;
    }

    try {
      const newTag = {
        video_path: videoPath,
        timestamp: currentTime,
        tag_type: tagType,
        description,
        player,
      };

      const savedTag = await window.electronAPI.saveTag(newTag);
      setTags([...tags, savedTag]);
      showNotification(`Tagged: ${tagType}`);
    } catch (error) {
      console.error("Error saving tag:", error);
      showNotification("Error saving tag");
    }
  };

  const handleTagClick = useCallback((timestamp: number) => {
    setSeekToTime(timestamp);
  }, []);

  const handleDeleteTag = async (tagId: number) => {
    try {
      await window.electronAPI.deleteTag(tagId);
      setTags(tags.filter(tag => tag.id !== tagId));
      showNotification("Tag deleted");
    } catch (error) {
      console.error("Error deleting tag:", error);
      showNotification("Error deleting tag");
    }
  };

  const handleCreateClip = async (startTime: number, endTime: number) => {
    if (!videoPath) return;

    try {
      const clipTitle = `Clip ${formatTime(startTime)} - ${formatTime(
        endTime
      )}`;
      const relatedTags = tags.filter(
        tag => tag.timestamp >= startTime && tag.timestamp <= endTime
      );

      const newClip = {
        video_path: videoPath,
        start_time: startTime,
        end_time: endTime,
        title: clipTitle,
        tags: JSON.stringify(relatedTags.map(tag => tag.tag_type)),
      };

      const savedClip = await window.electronAPI.createClip(newClip);
      setClips([...clips, savedClip]);
      showNotification(`Clip created: ${clipTitle}`);
    } catch (error) {
      console.error("Error creating clip:", error);
      showNotification("Error creating clip");
    }
  };

  const handleExportData = async () => {
    if (tags.length === 0) {
      showNotification("No data to export");
      return;
    }

    try {
      const exportData = {
        videoPath,
        tags,
        clips,
        statistics: getStatistics(),
        exportDate: new Date().toISOString(),
      };

      const filePath = await window.electronAPI.exportClipsData(exportData);
      if (filePath) {
        showNotification(`Data exported to: ${filePath}`);
      }
    } catch (error) {
      console.error("Error exporting data:", error);
      showNotification("Error exporting data");
    }
  };

  const getStatistics = () => {
    const tagCounts: { [key: string]: number } = {};
    tags.forEach(tag => {
      tagCounts[tag.tag_type] = (tagCounts[tag.tag_type] || 0) + 1;
    });

    return {
      totalTags: tags.length,
      totalClips: clips.length,
      tagCounts,
      videoDuration: duration,
      tagsPerMinute:
        duration > 0 ? (tags.length / (duration / 60)).toFixed(2) : "0",
    };
  };

  const formatTime = (time: number): string => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const resetAnalysis = () => {
    if (
      confirm(
        "Are you sure you want to clear all tags and clips? This cannot be undone."
      )
    ) {
      setTags([]);
      setClips([]);
      showNotification("Analysis reset");
    }
  };

  return (
    <div className="app">
      {/* Header */}
      <header className="app-header">
        <div className="header-content">
          <h1>🏀 Basketball Video Analyzer</h1>

          <div className="header-controls">
            <button
              onClick={handleSelectVideo}
              className="primary-btn"
              disabled={isLoading}
            >
              {isLoading ? "Loading..." : "📁 Select Video File"}
            </button>

            {videoPath && (
              <>
                <div className="playback-controls">
                  <label>Speed: </label>
                  <select
                    value={playbackRate}
                    onChange={e => setPlaybackRate(Number(e.target.value))}
                    className="speed-select"
                  >
                    <option value={0.25}>0.25x</option>
                    <option value={0.5}>0.5x</option>
                    <option value={0.75}>0.75x</option>
                    <option value={1}>1x</option>
                    <option value={1.25}>1.25x</option>
                    <option value={1.5}>1.5x</option>
                    <option value={2}>2x</option>
                  </select>
                </div>

                <button onClick={handleExportData} className="export-btn">
                  📊 Export Data
                </button>

                <button onClick={resetAnalysis} className="reset-btn">
                  🗑️ Reset
                </button>
              </>
            )}
          </div>
        </div>

        {videoPath && (
          <div className="video-info">
            <span className="file-path">📹 {videoPath.split("/").pop()}</span>
            <span className="stats">
              {tags.length} tags • {clips.length} clips • {formatTime(duration)}{" "}
              duration
            </span>
          </div>
        )}
      </header>

      {/* Notification */}
      {notification && <div className="notification">{notification}</div>}

      {/* Main Content */}
      <div className="main-content">
        <div className="video-section">
          <VideoPlayer
            videoPath={videoPath}
            onTimeUpdate={setCurrentTime}
            onDurationChange={setDuration}
            seekToTime={seekToTime}
            playbackRate={playbackRate}
          />
        </div>

        <div className="sidebar">
          <TaggingPanel
            currentTime={currentTime}
            onAddTag={handleAddTag}
            isVideoLoaded={!!videoPath}
          />
        </div>
      </div>

      {/* Timeline Section */}
      <div className="timeline-section">
        <Timeline
          tags={tags}
          duration={duration}
          currentTime={currentTime}
          onTagClick={handleTagClick}
          onDeleteTag={handleDeleteTag}
          onCreateClip={handleCreateClip}
        />
      </div>

      {/* Statistics Panel */}
      {tags.length > 0 && (
        <div className="statistics-panel">
          <h3>📈 Analysis Statistics</h3>
          <div className="stats-grid">
            {Object.entries(getStatistics().tagCounts).map(
              ([tagType, count]) => (
                <div key={tagType} className="stat-card">
                  <span className="stat-label">{tagType}:</span>
                  <span className="stat-value">{count}</span>
                </div>
              )
            )}
          </div>
          <div className="overall-stats">
            <div className="overall-stat">
              <span>Tags per Minute:</span>
              <span>{getStatistics().tagsPerMinute}</span>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="app-footer">
        <div className="footer-content">
          <div className="keyboard-shortcuts-summary">
            <strong>Quick Keys:</strong>
            <span>
              1-5 (Tag) • Space (Play/Pause) • ←/→ (Skip) • +/- (Speed)
            </span>
          </div>

          <div className="app-info">Basketball Video Analyzer v1.0</div>
        </div>
      </footer>
    </div>
  );
};
