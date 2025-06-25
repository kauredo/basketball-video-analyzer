import React from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilm,
  faVideo,
  faScissors,
  faTags,
  faShare,
  faRocket,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/InstructionsModal.module.css";

interface InstructionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectVideo: () => void;
  showSelectVideoButton?: boolean;
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
  onSelectVideo,
  showSelectVideoButton = true,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <div className={styles.modalHeader}>
          <h2>
            <FontAwesomeIcon icon={faFilm} /> {t("app.welcome.title")}
          </h2>
          <button className={styles.modalClose} onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <div className={styles.modalBody}>
          <p className={styles.subtitle}>{t("app.welcome.subtitle")}</p>

          <div className={styles.workflowSteps}>
            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <p>1</p>
              </div>
              <div className={styles.stepContent}>
                <h3>
                  <FontAwesomeIcon icon={faVideo} />{" "}
                  {t("app.welcome.steps.loadVideo.title")}
                </h3>
                <p>{t("app.welcome.steps.loadVideo.description")}</p>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <p>2</p>
              </div>
              <div className={styles.stepContent}>
                <h3>
                  <FontAwesomeIcon icon={faScissors} />{" "}
                  {t("app.welcome.steps.markClips.title")}
                </h3>
                <p>{t("app.welcome.steps.markClips.description")}</p>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <p>3</p>
              </div>
              <div className={styles.stepContent}>
                <h3>
                  <FontAwesomeIcon icon={faTags} />{" "}
                  {t("app.welcome.steps.categorize.title")}
                </h3>
                <p>{t("app.welcome.steps.categorize.description")}</p>
              </div>
            </div>

            <div className={styles.step}>
              <div className={styles.stepNumber}>
                <p>4</p>
              </div>
              <div className={styles.stepContent}>
                <h3>
                  <FontAwesomeIcon icon={faShare} />{" "}
                  {t("app.welcome.steps.share.title")}
                </h3>
                <p>{t("app.welcome.steps.share.description")}</p>
              </div>
            </div>
          </div>

          {showSelectVideoButton && (
            <button onClick={onSelectVideo} className={styles.getStartedBtn}>
              <FontAwesomeIcon icon={faRocket} /> {t("app.buttons.getStarted")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
