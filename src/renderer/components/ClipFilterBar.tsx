import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFilter,
  faSearch,
  faSortDown,
  faSortUp,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ClipFilterBar.module.css";
import type { Clip, Category } from "./ClipLibrary";
import type { Player } from "../../types/global";
import { useDismissableMenu } from "../hooks/useDismissableMenu";
import { CLIP_STATUSES, statusLabelKey } from "../utils/constants";
import { inkOn } from "../utils/contrast";
import { formatDuration } from "../utils/format";
import {
  ClipFilters,
  activeFilterCount,
  categoryCounts,
  findCategory,
  playerCounts,
  summarize,
} from "../utils/clipFilters";

export type SortKey = "date" | "duration" | "title";

interface ClipFilterBarProps {
  /** Every clip in the project; counts and "of N" come from this. */
  clips: Clip[];
  /** ClipLibrary's filteredClips; the summary's shown count and seconds. */
  shownClips: Clip[];
  categories: Category[];
  players: Player[];
  filters: ClipFilters;
  onFiltersChange: (next: ClipFilters) => void;
  sortBy: SortKey;
  sortOrder: "asc" | "desc";
  onToggleSort: (key: SortKey) => void;
}

const SORT_KEYS: SortKey[] = ["date", "duration", "title"];
const SORT_LABEL_KEYS: Record<SortKey, string> = {
  date: "app.clips.date",
  duration: "app.clips.sortDuration",
  title: "app.clips.sortTitle",
};

const playerShortLabel = (player: Player) =>
  player.number ? `#${player.number}` : player.name;

const playerFullLabel = (player: Player) =>
  [player.number ? `#${player.number}` : "", player.name].filter(Boolean).join(" ");

/** True when focus is moving to an element outside every given ref. */
const focusLeaves = (
  next: EventTarget | null,
  refs: React.RefObject<HTMLElement | null>[],
) => next instanceof Node && !refs.some(ref => ref.current?.contains(next));

export const ClipFilterBar: React.FC<ClipFilterBarProps> = ({
  clips,
  shownClips,
  categories,
  players,
  filters,
  onFiltersChange,
  sortBy,
  sortOrder,
  onToggleSort,
}) => {
  const { t } = useTranslation();
  const popoverId = useId();
  const [open, setOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const filterButtonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const sortTriggerRef = useRef<HTMLButtonElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

  // Escape leaves focus inside the popover, so it goes back to the button. An
  // outside mousedown has not moved focus yet either, but the click target
  // takes it right after, so that click keeps its natural focus.
  const close = useCallback(() => {
    if (popoverRef.current?.contains(document.activeElement)) {
      filterButtonRef.current?.focus();
    }
    setOpen(false);
  }, []);

  const closeSort = useCallback(() => {
    if (sortMenuRef.current?.contains(document.activeElement)) {
      sortTriggerRef.current?.focus();
    }
    setSortOpen(false);
  }, []);

  useDismissableMenu(open, close, [filterButtonRef, popoverRef]);
  useDismissableMenu(sortOpen, closeSort, [sortTriggerRef, sortMenuRef]);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() => {
      popoverRef.current?.querySelector<HTMLElement>("button")?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    if (!sortOpen) return;
    const frame = requestAnimationFrame(() => {
      sortMenuRef.current
        ?.querySelector<HTMLElement>('[aria-checked="true"]')
        ?.focus();
    });
    return () => cancelAnimationFrame(frame);
  }, [sortOpen]);

  const counts = useMemo(() => categoryCounts(clips, categories), [clips, categories]);
  const perPlayer = useMemo(() => playerCounts(clips), [clips]);
  const activeCount = activeFilterCount(filters);
  const hasStatuses = clips.some(clip => clip.status);
  const summary = summarize(shownClips, clips.length);

  const set = (patch: Partial<ClipFilters>) => onFiltersChange({ ...filters, ...patch });

  const removeFilter = (patch: Partial<ClipFilters>) => {
    set(patch);
    filterButtonRef.current?.focus();
  };

  const onSortMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const items = Array.from(
      sortMenuRef.current?.querySelectorAll<HTMLElement>('[role="menuitemradio"]') ?? [],
    );
    const index = items.indexOf(document.activeElement as HTMLElement);
    let next: number | null = null;
    if (e.key === "ArrowDown") next = (index + 1) % items.length;
    else if (e.key === "ArrowUp") next = (index - 1 + items.length) % items.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = items.length - 1;
    if (next === null) return;
    e.preventDefault();
    items[next]?.focus();
  };

  const sortLabel = t(SORT_LABEL_KEYS[sortBy]);
  const sortIcon = sortOrder === "asc" ? faSortUp : faSortDown;
  const chipCategory =
    filters.categoryId !== null ? findCategory(categories, filters.categoryId) : undefined;
  const chipPlayer =
    filters.playerId !== null ? players.find(p => p.id === filters.playerId) : undefined;

  const categoryRow = (category: Category, isChild: boolean) => {
    const checked = filters.categoryId === category.id;
    return (
      <button
        key={category.id}
        type="button"
        role="radio"
        aria-checked={checked}
        className={`${styles.categoryRow} ${isChild ? styles.categoryChild : ""} ${
          checked ? styles.categoryRowChecked : ""
        }`}
        onClick={() => set({ categoryId: checked ? null : category.id })}
      >
        <span className={styles.checkBox} aria-hidden="true">
          {checked && <span className={styles.tick} />}
        </span>
        <span
          className={styles.colorSquare}
          style={{ background: category.color }}
          aria-hidden="true"
        />
        <span className={styles.categoryName}>{category.name}</span>
        <span className={styles.count}>{counts.get(category.id) ?? 0}</span>
      </button>
    );
  };

  return (
    <div className={styles.filterBar}>
      <div className={styles.filterRow}>
        <span className={styles.searchWrap}>
          <FontAwesomeIcon icon={faSearch} className={styles.searchIcon} aria-hidden="true" />
          <input
            type="text"
            placeholder={t("app.library.searchPlaceholder")}
            value={filters.search}
            onChange={e => set({ search: e.target.value })}
            className={styles.searchInput}
            aria-label={t("app.library.searchPlaceholder")}
          />
        </span>

        <button
          ref={filterButtonRef}
          type="button"
          className={`${styles.barButton} ${activeCount > 0 ? styles.barButtonActive : ""}`}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-controls={open ? popoverId : undefined}
          aria-label={
            activeCount > 0
              ? t("app.clips.filter.buttonLabel", { count: activeCount })
              : t("app.clips.filter.button")
          }
          onClick={() => setOpen(prev => !prev)}
        >
          <FontAwesomeIcon icon={faFilter} aria-hidden="true" />
          <span>{t("app.clips.filter.button")}</span>
          {activeCount > 0 && <span className={styles.activeCount}>{activeCount}</span>}
        </button>

        {open && (
          <div
            ref={popoverRef}
            id={popoverId}
            className={styles.popover}
            role="dialog"
            aria-modal="false"
            aria-label={t("app.clips.filter.dialogLabel")}
            onBlur={e => {
              if (focusLeaves(e.relatedTarget, [filterButtonRef, popoverRef])) setOpen(false);
            }}
          >
            {categories.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupHeading} aria-hidden="true">
                  {t("app.clips.filter.category")}
                </div>
                <div role="radiogroup" aria-label={t("app.clips.filterByCategory")}>
                  {categories.map(parent => (
                    <React.Fragment key={parent.id}>
                      {categoryRow(parent, false)}
                      {parent.children?.map(child => categoryRow(child, true))}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            {players.length > 0 && (
              <div className={styles.group}>
                <div className={styles.groupHeading} aria-hidden="true">
                  {t("app.clips.filter.player")}
                </div>
                <div
                  role="group"
                  aria-label={t("app.clips.filterByPlayer")}
                  className={styles.playerChips}
                >
                  {players.map(player => {
                    const pressed = filters.playerId === player.id;
                    return (
                      <button
                        key={player.id}
                        type="button"
                        aria-pressed={pressed}
                        title={`${playerFullLabel(player)} (${perPlayer.get(player.id) ?? 0})`}
                        className={`${styles.playerChip} ${pressed ? styles.raised : ""}`}
                        onClick={() => set({ playerId: pressed ? null : player.id })}
                      >
                        {playerShortLabel(player)}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {hasStatuses && (
              <div className={styles.group}>
                <div className={styles.groupHeading} aria-hidden="true">
                  {t("app.clips.filter.status")}
                </div>
                <div
                  role="group"
                  aria-label={t("app.clips.table.filterByStatus")}
                  className={styles.segments}
                >
                  {[null, ...CLIP_STATUSES].map(status => {
                    const pressed = filters.status === status;
                    return (
                      <button
                        key={status ?? "all"}
                        type="button"
                        aria-pressed={pressed}
                        className={`${styles.segment} ${pressed ? styles.raised : ""}`}
                        onClick={() => set({ status })}
                      >
                        {status ? t(statusLabelKey(status)) : t("app.clips.all")}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <div className={styles.sortWrap}>
          <button
            ref={sortTriggerRef}
            type="button"
            className={styles.barButton}
            aria-haspopup="menu"
            aria-expanded={sortOpen}
            aria-label={t("app.clips.filter.sortBy", {
              key: sortLabel,
              direction: t(
                sortOrder === "asc" ? "app.clips.filter.sortAsc" : "app.clips.filter.sortDesc",
              ),
            })}
            onClick={() => setSortOpen(prev => !prev)}
          >
            <span>{sortLabel}</span>
            <FontAwesomeIcon icon={sortIcon} aria-hidden="true" />
          </button>

          {sortOpen && (
            <div
              ref={sortMenuRef}
              className={styles.sortMenu}
              role="menu"
              aria-label={t("app.clips.filter.sortMenuLabel")}
              onKeyDown={onSortMenuKeyDown}
              onBlur={e => {
                if (focusLeaves(e.relatedTarget, [sortTriggerRef, sortMenuRef])) setSortOpen(false);
              }}
            >
              {SORT_KEYS.map(key => {
                const checked = sortBy === key;
                return (
                  <button
                    key={key}
                    type="button"
                    role="menuitemradio"
                    aria-checked={checked}
                    className={`${styles.sortItem} ${checked ? styles.raised : ""}`}
                    onClick={() => {
                      onToggleSort(key);
                      closeSort();
                    }}
                  >
                    <span>{t(SORT_LABEL_KEYS[key])}</span>
                    {checked && <FontAwesomeIcon icon={sortIcon} aria-hidden="true" />}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={styles.activeRow}>
        <div className={styles.chips}>
          {chipCategory && (
            <span
              className={`${styles.chip} ${styles.categoryChip}`}
              style={{ background: chipCategory.color, color: inkOn(chipCategory.color) }}
            >
              <span className={styles.chipName}>{chipCategory.name}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={t("app.clips.filter.removeChip", { name: chipCategory.name })}
                onClick={() => removeFilter({ categoryId: null })}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </span>
          )}
          {chipPlayer && (
            <span className={styles.chip}>
              <span className={styles.chipName}>{playerFullLabel(chipPlayer)}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={t("app.clips.filter.removeChip", {
                  name: playerFullLabel(chipPlayer),
                })}
                onClick={() => removeFilter({ playerId: null })}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </span>
          )}
          {filters.status && (
            <span className={styles.chip}>
              <span className={styles.chipName}>{t(statusLabelKey(filters.status))}</span>
              <button
                type="button"
                className={styles.chipRemove}
                aria-label={t("app.clips.filter.removeChip", {
                  name: t(statusLabelKey(filters.status)),
                })}
                onClick={() => removeFilter({ status: null })}
              >
                <FontAwesomeIcon icon={faXmark} aria-hidden="true" />
              </button>
            </span>
          )}
        </div>
        <span className={styles.spacer} />
        <span className={styles.summary}>
          {t("app.clips.filter.summary", {
            shown: summary.shown,
            total: summary.total,
            duration: formatDuration(summary.seconds),
          })}
        </span>
      </div>
    </div>
  );
};
