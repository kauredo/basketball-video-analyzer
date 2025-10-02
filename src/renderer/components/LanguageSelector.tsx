import React from "react";
import { useTranslation } from "react-i18next";
import styles from "../styles/LanguageSelector.module.css";

interface LanguageSelectorProps {
  className?: string;
}

export const LanguageSelector: React.FC<LanguageSelectorProps> = ({
  className,
}) => {
  const { i18n } = useTranslation();

  const languages = [
    { code: "en", name: "English" },
    { code: "pt", name: "Português (Portugal)" },
  ];

  const handleLanguageChange = (languageCode: string) => {
    i18n.changeLanguage(languageCode);
  };

  return (
    <div className={`${styles.languageSelector} ${className || ""}`}>
      <label className={styles.label}>
        {i18n.language === "en" ? "Language" : "Idioma"}:
      </label>
      <select
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
