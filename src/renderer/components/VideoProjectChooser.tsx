import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChevronRight, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { formatDateTime } from "../utils/format";
import type { Project } from "./ProjectSelector";
import dialogStyles from "../styles/ConfirmDialog.module.css";
import styles from "../styles/VideoProjectChooser.module.css";

interface VideoProjectChooserProps {
  videoName: string;
  defaultName: string;
  projects: Project[];
  busy: boolean;
  onOpen: (project: Project) => void;
  onCreate: (name: string) => void;
  onCancel: () => void;
}

export const VideoProjectChooser: React.FC<VideoProjectChooserProps> = ({
  videoName,
  defaultName,
  projects,
  busy,
  onOpen,
  onCreate,
  onCancel,
}) => {
  const { t, i18n } = useTranslation();
  const trapRef = useFocusTrap(true);
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();
  const dismiss = () => {
    if (!busy) onCancel();
  };

  return (
    <div
      ref={trapRef}
      className={dialogStyles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-project-chooser-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) dismiss();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && !e.nativeEvent.isComposing) dismiss();
      }}
    >
      <div className={dialogStyles.dialog}>
        <div className={dialogStyles.header}>
          <h2 id="video-project-chooser-title" className={styles.title}>
            {t("app.projects.chooserTitle")}
          </h2>
          <button
            type="button"
            className={dialogStyles.closeButton}
            onClick={dismiss}
            aria-label={t("app.buttons.close")}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <p className={styles.videoName}>
          {t("app.projects.chooserMessage", { video: videoName })}
        </p>

        <h3 className={styles.sectionHeading}>
          {t("app.projects.chooserOpenHeading")}
        </h3>
        <ul className={styles.projectList}>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className={styles.projectButton}
                onClick={() => onOpen(project)}
              >
                <span className={styles.projectText}>
                  <span className={styles.projectName} title={project.name}>
                    {project.name}
                  </span>
                  <span className={styles.projectMeta}>
                    {t("app.projects.lastOpened")}:{" "}
                    {formatDateTime(project.last_opened, i18n.language)}
                  </span>
                </span>
                <FontAwesomeIcon icon={faChevronRight} className={styles.chevron} />
              </button>
            </li>
          ))}
        </ul>

        <form
          className={styles.newProject}
          onSubmit={(e) => {
            e.preventDefault();
            if (trimmed && !busy) onCreate(trimmed);
          }}
        >
          <h3 className={styles.sectionHeading}>
            {t("app.projects.chooserNewProject")}
          </h3>
          <label htmlFor="video-project-chooser-name" className={styles.label}>
            {t("app.projects.chooserNameLabel")}
          </label>
          <div className={styles.createRow}>
            <input
              id="video-project-chooser-name"
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-describedby={trimmed ? undefined : "video-project-chooser-hint"}
            />
            <button
              type="submit"
              className={dialogStyles.confirmButton}
              disabled={!trimmed || busy}
            >
              {t("app.projects.chooserCreate")}
            </button>
          </div>
          {!trimmed && (
            <p id="video-project-chooser-hint" className={styles.hint}>
              {t("app.projects.chooserNameHint")}
            </p>
          )}
        </form>
      </div>
    </div>
  );
};
