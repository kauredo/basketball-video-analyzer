import React, { useCallback, useRef, useState } from "react";
import {
  EditField,
  draftFor,
  editedValue,
  editKeyAction,
} from "../utils/inlineEdit";

type EditableClip = { id: number; title: string; notes?: string | null };
type EditUpdate = { title?: string; notes?: string };
type Editing = { id: number; field: EditField };

/** Grows a textarea to fit its content, borders included. */
export function autoGrow(el: HTMLTextAreaElement): void {
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight + el.offsetHeight - el.clientHeight}px`;
}

/**
 * Title and notes editing shared by the card grid and the table. The ref
 * mirrors `editing` so the blur that fires when a committed or cancelled
 * field unmounts finds nothing open and writes nothing.
 */
export function useInlineEdit(
  onUpdate: (id: number, updates: EditUpdate) => Promise<void> | void,
) {
  const [editing, setEditing] = useState<Editing | null>(null);
  const [draft, setDraft] = useState("");
  const editingRef = useRef<Editing | null>(null);

  const isEditing = (id: number, field: EditField) =>
    editing?.id === id && editing.field === field;

  const start = (clip: EditableClip, field: EditField) => {
    const next = { id: clip.id, field };
    editingRef.current = next;
    setEditing(next);
    setDraft(draftFor(field, clip));
  };

  const cancel = () => {
    editingRef.current = null;
    setEditing(null);
  };

  const commit = (clip: EditableClip) => {
    const open = editingRef.current;
    if (!open) return;
    editingRef.current = null;
    setEditing(null);
    const field = open.field;
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

  const onKeyDown = (event: React.KeyboardEvent, clip: EditableClip) => {
    const field = editingRef.current?.field;
    if (!field) return;
    const action = editKeyAction(field, event.key, event.shiftKey);
    if (action === null) return;
    event.preventDefault();
    if (action === "commit") commit(clip);
    else cancel();
  };

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
    editorRef,
  };
}
