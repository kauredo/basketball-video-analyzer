import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo,
  faFolderOpen,
  faPlus,
  faClock,
  faCalendar,
  faTrash,
  faFilm,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ProjectSelector.module.css";

interface Project {
  id: number;
  name: string;
  video_path: string;
  video_name: string;
  description?: string;
  created_at: string;
  last_opened: string;
}

interface ProjectSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectProject: (project: Project) => void;
  onCreateNew: () => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onCreateNew,
}) => {
  const { t } = useTranslation();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    }
  }, [isOpen]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const projectsData = await window.electronAPI.getProjects();
      // Sort by last_opened (most recent first)
      const sortedProjects = projectsData.sort(
        (a, b) =>
          new Date(b.last_opened).getTime() - new Date(a.last_opened).getTime(),
      );
      setProjects(sortedProjects);
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleDeleteProject = async (
    project: Project,
    event: React.MouseEvent,
  ) => {
    event.stopPropagation();

    if (
      window.confirm(
        `Are you sure you want to delete the project "${project.name}"? This will also delete all associated clips.`,
      )
    ) {
      try {
        await window.electronAPI.deleteProject(project.id);
        loadProjects(); // Refresh the list
      } catch (error) {
        console.error("Error deleting project:", error);
        alert("Error deleting project. Please try again.");
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>
            <FontAwesomeIcon icon={faFilm} /> Select Project
          </h2>
          <button type="button" className={styles.modalClose} onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.loading}>
              <FontAwesomeIcon icon={faFilm} spin />
              <p>Loading projects...</p>
            </div>
          ) : (
            <>
              <div className={styles.createNewSection}>
                <button type="button" className={styles.createNewBtn} onClick={onCreateNew}>
                  <FontAwesomeIcon icon={faPlus} />
                  <div>
                    <h3>Create New Project</h3>
                    <p>Start with a new video file</p>
                  </div>
                </button>
              </div>

              {projects.length > 0 && (
                <>
                  <div className={styles.sectionHeader}>
                    <h3>Recent Projects</h3>
                    <span className={styles.projectCount}>
                      {projects.length} project
                      {projects.length !== 1 ? "s" : ""}
                    </span>
                  </div>

                  <div className={styles.projectsList}>
                    {projects.map((project) => (
                      <div
                        key={project.id}
                        className={styles.projectCard}
                        onClick={() => onSelectProject(project)}
                      >
                        <div className={styles.projectIcon}>
                          <FontAwesomeIcon icon={faVideo} />
                        </div>
                        <div className={styles.projectInfo}>
                          <h4 className={styles.projectName}>{project.name}</h4>
                          <p className={styles.projectVideo}>
                            {project.video_name}
                          </p>
                          {project.description && (
                            <p className={styles.projectDescription}>
                              {project.description}
                            </p>
                          )}
                          <div className={styles.projectMeta}>
                            <span className={styles.metaItem}>
                              <FontAwesomeIcon icon={faClock} />
                              Last opened: {formatDate(project.last_opened)}
                            </span>
                            <span className={styles.metaItem}>
                              <FontAwesomeIcon icon={faCalendar} />
                              Created: {formatDate(project.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className={styles.projectActions}>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={(e) => handleDeleteProject(project, e)}
                            title="Delete project"
                          >
                            <FontAwesomeIcon icon={faTrash} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {projects.length === 0 && !isLoading && (
                <div className={styles.emptyState}>
                  <FontAwesomeIcon icon={faVideo} />
                  <h3>No Projects Yet</h3>
                  <p>
                    Create your first project to get started with video
                    analysis.
                  </p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
