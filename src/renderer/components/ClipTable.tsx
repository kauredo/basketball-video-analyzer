import React, {
  useState,
  useRef,
  useEffect,
  useMemo,
  useCallback,
} from "react";
import { useTranslation } from "react-i18next";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPlay,
  faSortUp,
  faSortDown,
  faTrash,
  faXmark,
} from "@fortawesome/free-solid-svg-icons";
import styles from "../styles/ClipTable.module.css";
import { useDismissableMenu } from "../hooks/useDismissableMenu";
import { formatVideoTime } from "../utils/format";
import { inkOn } from "../utils/contrast";
import { ClipStatus } from "../../types/global";
import { CLIP_STATUSES, statusLabelKey } from "../utils/constants";
// Type-only, so this never becomes a runtime cycle with the component that
// renders this one.
import type { Clip, Category } from "./ClipLibrary";

type SortField = "date" | "duration" | "title";

/** A clip's id list, tolerating a malformed value the same way the cards do. */
const parseIds = (json?: string): number[] => {
  try {
    const ids = JSON.parse(json || "[]");
    return Array.isArray(ids) ? ids : [];
  } catch {
    return [];
  }
};

interface ClipTableProps {
  /** Already filtered and sorted by ClipLibrary. */
  clips: Clip[];
  /** Hierarchical, as getCategoriesHierarchical returns them. */
  categories: Category[];
  sortBy: SortField;
  sortOrder: "asc" | "desc";
  onToggleSort: (field: SortField) => void;
  onPlay: (outputPath: string) => void;
  onUpdate: (id: number, updates: Partial<Clip>) => Promise<void>;
  /** One IPC round per entry, reported as a single result. */
  onUpdateEach: (
    entries: Array<{ id: number; updates: Partial<Clip> }>,
  ) => Promise<void>;
  onDeleteMany: (ids: number[]) => Promise<void>;
}

export const ClipTable: React.FC<ClipTableProps> = ({
  clips,
  categories,
  sortBy,
  sortOrder,
  onToggleSort,
  onPlay,
  onUpdate,
  onUpdateEach,
  onDeleteMany,
}) => {
  const { t } = useTranslation();

  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [editing, setEditing] = useState<{
    id: number;
    field: "title" | "notes";
  } | null>(null);
  const [draft, setDraft] = useState("");
  const [categoryEditFor, setCategoryEditFor] = useState<number | null>(null);
  // The open popover's working set. Reading the clip prop instead would mean
  // every toggle computes its new list from whatever the last completed write
  // left there, so a second checkbox ticked before the first write returns
  // sends a list that never contained the first one.
  const [categoryDraft, setCategoryDraft] = useState<number[]>([]);

  const selectAllRef = useRef<HTMLInputElement>(null);
  const categoryPopoverRef = useRef<HTMLDivElement>(null);
  // Anchor for shift-click range selection, held as a clip id rather than a
  // position. A filter, a sort or a bulk delete reorders or shortens `clips`
  // under a stored index, which then points at a different clip or past the
  // end of the array.
  const lastClickedId = useRef<number | null>(null);

  useDismissableMenu(
    categoryEditFor !== null,
    useCallback(() => setCategoryEditFor(null), []),
    [categoryPopoverRef],
  );

  // Parents and children in one list, so a row's picker offers every category
  // the project has. Depth only drives the indent.
  const flatCategories = useMemo(() => {
    const out: Array<{ category: Category; depth: number }> = [];
    const walk = (list: Category[], depth: number) => {
      for (const category of list) {
        out.push({ category, depth });
        if (category.children?.length) walk(category.children, depth + 1);
      }
    };
    walk(categories, 0);
    return out;
  }, [categories]);

  const categoryById = useMemo(() => {
    const map = new Map<number, Category>();
    for (const { category } of flatCategories) map.set(category.id, category);
    return map;
  }, [flatCategories]);

  // A filter change or a delete can leave ids selected that are no longer on
  // screen. Acting on those would hit clips the coach cannot see.
  useEffect(() => {
    setSelected(prev => {
      const visible = new Set(clips.map(clip => clip.id));
      const next = new Set([...prev].filter(id => visible.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [clips]);

  const allSelected = clips.length > 0 && selected.size === clips.length;
  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate =
        selected.size > 0 && !allSelected;
    }
  }, [selected, allSelected]);

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(clips.map(c => c.id)));
    lastClickedId.current = null;
  };

  const toggleRow = (index: number, event: React.MouseEvent) => {
    const clip = clips[index];
    // Resolved against the current array, so both ends of the range are real
    // indices. An anchor whose clip has been filtered away or deleted comes
    // back as -1 and the click falls through to a plain toggle.
    const anchor =
      lastClickedId.current === null
        ? -1
        : clips.findIndex(c => c.id === lastClickedId.current);

    setSelected(prev => {
      const next = new Set(prev);
      if (event.shiftKey && anchor !== -1) {
        const [from, to] = anchor < index ? [anchor, index] : [index, anchor];
        const selecting = !prev.has(clip.id);
        for (let i = from; i <= to; i++) {
          if (selecting) next.add(clips[i].id);
          else next.delete(clips[i].id);
        }
        return next;
      }
      if (next.has(clip.id)) next.delete(clip.id);
      else next.add(clip.id);
      return next;
    });
    lastClickedId.current = clip.id;
  };

  const startEdit = (clip: Clip, field: "title" | "notes") => {
    setEditing({ id: clip.id, field });
    setDraft(field === "title" ? clip.title : clip.notes || "");
  };

  const commitEdit = (clip: Clip) => {
    if (!editing) return;
    const field = editing.field;
    const value = draft.trim();
    const current = field === "title" ? clip.title : clip.notes || "";
    setEditing(null);

    // An empty title would leave the clip unidentifiable in the export
    // filenames, so it reverts. An empty note is a legitimate value.
    if (field === "title" && value === "") return;
    if (value === current) return;

    void onUpdate(clip.id, { [field]: value } as Partial<Clip>);
  };

  const onEditKeyDown = (event: React.KeyboardEvent, clip: Clip) => {
    if (event.key === "Enter") {
      event.preventDefault();
      commitEdit(clip);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setEditing(null);
    }
  };

  const openCategoryEditor = (clip: Clip) => {
    if (categoryEditFor === clip.id) {
      setCategoryEditFor(null);
      return;
    }
    setCategoryEditFor(clip.id);
    setCategoryDraft(parseIds(clip.categories));
  };

  const toggleClipCategory = (clip: Clip, categoryId: number) => {
    const next = categoryDraft.includes(categoryId)
      ? categoryDraft.filter(id => id !== categoryId)
      : [...categoryDraft, categoryId];
    setCategoryDraft(next);
    void onUpdate(clip.id, { categories: JSON.stringify(next) });
  };

  // Each clip keeps the tags it already has; this adds one more to all of the
  // selected ones, so a bulk retag never silently drops a tag a coach set.
  const bulkAddCategory = (categoryId: number) => {
    const entries = clips
      .filter(clip => selected.has(clip.id))
      .filter(clip => !parseIds(clip.categories).includes(categoryId))
      .map(clip => ({
        id: clip.id,
        updates: {
          categories: JSON.stringify([...parseIds(clip.categories), categoryId]),
        } as Partial<Clip>,
      }));
    if (entries.length > 0) void onUpdateEach(entries);
  };

  const sortIcon = (field: SortField) =>
    sortBy === field ? (
      <FontAwesomeIcon icon={sortOrder === "asc" ? faSortUp : faSortDown} />
    ) : null;

  const ariaSort = (field: SortField): "ascending" | "descending" | "none" =>
    sortBy !== field
      ? "none"
      : sortOrder === "asc"
        ? "ascending"
        : "descending";

  const rowClass = (status?: ClipStatus | null) => {
    if (status === "keep") return styles.rowKeep;
    if (status === "cut") return styles.rowCut;
    if (status === "review") return styles.rowReview;
    return "";
  };

  return (
    <div className={styles.tableWrapper}>
      {selected.size > 0 && (
        <div className={styles.bulkBar} role="toolbar" aria-label={t("app.clips.table.selectedCount", { count: selected.size })}>
          <span className={styles.bulkCount}>
            {t("app.clips.table.selectedCount", { count: selected.size })}
          </span>

          <select
            className={styles.bulkSelect}
            value=""
            aria-label={t("app.clips.table.bulkCategory")}
            onChange={event => {
              const id = Number(event.target.value);
              if (id) bulkAddCategory(id);
              event.target.value = "";
            }}
          >
            <option value="">{t("app.clips.table.bulkCategory")}</option>
            {flatCategories.map(({ category, depth }) => (
              <option key={category.id} value={category.id}>
                {" ".repeat(depth * 2) + category.name}
              </option>
            ))}
          </select>

          <select
            className={styles.bulkSelect}
            value=""
            aria-label={t("app.clips.table.bulkStatus")}
            onChange={event => {
              const value = event.target.value;
              if (!value) return;
              const status = value === "none" ? null : (value as ClipStatus);
              void onUpdateEach(
                [...selected].map(id => ({ id, updates: { status } })),
              );
              event.target.value = "";
            }}
          >
            <option value="">{t("app.clips.table.bulkStatus")}</option>
            <option value="none">{t("app.clips.table.statusNone")}</option>
            {CLIP_STATUSES.map(status => (
              <option key={status} value={status}>
                {t(statusLabelKey(status))}
              </option>
            ))}
          </select>

          <button
            type="button"
            className={styles.bulkDeleteBtn}
            onClick={() => void onDeleteMany([...selected])}
          >
            <FontAwesomeIcon icon={faTrash} /> {t("app.clips.table.bulkDelete")}
          </button>

          <button
            type="button"
            className={styles.bulkClearBtn}
            onClick={() => setSelected(new Set())}
          >
            <FontAwesomeIcon icon={faXmark} />{" "}
            {t("app.clips.table.clearSelection")}
          </button>
        </div>
      )}

      <div className={styles.tableScroll}>
        <table className={styles.clipTable}>
          <thead>
            <tr>
              <th scope="col" className={styles.selectCell}>
                <input
                  ref={selectAllRef}
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label={t("app.clips.table.selectAll")}
                />
              </th>
              <th scope="col" aria-sort={ariaSort("title")}>
                <button
                  type="button"
                  className={styles.sortHeader}
                  onClick={() => onToggleSort("title")}
                >
                  {t("app.clips.table.columnTitle")} {sortIcon("title")}
                </button>
              </th>
              <th scope="col">{t("app.clips.table.columnCategory")}</th>
              <th scope="col">{t("app.clips.table.columnNotes")}</th>
              <th scope="col" aria-sort={ariaSort("duration")}>
                <button
                  type="button"
                  className={styles.sortHeader}
                  onClick={() => onToggleSort("duration")}
                >
                  {t("app.clips.table.columnDuration")} {sortIcon("duration")}
                </button>
              </th>
              <th scope="col">{t("app.clips.table.columnStatus")}</th>
              <th scope="col" className={styles.playCell}>
                <span className={styles.srOnly}>{t("app.clips.play")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {clips.map((clip, index) => {
              const ids = parseIds(clip.categories);
              const clipCategories = ids
                .map(id => categoryById.get(id))
                .filter((c): c is Category => Boolean(c));
              const isEditingTitle =
                editing?.id === clip.id && editing.field === "title";
              const isEditingNotes =
                editing?.id === clip.id && editing.field === "notes";

              return (
                <tr key={clip.id} className={rowClass(clip.status)}>
                  <td className={styles.selectCell}>
                    <input
                      type="checkbox"
                      checked={selected.has(clip.id)}
                      onChange={() => undefined}
                      onClick={event => toggleRow(index, event)}
                      aria-label={t("app.clips.table.selectRow", {
                        title: clip.title,
                      })}
                    />
                  </td>

                  <td className={styles.titleCell}>
                    {isEditingTitle ? (
                      <input
                        type="text"
                        className={styles.cellInput}
                        value={draft}
                        autoFocus
                        onChange={event => setDraft(event.target.value)}
                        onBlur={() => commitEdit(clip)}
                        onKeyDown={event => onEditKeyDown(event, clip)}
                        aria-label={t("app.clips.table.editTitle")}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.cellButton}
                        title={clip.title}
                        onClick={() => startEdit(clip, "title")}
                        aria-label={`${t("app.clips.table.editTitle")}: ${clip.title}`}
                      >
                        {clip.title}
                      </button>
                    )}
                  </td>

                  <td className={styles.categoryCell}>
                    <div
                      className={styles.categoryAnchor}
                      ref={
                        categoryEditFor === clip.id ? categoryPopoverRef : null
                      }
                    >
                    <button
                      type="button"
                      className={`${styles.cellButton} ${styles.pickerButton}`}
                      onClick={() => openCategoryEditor(clip)}
                      aria-label={t("app.clips.table.editCategories")}
                      aria-expanded={categoryEditFor === clip.id}
                      aria-haspopup="true"
                    >
                      {clipCategories.length === 0 ? (
                        <span className={styles.muted}>
                          {t("app.clips.table.noCategories")}
                        </span>
                      ) : (
                        clipCategories.map(category => (
                          <span
                            key={category.id}
                            className={styles.categoryTag}
                            style={{
                              backgroundColor: category.color,
                              color: inkOn(category.color),
                            }}
                          >
                            {category.name}
                          </span>
                        ))
                      )}
                    </button>

                    {categoryEditFor === clip.id && (
                      <div
                        ref={categoryPopoverRef}
                        className={styles.categoryPopover}
                        role="dialog"
                        aria-label={t("app.clips.table.editCategories")}
                      >
                        {flatCategories.map(({ category, depth }) => (
                          <label
                            key={category.id}
                            className={styles.categoryOption}
                            style={{
                              paddingLeft: `calc(var(--spacing-sm) + ${depth} * var(--spacing-md))`,
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={categoryDraft.includes(category.id)}
                              onChange={() =>
                                toggleClipCategory(clip, category.id)
                              }
                            />
                            <span
                              className={styles.categorySwatch}
                              style={{ backgroundColor: category.color }}
                              aria-hidden="true"
                            />
                            {category.name}
                          </label>
                        ))}
                      </div>
                    )}
                    </div>
                  </td>

                  <td className={styles.notesCell}>
                    {isEditingNotes ? (
                      <input
                        type="text"
                        className={styles.cellInput}
                        value={draft}
                        autoFocus
                        placeholder={t("app.clips.table.notesPlaceholder")}
                        onChange={event => setDraft(event.target.value)}
                        onBlur={() => commitEdit(clip)}
                        onKeyDown={event => onEditKeyDown(event, clip)}
                        aria-label={t("app.clips.table.editNotes")}
                      />
                    ) : (
                      <button
                        type="button"
                        className={styles.cellButton}
                        title={clip.notes || ""}
                        onClick={() => startEdit(clip, "notes")}
                        aria-label={t("app.clips.table.editNotes")}
                      >
                        {clip.notes || (
                          <span className={styles.muted}>
                            {t("app.clips.table.noNotes")}
                          </span>
                        )}
                      </button>
                    )}
                  </td>

                  <td className={styles.durationCell}>
                    {formatVideoTime(clip.end_time - clip.start_time)}
                  </td>

                  <td className={styles.statusCell}>
                    <select
                      className={styles.statusSelect}
                      value={clip.status || ""}
                      aria-label={t("app.clips.table.columnStatus")}
                      onChange={event =>
                        void onUpdate(clip.id, {
                          status: (event.target.value as ClipStatus) || null,
                        })
                      }
                    >
                      <option value="">
                        {t("app.clips.table.statusNone")}
                      </option>
                      {CLIP_STATUSES.map(status => (
                        <option key={status} value={status}>
                          {t(statusLabelKey(status))}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td className={styles.playCell}>
                    <button
                      type="button"
                      className={styles.playBtn}
                      onClick={() => onPlay(clip.output_path)}
                      aria-label={t("app.clips.playClip")}
                      title={t("app.clips.playClip")}
                    >
                      <FontAwesomeIcon icon={faPlay} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
