import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBug,
  faLightbulb,
  faComment,
  faSpinner,
  faPaperPlane,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/FeedbackModal.module.css";
import { useToastContext } from "../contexts/ToastContext";

const FEEDBACK_URL = "https://bva-feedback.kauredo.workers.dev/feedback";
const DESC_MAX = 2000;

type FeedbackType = "bug" | "feature" | "feedback";

interface FeedbackModalProps {
  onClose: () => void;
}

const TYPE_ICONS = { bug: faBug, feature: faLightbulb, feedback: faComment };

const SELECTED_CLASS: Record<FeedbackType, string> = {
  bug: styles.selectedBug,
  feature: styles.selectedFeature,
  feedback: styles.selectedFeedback,
};

export const FeedbackModal: React.FC<FeedbackModalProps> = ({ onClose }) => {
  const { t } = useTranslation();
  const { showSuccess, showError } = useToastContext();
  const [type, setType] = useState<FeedbackType>("bug");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const systemInfo = `${navigator.platform} | ${navigator.userAgent.match(/Electron\/[\d.]+/)?.[0] || "Electron"}`;

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) return;

    setSubmitting(true);
    try {
      const res = await fetch(FEEDBACK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type,
          title: title.trim(),
          description: description.trim(),
          appVersion: navigator.userAgent.match(/basketball-video-analyzer\/([\d.]+)/)?.[1] || "unknown",
          os: navigator.platform,
          platform: process.platform || navigator.platform,
        }),
      });

      if (!res.ok) throw new Error("Failed");

      showSuccess(t("app.feedback.submitSuccess"));
      onClose();
    } catch {
      showError(t("app.feedback.submitError"));
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit = title.trim().length > 0 && description.trim().length > 0 && !submitting;
  const descRemaining = DESC_MAX - description.length;

  return (
    <div className={styles.feedbackForm}>
      <div className={styles.formGroup}>
        <label>{t("app.feedback.type")}</label>
        <div className={styles.typeSelector}>
          {(["bug", "feature", "feedback"] as FeedbackType[]).map((t_) => (
            <button
              key={t_}
              type="button"
              className={`${styles.typeButton} ${type === t_ ? SELECTED_CLASS[t_] : ""}`}
              onClick={() => setType(t_)}
              aria-pressed={type === t_}
            >
              <FontAwesomeIcon icon={TYPE_ICONS[t_]} />
              {t(`app.feedback.types.${t_}`)}
            </button>
          ))}
        </div>
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="feedback-title">{t("app.feedback.titleLabel")}</label>
        <input
          id="feedback-title"
          type="text"
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t(`app.feedback.titlePlaceholder_${type}`)}
          maxLength={100}
        />
      </div>

      <div className={styles.formGroup}>
        <label htmlFor="feedback-desc">{t("app.feedback.descriptionLabel")}</label>
        <textarea
          id="feedback-desc"
          className={styles.descriptionInput}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder={t(`app.feedback.descriptionPlaceholder_${type}`)}
          maxLength={DESC_MAX}
        />
        <div className={`${styles.charCount} ${descRemaining < 200 ? styles.charCountWarn : ""}`}>
          {description.length}/{DESC_MAX}
        </div>
      </div>

      {type === "bug" && (
        <div className={styles.typeHint}>{t("app.feedback.hint_bug")}</div>
      )}

      <div className={styles.footer}>
        <div className={styles.systemInfo}>
          {t("app.feedback.systemInfoNote")}: {systemInfo}
        </div>
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={onClose}
          >
            {t("app.buttons.cancel")}
          </button>
          <button
            type="button"
            className={styles.submitBtn}
            onClick={handleSubmit}
            disabled={!canSubmit}
          >
            {submitting ? (
              <FontAwesomeIcon icon={faSpinner} spin />
            ) : (
              <FontAwesomeIcon icon={faPaperPlane} />
            )}
            {submitting ? t("app.feedback.submitting") : t("app.feedback.submit")}
          </button>
        </div>
      </div>
    </div>
  );
};
