import React, { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faLightbulb, faTimes } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ContextualHint.module.css";

interface ContextualHintProps {
  hintId: string;
  message: string;
}

export const ContextualHint: React.FC<ContextualHintProps> = ({
  hintId,
  message,
}) => {
  const storageKey = `hint-dismissed-${hintId}`;
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(storageKey) === "true";
    } catch {
      return false;
    }
  });

  if (dismissed) return null;

  const handleDismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // Silently fail
    }
  };

  return (
    <div className={styles.hint} role="status">
      <FontAwesomeIcon icon={faLightbulb} className={styles.icon} />
      <p className={styles.message}>{message}</p>
      <button
        type="button"
        className={styles.dismiss}
        onClick={handleDismiss}
        aria-label="Dismiss hint"
      >
        <FontAwesomeIcon icon={faTimes} />
      </button>
    </div>
  );
};
