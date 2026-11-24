import React, { useState, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faVideo,
  faPlus,
  faClock,
  faCalendar,
  faTrash,
  faPen,
  faFilm,
  faTimes,
  faFileImport,
  faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ProjectSelector.module.css";
import { YouTubeImport } from "./YouTubeImport";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToastContext } from "../contexts/ToastContext";
import { useConfirm } from "../contexts/ConfirmContext";
import { errorCode, withCause } from "../utils/errors";
import { savePref } from "../utils/storage";
import { projectPlaybackKey } from "../utils/projectPlayback";
import { formatDateTime } from "../utils/format";

export interface Project {
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
  onRenameProject: (id: number, name: string) => void;
  onSelectProject: (project: Project) => void;
  onCreateNew: () => void;
  onLoadVideoByPath?: (filePath: string) => void;
}

export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  isOpen,
  onClose,
  onSelectProject,
  onRenameProject,
  onCreateNew,
  onLoadVideoByPath,
}) => {
  const { t, i18n } = useTranslation();
  const trapRef = useFocusTrap(isOpen);
  const { showError, showSuccess } = useToastContext();
  const { confirm } = useConfirm();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [missingPaths, setMissingPaths] = useState<Record<string, boolean>>({});

  const [renaming, setRenaming] = useState<{ id: number; name: string } | null>(null);
  const [isRenaming, setIsRenaming] = useState(false);

  const renameTrigger = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!renaming && !isRenaming) {
      if (isOpen) renameTrigger.current?.focus();
      renameTrigger.current = null;
    }
  }, [renaming, isRenaming, isOpen]);

  const submitRename = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!renaming || !renaming.name.trim() || isRenaming) return;
    const { id } = renaming;
    const name = renaming.name.trim();
    try {
      setIsRenaming(true);
      if (!(await window.electronAPI.renameProject(id, name))) {
        showError(t("app.projects.renameError"));
        return;
      }
      setProjects((list) => list.map((project) => project.id === id ? { ...project, name } : project));
      onRenameProject(id, name);
      setRenaming(null);
    } catch (error) {
      showError(withCause(t("app.projects.renameError"), error));
    } finally {
      setIsRenaming(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadProjects();
    } else {
      setRenaming(null);
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

      const paths = sortedProjects.map((p: Project) => p.video_path);
      if (paths.length > 0) {
        const existence = await window.electronAPI.checkPathsExist(paths);
        const missing: Record<string, boolean> = {};
        for (const p of paths) {
          if (!existence[p]) missing[p] = true;
        }
        setMissingPaths(missing);
      } else {
        setMissingPaths({});
      }
    } catch (error) {
      console.error("Error loading projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => formatDateTime(dateString, i18n.language);

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
        savePref(projectPlaybackKey(project.id), 0);
        loadProjects();
      } catch (error) {
        console.error("Error deleting project:", error);
        showError(withCause(t("app.projects.deleteError"), error));
      }
    }
  };

  const handleImportSession = async () => {
    try {
      const result = await window.electronAPI.loadSession();
      if (result?.success && result.project) {
        showSuccess(t("app.projects.importSessionSuccess"));
        onSelectProject(result.project);
      }
    } catch (error) {
      console.error("Error importing session:", error);
      const message = errorCode(error) === "INVALID_SESSION_FILE"
        ? t("app.projects.importSessionInvalidFile")
        : t("app.projects.importSessionError");
      showError(message);
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
      onKeyDown={(event) => {
        if (event.key !== "Escape") return;
        if (renaming) {
          if (!isRenaming) setRenaming(null);
        } else {
          onClose();
        }
      }}
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
                <button type="button" className={styles.secondaryActionBtn} onClick={handleImportSession}>
                  <FontAwesomeIcon icon={faFileImport} />
                  <div>
                    <h3>{t("app.projects.importSession")}</h3>
                    <p>{t("app.projects.importSessionDescription")}</p>
                  </div>
                </button>
              </div>

              {onLoadVideoByPath && (
                <YouTubeImport onVideoDownloaded={onLoadVideoByPath} />
              )}

              {projects.length > 0 && (
                <>
                  <div className={styles.sectionHeader}>
                    <h3>{t("app.projects.recentProjects")}</h3>
                    <span className={styles.projectCount}>
                      {t("app.projects.projectCount", { count: projects.length })}
                    </span>
                  </div>

                  <div className={styles.projectsList}>
                    {projects.map((project) => {
                      const isMissing = !!missingPaths[project.video_path];
                      return (
                      <React.Fragment key={project.id}>
                      <div
                        className={`${styles.projectCard} ${
                          isMissing ? styles.projectCardMissing : ""
                        }`}
                        onClick={() => onSelectProject(project)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.target === e.currentTarget && (e.key === "Enter" || e.key === " ")) {
                            e.preventDefault();
                            onSelectProject(project);
                          }
                        }}
                      >
                        <div className={styles.projectIcon}>
                          <FontAwesomeIcon icon={faVideo} />
                        </div>
                        <div className={styles.projectInfo}>
                          <div className={styles.projectNameRow}>
                            <h4 className={styles.projectName}>{project.name}</h4>
                            {isMissing && (
                              <span
                                className={styles.missingBadge}
                                title={t("app.projects.videoMissingTitle")}
                              >
                                <FontAwesomeIcon icon={faTriangleExclamation} />
                                {t("app.projects.videoMissingBadge")}
                              </span>
                            )}
                          </div>
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
                              {t(project.id === projects[0].id
                                ? "app.projects.lastProjectOpened"
                                : "app.projects.lastOpened")}: {formatDate(project.last_opened)}
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
                            className={styles.renameBtn}
                            onClick={(event) => {
                              event.stopPropagation();
                              renameTrigger.current = event.currentTarget;
                              setRenaming({ id: project.id, name: project.name });
                            }}
                            disabled={isRenaming}
                            title={t("app.projects.renameProject")}
                            aria-label={t("app.projects.renameProject")}
                            aria-expanded={renaming?.id === project.id}
                          >
                            <FontAwesomeIcon icon={faPen} />
                          </button>
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
                      {renaming?.id === project.id && (
                        <form className={styles.renameForm} onSubmit={submitRename}>
                          <label htmlFor="rename-project">{t("app.projects.chooserNameLabel")}</label>
                          <input
                            id="rename-project"
                            value={renaming.name}
                            maxLength={200}
                            autoFocus
                            onFocus={(event) => event.currentTarget.select()}
                            onChange={(event) => setRenaming({ id: project.id, name: event.target.value })}
                            disabled={isRenaming}
                          />
                          <button type="submit" disabled={isRenaming || !renaming.name.trim()}>
                            {t("app.buttons.save")}
                          </button>
                          <button type="button" disabled={isRenaming} onClick={() => setRenaming(null)}>
                            {t("app.buttons.cancel")}
                          </button>
                        </form>
                      )}
                      </React.Fragment>
                      );
                    })}
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
