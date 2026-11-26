import React, { useCallback, useRef, useState } from "react";
import {
  EditAction,
  EditField,
  EditTarget,
  draftFor,
  editedValue,
  editKeyAction,
  nextEdit,
} from "../utils/inlineEdit";

type EditableClip = { id: number; title: string; notes?: string | null };
type EditUpdate = { title?: string; notes?: string };

/** Grows a textarea to fit its content, borders included. */
export function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

const openerKey = (id: number, field: EditField) => `${id}:${field}`;

/**
 * Title and notes editing shared by the card grid and the table. The ref
 * holds the open editor so `nextEdit` sees it synchronously: the blur that
 * fires when a committed or cancelled field unmounts finds nothing open and
 * writes nothing.
 */
export function useInlineEdit(
  onUpdate: (id: number, updates: EditUpdate) => Promise<void> | void,
) {
  const [editing, setEditing] = useState<EditTarget | null>(null);
  const [draft, setDraft] = useState("");
  const editingRef = useRef<EditTarget | null>(null);

  const isEditing = (id: number, field: EditField) =>
    editing?.id === id && editing.field === field;

  const apply = (action: EditAction): EditTarget | null => {
    const { open, write } = nextEdit(editingRef.current, action);
    editingRef.current = open;
    setEditing(open);
    return write;
  };

  const start = (clip: EditableClip, field: EditField) => {
    apply({ type: "start", target: { id: clip.id, field } });
    setDraft(draftFor(field, clip));
  };

  const cancel = () => {
    apply({ type: "cancel" });
  };

  const commit = (clip: EditableClip) => {
    const write = apply({ type: "commit" });
    if (!write) return;
    const field = write.field;
    const value = editedValue(
      field,
      draft,
      field === "title" ? clip.title : clip.notes,
    );
    if (value === null) return;
    const update: EditUpdate =
      field === "title" ? { title: value } : { notes: value };
    void onUpdate(clip.id, update);
  };

  // Back to the button that opened the editor once it has re-rendered, so
  // focus does not drop to <body>, where VideoPlayer's shortcuts would take
  // the next Space or digit. Only for Enter and Escape: a blur already went
  // somewhere the user chose.
  const refocusOpener = (open: EditTarget) => {
    requestAnimationFrame(() => {
      document
        .querySelector<HTMLElement>(
          `[data-inline-edit="${openerKey(open.id, open.field)}"]`,
        )
        ?.focus();
    });
  };

  const onKeyDown = (event: React.KeyboardEvent, clip: EditableClip) => {
    if (event.nativeEvent.isComposing) return;
    const open = editingRef.current;
    if (!open) return;
    const action = editKeyAction(open.field, event.key, event.shiftKey);
    if (action === null) return;
    event.preventDefault();
    if (action === "commit") commit(clip);
    else cancel();
    refocusOpener(open);
  };

  /** Marks a button as the opener for a clip's field. */
  const openerProps = (id: number, field: EditField) => ({
    "data-inline-edit": openerKey(id, field),
  });

  // No deps, so it runs once per mounted field and leaves the caret alone
  // while the user types.
  const editorRef = useCallback((el: HTMLElement | null) => {
    if (!(el instanceof HTMLTextAreaElement)) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    autoGrow(el);
  }, []);

  return {
    editing,
    draft,
    setDraft,
    isEditing,
    start,
    cancel,
    commit,
    onKeyDown,
    openerProps,
    editorRef,
  };
}
