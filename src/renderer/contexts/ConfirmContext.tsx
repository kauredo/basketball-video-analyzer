import React, { createContext, useContext, useState, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faExclamationTriangle, faTimes } from "@fortawesome/free-solid-svg-icons";
import { useTranslation } from "react-i18next";
import { useFocusTrap } from "../hooks/useFocusTrap";
import styles from "../styles/ConfirmDialog.module.css";

interface ConfirmOptions {
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
}

interface ConfirmContextValue {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

export const ConfirmProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { t } = useTranslation();
  const [pending, setPending] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const trapRef = useFocusTrap(pending !== null);

  const confirmFn = useCallback(
    (options: ConfirmOptions): Promise<boolean> => {
      return new Promise((resolve) => {
        setPending({ options, resolve });
      });
    },
    [],
  );

  const handleConfirm = () => {
    pending?.resolve(true);
    setPending(null);
  };

  const handleCancel = () => {
    pending?.resolve(false);
    setPending(null);
  };

  return (
    <ConfirmContext.Provider value={{ confirm: confirmFn }}>
      {children}
      {pending && (
        <div
          ref={trapRef}
          className={styles.overlay}
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="confirm-dialog-message"
          onClick={(e) => {
            if (e.target === e.currentTarget) handleCancel();
          }}
          onKeyDown={(e) => {
            if (e.key === "Escape") handleCancel();
          }}
        >
          <div className={styles.dialog}>
            <div className={styles.header}>
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                className={
                  pending.options.danger ? styles.iconDanger : styles.iconWarning
                }
              />
              <button
                type="button"
                className={styles.closeButton}
                onClick={handleCancel}
                aria-label={t("app.buttons.close")}
              >
                <FontAwesomeIcon icon={faTimes} />
              </button>
            </div>
            <p id="confirm-dialog-message" className={styles.message}>
              {pending.options.message}
            </p>
            <div className={styles.actions}>
              <button
                type="button"
                className={styles.cancelButton}
                onClick={handleCancel}
              >
                {pending.options.cancelLabel || t("app.buttons.cancel")}
              </button>
              <button
                type="button"
                className={`${styles.confirmButton} ${
                  pending.options.danger ? styles.danger : ""
                }`}
                onClick={handleConfirm}
              >
                {pending.options.confirmLabel || t("app.buttons.ok")}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = (): ConfirmContextValue => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error("useConfirm must be used within a ConfirmProvider");
  }
  return context;
};
