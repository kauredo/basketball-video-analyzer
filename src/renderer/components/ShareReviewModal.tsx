import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faCodeMerge, faSpinner } from "@fortawesome/free-solid-svg-icons";
import base from "../styles/ShareProjectModal.module.css";
import styles from "../styles/ShareReviewModal.module.css";
import { useFocusTrap } from "../hooks/useFocusTrap";
import { useToastContext } from "../contexts/ToastContext";
import { errorCode } from "../utils/errors";
import { formatVideoTime } from "../utils/format";
import { inkOn } from "../utils/contrast";
import { statusLabelKey } from "../utils/constants";
import { mergedMessage, openSharedError } from "../utils/shareMessages";
import {
  appliedCount, hasRowCheckbox, initialChoices, initialSelected, pickAll,
  type ReviewField, type ReviewGroup, type ReviewRow, type ReviewSelections, type ReviewSide, type ReviewValue,
  type ShareReview,
} from "../../shared/shareReview";
import type { Project } from "./ProjectSelector";

const GROUPS: ReviewGroup[] = ["new", "changed", "conflict", "deleted"];

interface ShareReviewModalProps {
  name: string;
  review: ShareReview;
  onMerged: (project: Project) => void;
  /** A ticked new recording comes in the bundle: copy it or use it where it is. */
  onChoose: (choice: { videoBytes: number; canCopy: boolean }, selections: ReviewSelections) => void;
  onClose: () => void;
}

const Tags: React.FC<{ tags: Array<{ name: string; color: string | null }> }> = ({ tags }) => (
  <>
    {tags.map(tag => (
      <span
        key={tag.name}
        className={styles.tag}
        style={tag.color ? { backgroundColor: tag.color, color: inkOn(tag.color) } : undefined}
      >
        {tag.name}
      </span>
    ))}
  </>
);

export const ShareReviewModal: React.FC<ShareReviewModalProps> = ({ name, review, onMerged, onChoose, onClose }) => {
  const { t } = useTranslation();
  const { showSuccess, showInfo, showError } = useToastContext();
  const trapRef = useFocusTrap(true);
  const [selected, setSelected] = useState(() => initialSelected(review.rows));
  const [choices, setChoices] = useState(() => initialChoices(review.rows));
  const [applying, setApplying] = useState(false);

  const close = () => {
    if (applying) return;
    window.electronAPI.discardSharedProject();
    onClose();
  };

  const apply = async () => {
    const selections = { selected, choices };
    setApplying(true);
    try {
      const result = await window.electronAPI.applySharedReview(selections);
      if (result.status === "choose") {
        onChoose(result, selections);
        return;
      }
      if (result.status === "merged") {
        showSuccess(mergedMessage(t, result.kept, result.heldBack));
        onMerged(result.project);
      }
      onClose();
    } catch (err) {
      if (errorCode(err) === "ERROR_IMPORT_CANCELLED") showInfo(t("app.openShared.cancelled"));
      else showError(openSharedError(t, err, "app.review.failed"));
      window.electronAPI.discardSharedProject();
      onClose();
    } finally {
      setApplying(false);
    }
  };

  const fieldLabel = (field: string) => t(`app.review.fields.${field}`);

  const valueView = (field: string, value: ReviewValue): React.ReactNode => {
    const none = <span className={styles.none}>{t("app.review.none")}</span>;
    switch (value.type) {
      case "text":
        return value.text ? <span className={styles.text}>{value.text}</span> : none;
      case "time":
        return `${formatVideoTime(value.start)}–${formatVideoTime(value.end)}`;
      case "seconds":
        if (value.seconds === null) return t("app.review.defaultSeconds");
        return field === "timestamp" ? formatVideoTime(value.seconds) : t("app.review.seconds", { seconds: value.seconds });
      case "tags":
        return value.tags.length ? <Tags tags={value.tags} /> : none;
      case "color":
        return <span className={styles.swatch} style={{ backgroundColor: value.color }} title={value.color} />;
      case "flag":
        return value.on ? t("app.review.yes") : t("app.review.no");
      case "status":
        return value.status ? t(statusLabelKey(value.status)) : none;
      case "court":
        return value.set ? t("app.review.courtSet") : none;
      case "shapes":
        return t("app.review.shapes", { count: value.count });
      case "exists":
        return value.exists ? t("app.review.yes") : t("app.review.no");
    }
  };

  const setAll = (rows: ReviewRow[], on: boolean) =>
    setSelected(current => ({ ...current, ...Object.fromEntries(rows.map(row => [row.token, on])) }));

  const pickSide = (rows: ReviewRow[], side: ReviewSide) => {
    const next = pickAll(choices, selected, rows, side);
    setChoices(next.choices);
    setSelected(next.selected);
  };

  const change = (item: ReviewField) => (
    <div key={item.field} className={styles.field}>
      <dt>{fieldLabel(item.field)}</dt>
      <dd>
        <span className={styles.old}>{valueView(item.field, item.mine)}</span>
        <span className={styles.arrow} aria-hidden="true">→</span>
        {valueView(item.field, item.theirs)}
      </dd>
    </div>
  );

  const conflict = (row: ReviewRow, item: ReviewField) => {
    const pick = choices[row.token]?.[item.field] ?? "mine";
    const side = (value: "mine" | "theirs") => (
      <label className={styles.side}>
        <input
          type="radio"
          name={`${row.token}:${item.field}`}
          checked={pick === value}
          onChange={() => setChoices(current =>
            ({ ...current, [row.token]: { ...current[row.token], [item.field]: value } }))}
        />
        <span className={styles.sideName}>{t(`app.review.${value}`)}</span>
        {valueView(item.field, value === "mine" ? item.mine : item.theirs)}
      </label>
    );
    return (
      <fieldset key={item.field} className={styles.conflict} disabled={!selected[row.token] || applying}>
        <legend>{fieldLabel(item.field)}</legend>
        {side("mine")}
        {side("theirs")}
      </fieldset>
    );
  };

  const rowView = (row: ReviewRow) => {
    const checkbox = hasRowCheckbox(row);
    const Head = checkbox ? "label" : "div";
    return (
      <li key={row.token} className={styles.row}>
        <Head className={`${styles.rowHead} ${checkbox ? "" : styles.rowHeadStatic}`}>
          {!checkbox ? (
            <span className={styles.checkSpace} aria-hidden="true" />
          ) : (
            <input
              type="checkbox"
              checked={selected[row.token] === true}
              disabled={applying}
              onChange={event => setSelected(current => ({ ...current, [row.token]: event.target.checked }))}
            />
          )}
          <span className={styles.kind}>{t(`app.review.kinds.${row.kind}`)}</span>
          {row.preview.color && <span className={styles.swatch} style={{ backgroundColor: row.preview.color }} />}
          <span className={styles.title}>{row.preview.title || t("app.review.none")}</span>
          {row.preview.start !== undefined && (
            <span className={styles.time}>
              {formatVideoTime(row.preview.start)}
              {row.preview.end !== undefined && `–${formatVideoTime(row.preview.end)}`}
            </span>
          )}
          {row.preview.detail && <span className={styles.detail}>{row.preview.detail}</span>}
          {row.preview.tags && <span className={styles.tags}><Tags tags={row.preview.tags} /></span>}
        </Head>
        {row.changes.length > 0 && <dl className={styles.fields}>{row.changes.map(change)}</dl>}
        {row.conflicts.map(item => conflict(row, item))}
        {row.inUse > 0 && <p className={styles.note}>{t("app.review.inUse", { count: row.inUse })}</p>}
        {row.recut && <p className={styles.note}>{t("app.review.recut")}</p>}
      </li>
    );
  };

  const tickedCount = appliedCount(review.rows, selected, choices);

  return createPortal(
    <div
      ref={trapRef}
      className={base.overlay}
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-labelledby="share-review-title"
      onKeyDown={e => {
        if (e.key !== "Escape") return;
        e.stopPropagation();
        close();
      }}
    >
      <div className={`${base.modal} ${styles.modal}`} onClick={e => e.stopPropagation()}>
        <div className={base.header}>
          <h3 id="share-review-title">
            <FontAwesomeIcon icon={faCodeMerge} /> {t("app.review.title", { name })}
          </h3>
          <button
            type="button"
            className={base.closeButton}
            onClick={close}
            disabled={applying}
            aria-label={t("app.buttons.close")}
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>
        <div className={`${base.content} ${styles.content}`}>
          {!review.hasBase && <p className={styles.notice}>{t("app.review.noBase")}</p>}
          {review.rows.length === 0 ? (
            <p className={styles.empty}>{t("app.review.empty")}</p>
          ) : (
            <div className={styles.list}>
              {GROUPS.map(group => {
                const rows = review.rows.filter(row => row.group === group);
                if (rows.length === 0) return null;
                const ticked = rows.filter(row => selected[row.token]).length;
                const label = t(`app.review.groups.${group}`);
                return (
                  <section key={group} className={styles.group} aria-label={label}>
                    <h4 className={styles.groupHeader}>
                      {group === "conflict" ? (
                        <div className={styles.conflictHeader}>
                          <span className={styles.checkSpace} aria-hidden="true" />
                          {label}
                          <span className={styles.bulkPicks}>
                            <button
                              type="button"
                              className={styles.bulkPick}
                              disabled={applying}
                              onClick={() => pickSide(rows, "mine")}
                            >
                              {t("app.review.keepAllMine")}
                            </button>
                            <button
                              type="button"
                              className={styles.bulkPick}
                              disabled={applying}
                              onClick={() => pickSide(rows, "theirs")}
                            >
                              {t("app.review.takeAllTheirs")}
                            </button>
                          </span>
                          <span className={styles.count}>{rows.length}</span>
                        </div>
                      ) : (
                        <label className={base.checkbox}>
                          <input
                            type="checkbox"
                            checked={ticked === rows.length}
                            ref={input => {
                              if (input) input.indeterminate = ticked > 0 && ticked < rows.length;
                            }}
                            disabled={applying}
                            onChange={event => setAll(rows, event.target.checked)}
                            aria-label={t("app.review.selectAll", { group: label })}
                          />
                          {label}
                          <span className={styles.count}>{rows.length}</span>
                        </label>
                      )}
                    </h4>
                    <ul className={styles.rows}>{rows.map(rowView)}</ul>
                  </section>
                );
              })}
            </div>
          )}

          <div className={base.actions}>
            {review.rows.length === 0 ? (
              <button type="button" className={base.primaryButton} onClick={close}>
                {t("app.buttons.close")}
              </button>
            ) : (
              <>
                <button type="button" className={base.cancelButton} onClick={close} disabled={applying}>
                  {t("app.buttons.cancel")}
                </button>
                <button
                  type="button"
                  className={base.primaryButton}
                  onClick={apply}
                  disabled={applying}
                >
                  <FontAwesomeIcon icon={applying ? faSpinner : faCodeMerge} spin={applying} />
                  {/* Applying nothing still records the folder, so it isn't offered again. */}
                  {applying
                    ? t("app.review.applying")
                    : tickedCount === 0
                      ? t("app.review.keepMine")
                      : t("app.review.apply", { count: tickedCount })}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
};
