import React from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faKeyboard } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ShortcutsModal.module.css";

interface ShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShortcutsModal: React.FC<ShortcutsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { t } = useTranslation();

  if (!isOpen) return null;

  const shortcuts = [
    { key: "Space", description: t("app.shortcuts.playPause") },
    { key: "Z", description: t("app.shortcuts.markIn") },
    { key: "M", description: t("app.shortcuts.markOut") },
    { key: "Esc", description: t("app.shortcuts.clearMarks") },
    { key: "← / →", description: t("app.shortcuts.seek5s") },
    { key: "Alt + ← / →", description: t("app.shortcuts.seek30s") },
    { key: "Cmd/Ctrl + ← / →", description: t("app.shortcuts.seek1m") },
    { key: "Shift + ← / →", description: t("app.shortcuts.frameStep") },
  ];

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={e => e.stopPropagation()}>
        <div className={styles.header}>
          <h3>
            <FontAwesomeIcon icon={faKeyboard} /> {t("app.shortcuts.title")}
          </h3>
          <button className={styles.closeButton} onClick={onClose}>
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className={styles.content}>
          <table className={styles.shortcutsTable}>
            <tbody>
              {shortcuts.map((shortcut, index) => (
                <tr key={index}>
                  <td className={styles.keyCell}>
                    <kbd>{shortcut.key}</kbd>
                  </td>
                  <td className={styles.descCell}>{shortcut.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
