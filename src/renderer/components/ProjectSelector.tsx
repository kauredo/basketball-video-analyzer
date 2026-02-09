import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo,
  faPlus,
  faClock,
  faCalendar,
  faTrash,
  faFilm,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ProjectSelector.module.css";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToastContext } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";

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
  const { t, i18n } = useTranslation();
  const trapRef = useFocusTrap(isOpen);
  const { showError } = useToastContext();
  const { confirm } = useConfirm();
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
    return new Date(dateString).toLocaleDateString(i18n.language, {
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
      await confirm({
        message: t("app.projects.confirmDelete", { name: project.name }),
        danger: true,
      })
    ) {
      try {
        await window.electronAPI.deleteProject(project.id);
        loadProjects();
      } catch (error) {
        console.error("Error deleting project:", error);
        showError(t("app.projects.deleteError"));
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div
      ref={trapRef}
      className={styles.modal}
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-selector-title"
      onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}
    >
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2 id="project-selector-title">
            <FontAwesomeIcon icon={faFilm} /> {t("app.projects.selectProject")}
          </h2>
          <button
            type="button"
            className={styles.modalClose}
            onClick={onClose}
            aria-label={t("app.buttons.close")}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className={styles.modalBody}>
          {isLoading ? (
            <div className={styles.loading}>
              <FontAwesomeIcon icon={faFilm} spin />
              <p>{t("app.projects.loading")}</p>
            </div>
          ) : (
            <>
              <div className={styles.createNewSection}>
                <button type="button" className={styles.createNewBtn} onClick={onCreateNew}>
                  <FontAwesomeIcon icon={faPlus} />
                  <div>
                    <h3>{t("app.projects.createNew")}</h3>
                    <p>{t("app.projects.createNewDescription")}</p>
                  </div>
                </button>
              </div>

              {projects.length > 0 && (
                <>
                  <div className={styles.sectionHeader}>
                    <h3>{t("app.projects.recentProjects")}</h3>
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
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onSelectProject(project);
                          }
                        }}
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
                              {t("app.projects.lastOpened")}: {formatDate(project.last_opened)}
                            </span>
                            <span className={styles.metaItem}>
                              <FontAwesomeIcon icon={faCalendar} />
                              {t("app.projects.created")}: {formatDate(project.created_at)}
                            </span>
                          </div>
                        </div>
                        <div className={styles.projectActions}>
                          <button
                            type="button"
                            className={styles.deleteBtn}
                            onClick={(e) => handleDeleteProject(project, e)}
                            title={t("app.projects.deleteProject")}
                            aria-label={t("app.projects.deleteProject")}
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
                  <h3>{t("app.projects.noProjectsYet")}</h3>
                  <p>{t("app.projects.noProjectsDescription")}</p>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
