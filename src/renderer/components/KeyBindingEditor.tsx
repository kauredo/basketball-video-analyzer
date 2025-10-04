import React, { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faKeyboard } from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/common.module.css";

interface KeyBindingEditorProps {}

export const KeyBindingEditor: React.FC<KeyBindingEditorProps> = () => {
  const { t } = useTranslation();
  const [keyBindings, setKeyBindings] = useState({
    markInKey: "z",
    markOutKey: "m",
  });
  const [editingKey, setEditingKey] = useState<
    "markInKey" | "markOutKey" | null
  >(null);

  useEffect(() => {
    loadKeyBindings();
  }, []);

  const loadKeyBindings = async () => {
    try {
      const bindings = await window.electronAPI.getKeyBindings();
      setKeyBindings(bindings);
    } catch (error) {
      console.error("Failed to load key bindings:", error);
    }
  };

  const startEditing = (key: "markInKey" | "markOutKey") => {
    setEditingKey(key);
  };

  const handleKeyDown = async (e: React.KeyboardEvent) => {
    e.preventDefault();
    if (!editingKey) return;

    const newKey = e.key.toLowerCase();
    if (newKey === "escape") {
      setEditingKey(null);
      return;
    }

    // Don't allow modifier keys by themselves
    if (["shift", "control", "alt", "meta"].includes(newKey)) {
      return;
    }

    try {
      await window.electronAPI.setKeyBinding({
        key: editingKey,
        value: newKey,
      });
      setKeyBindings((prev) => ({ ...prev, [editingKey]: newKey }));
      alert(t("app.settings.keyBindingSaved"));
    } catch (error) {
      console.error("Failed to save key binding:", error);
    }
    setEditingKey(null);
  };

  return (
    <div className={styles.formGroup}>
      <h3>
        <FontAwesomeIcon icon={faKeyboard} /> {t("app.settings.keyBindings")}
      </h3>
      <div className={styles.formRow}>
        <div>
          <label className={styles.formLabel}>
            {t("app.settings.markInKey")}
          </label>
          <button
            type="button"
            onClick={() => startEditing("markInKey")}
            onKeyDown={editingKey === "markInKey" ? handleKeyDown : undefined}
            className={`${styles.input} ${
              editingKey === "markInKey" ? styles.editing : ""
            }`}
          >
            {editingKey === "markInKey"
              ? "Press any key..."
              : keyBindings.markInKey}
          </button>
        </div>
        <div>
          <label className={styles.formLabel}>
            {t("app.settings.markOutKey")}
          </label>
          <button
            type="button"
            onClick={() => startEditing("markOutKey")}
            onKeyDown={editingKey === "markOutKey" ? handleKeyDown : undefined}
            className={`${styles.input} ${
              editingKey === "markOutKey" ? styles.editing : ""
            }`}
          >
            {editingKey === "markOutKey"
              ? "Press any key..."
              : keyBindings.markOutKey}
          </button>
        </div>
      </div>
    </div>
  );
};
