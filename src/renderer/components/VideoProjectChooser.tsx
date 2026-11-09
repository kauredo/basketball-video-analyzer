import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFilm, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useFocusTrap } from "../hooks/useFocusTrap";
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
  const { t } = useTranslation();
  const trapRef = useFocusTrap(true);
  const [name, setName] = useState(defaultName);
  const trimmed = name.trim();

  return (
    <div
      ref={trapRef}
      className={dialogStyles.overlay}
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-project-chooser-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") onCancel();
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
            onClick={onCancel}
            aria-label={t("app.buttons.close")}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <p className={dialogStyles.message}>
          {t("app.projects.chooserMessage", { video: videoName })}
        </p>

        <ul className={styles.projectList}>
          {projects.map((project) => (
            <li key={project.id}>
              <button
                type="button"
                className={styles.projectButton}
                onClick={() => onOpen(project)}
              >
                <FontAwesomeIcon icon={faFilm} className={styles.projectIcon} />
                <span className={styles.projectName}>{project.name}</span>
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
          <h3 className={styles.newProjectHeading}>
            {t("app.projects.chooserNewProject")}
          </h3>
          <label htmlFor="video-project-chooser-name" className={styles.label}>
            {t("app.projects.chooserNameLabel")}
          </label>
          <input
            id="video-project-chooser-name"
            className={styles.input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className={dialogStyles.actions}>
            <button
              type="button"
              className={dialogStyles.cancelButton}
              onClick={onCancel}
            >
              {t("app.buttons.cancel")}
            </button>
            <button
              type="submit"
              className={dialogStyles.confirmButton}
              disabled={!trimmed || busy}
            >
              {t("app.projects.chooserCreate")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
