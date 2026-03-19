/**
 * Вычисление координат каретки в textarea для позиционирования всплывающих панелей.
 */

const CARET_STYLE_PROPS = [
  "boxSizing",
  "width",
  "height",
  "overflowX",
  "overflowY",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "fontStyle",
  "fontVariant",
  "fontWeight",
  "fontStretch",
  "fontSize",
  "fontSizeAdjust",
  "lineHeight",
  "fontFamily",
  "textAlign",
  "textTransform",
  "textIndent",
  "textDecoration",
  "letterSpacing",
  "wordSpacing",
  "tabSize",
  "MozTabSize",
] as const;

export function getTextareaCaretCoordinates(
  textarea: HTMLTextAreaElement,
  position: number
): { left: number; top: number } {
  const div = document.createElement("div");
  const style = window.getComputedStyle(textarea);
  CARET_STYLE_PROPS.forEach((prop) => {
    // @ts-expect-error dynamic style copy
    div.style[prop] = style[prop];
  });
  div.style.position = "absolute";
  div.style.visibility = "hidden";
  div.style.whiteSpace = "pre-wrap";
  div.style.wordWrap = "break-word";
  div.style.overflow = "hidden";

  div.textContent = textarea.value.slice(0, position);
  const span = document.createElement("span");
  span.textContent = textarea.value.slice(position) || ".";
  div.appendChild(span);
  document.body.appendChild(div);

  const left = span.offsetLeft + parseFloat(style.borderLeftWidth);
  const top = span.offsetTop + parseFloat(style.borderTopWidth);
  document.body.removeChild(div);
  return { left, top };
}
