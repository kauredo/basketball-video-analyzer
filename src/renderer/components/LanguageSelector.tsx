import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/LanguageSelector.module.css";
import { useToastContext } from "../contexts/ToastContext";

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className,
}) => {
  const { t, i18n } = useTranslation();
  const { showSuccess } = useToastContext();

  const languages = [
    { code: "en", name: "English" },
    { code: "pt", name: "Português (Portugal)" },
  ];

  const handleLanguageChange = (languageCode: string) => {
    const lang = languages.find(l => l.code === languageCode);
    i18n.changeLanguage(languageCode).then(() => {
      if (lang) {
        showSuccess(t("app.settings.languageChanged", { language: lang.name }));
      }
    });
  };

  return (
    <div className={`${styles.languageSelector} ${className || ""}`}>
      <label className={styles.label} htmlFor="language-select">
        {t("app.settings.language")}:
      </label>
      <select
        id="language-select"
        value={i18n.language}
        onChange={(e) => handleLanguageChange(e.target.value)}
        className={styles.select}
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.name}
          </option>
        ))}
      </select>
    </div>
  );
};
