import { RefObject, useEffect } from "react";

/**
 * Closes a transient menu when the user clicks outside it or presses Escape.
 *
 * Three menus had grown their own version of this: ClipLibrary's export menu
 * (click-outside only) and the transport's speed and volume popovers. They
 * disagreed about whether Escape worked, which meant the same gesture closed
 * one menu and not another.
 *
 * Pass every element that counts as "inside". A click landing in any of them
 * leaves the menu open, which is what lets a trigger button and its popover be
 * separate elements.
 */
export function useDismissableMenu(
  isOpen: boolean,
  onDismiss: () => void,
  insideRefs: RefObject<HTMLElement | null>[],
): void {
  useEffect(() => {
    if (!isOpen) return;

    const isInside = (target: Node) =>
      insideRefs.some(ref => ref.current?.contains(target));

    const onPointerDown = (e: MouseEvent) => {
      if (!isInside(e.target as Node)) onDismiss();
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onDismiss();
    };

    document.addEventListener("mousedown", onPointerDown);
    // Capture, so the menu closes before a component-level Escape handler
    // treats the key as its own.
    document.addEventListener("keydown", onKeyDown, true);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, onDismiss, ...insideRefs]);
}
