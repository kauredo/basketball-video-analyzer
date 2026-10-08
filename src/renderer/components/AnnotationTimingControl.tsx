import React, { RefObject, useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { AnnotationTiming } from "../../types/global";
import { REPLAY_SECONDS_OPTIONS } from "../utils/telestration";
import { useDismissableMenu } from "../hooks/useDismissableMenu";
import styles from "../styles/AnnotationTimingControl.module.css";

interface AnnotationTimingControlProps {
  value: AnnotationTiming;
  onChange: (changes: AnnotationTiming) => void;
  defaultSeconds: number;
  selectRef?: RefObject<HTMLSelectElement>;
  // The toolbar has room for an icon only; the popover spells the label out.
  showLabel?: boolean;
}

export const AnnotationTimingControl: React.FC<
  AnnotationTimingControlProps
> = ({ value, onChange, defaultSeconds, selectRef, showLabel }) => {
  const { t } = useTranslation();
  const label = t("app.telestration.drawingSeconds");

  return (
    <span className={styles.controls}>
      <label className={styles.field} title={label}>
        {showLabel ? (
          t("app.telestration.showFor")
        ) : (
          <FontAwesomeIcon icon={faClock} aria-hidden />
        )}
        <select
          ref={selectRef}
          className={styles.select}
          value={value.display_seconds ?? ""}
          onChange={e =>
            onChange({
              display_seconds:
                e.target.value === "" ? null : Number(e.target.value),
            })
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
      <label className={styles.field}>
        <input
          type="checkbox"
          className={styles.checkbox}
          checked={value.pause_playback === true}
          onChange={e => onChange({ pause_playback: e.target.checked })}
        />
        {t("app.telestration.pauseVideo")}
      </label>
    </span>
  );
};

// Past these points along the timeline the popover would hang off the edge,
// so it lines up with the marker's side instead of centring on it.
const EDGE_START_PCT = 15;
const EDGE_END_PCT = 85;

interface AnnotationTimingPopoverProps {
  id: string;
  heading: string;
  positionPct: number;
  value: AnnotationTiming;
  onChange: (changes: AnnotationTiming) => void;
  defaultSeconds: number;
  triggerRef: RefObject<HTMLButtonElement>;
  onClose: () => void;
}

export const AnnotationTimingPopover: React.FC<
  AnnotationTimingPopoverProps
> = ({
  id,
  heading,
  positionPct,
  value,
  onChange,
  defaultSeconds,
  triggerRef,
  onClose,
}) => {
  const { t } = useTranslation();
  const popoverRef = useRef<HTMLDivElement>(null);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    selectRef.current?.focus();
  }, []);

  useDismissableMenu(
    true,
    useCallback(() => {
      triggerRef.current?.focus();
      onClose();
    }, [triggerRef, onClose]),
    [popoverRef, triggerRef]
  );

  const shift =
    positionPct < EDGE_START_PCT
      ? "0"
      : positionPct > EDGE_END_PCT
        ? "-100%"
        : "-50%";

  return (
    <div
      id={id}
      ref={popoverRef}
      className={styles.popover}
      style={{ left: `${positionPct}%`, transform: `translateX(${shift})` }}
      role="group"
      aria-label={t("app.telestration.editTiming")}
    >
      <span className={styles.popoverHeading}>{heading}</span>
      <AnnotationTimingControl
        value={value}
        onChange={onChange}
        defaultSeconds={defaultSeconds}
        selectRef={selectRef}
        showLabel
      />
    </div>
  );
};
