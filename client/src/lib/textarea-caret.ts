type CaretCoords = { left: number; top: number };

/**
 * Returns caret coordinates inside a textarea (relative to textarea top-left).
 * Needed for floating formatting UI near selected text.
 */
export function getTextareaCaretCoordinates(textarea: HTMLTextAreaElement, position: number): CaretCoords {
  const style = window.getComputedStyle(textarea);
  const mirror = document.createElement("div");

  mirror.style.position = "absolute";
  mirror.style.visibility = "hidden";
  mirror.style.whiteSpace = "pre-wrap";
  mirror.style.wordWrap = "break-word";
  mirror.style.overflowWrap = "break-word";
  mirror.style.top = "0";
  mirror.style.left = "-9999px";

  const propsToCopy = [
    "boxSizing",
    "width",
    "height",
    "paddingTop",
    "paddingRight",
    "paddingBottom",
    "paddingLeft",
    "borderTopWidth",
    "borderRightWidth",
    "borderBottomWidth",
    "borderLeftWidth",
    "fontStyle",
    "fontVariant",
    "fontWeight",
    "fontStretch",
    "fontSize",
    "fontFamily",
    "lineHeight",
    "letterSpacing",
    "textTransform",
    "textIndent",
    "textDecoration",
    "textRendering",
    "textAlign",
  ] as const;

  for (const prop of propsToCopy) {
    mirror.style[prop] = style[prop];
  }

  const value = textarea.value;
  const safePos = Math.max(0, Math.min(position, value.length));
  mirror.textContent = value.slice(0, safePos);

  const marker = document.createElement("span");
  marker.textContent = value.slice(safePos) || ".";
  mirror.appendChild(marker);
  document.body.appendChild(mirror);

  const left = marker.offsetLeft - textarea.scrollLeft;
  const top = marker.offsetTop - textarea.scrollTop;

  document.body.removeChild(mirror);
  return { left, top };
}
