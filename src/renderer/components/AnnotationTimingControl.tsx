import React from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { REPLAY_SECONDS_OPTIONS } from "../utils/telestration";
import styles from "../styles/AnnotationTimingControl.module.css";

interface AnnotationTimingControlProps {
  seconds: number | null;
  onSecondsChange: (seconds: number | null) => void;
  defaultSeconds: number;
}

export const AnnotationTimingControl: React.FC<
  AnnotationTimingControlProps
> = ({ seconds, onSecondsChange, defaultSeconds }) => {
  const { t } = useTranslation();
  const label = t("app.telestration.drawingSeconds");

  return (
    <label className={styles.field} title={label}>
      <FontAwesomeIcon icon={faClock} aria-hidden />
      <select
        className={styles.select}
        value={seconds ?? ""}
        onChange={e =>
          onSecondsChange(e.target.value === "" ? null : Number(e.target.value))
        }
        aria-label={label}
      >
        <option value="">
          {t("app.telestration.drawingSecondsDefault", {
            seconds: defaultSeconds,
          })}
        </option>
        {REPLAY_SECONDS_OPTIONS.map(s => (
          <option key={s} value={s}>
            {s}s
          </option>
        ))}
      </select>
    </label>
  );
};
