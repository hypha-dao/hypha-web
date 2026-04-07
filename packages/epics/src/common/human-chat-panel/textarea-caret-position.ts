/**
 * Mirror textarea metrics into a hidden div to measure caret/selection position.
 * Based on the common textarea-caret-position approach (MIT-style snippets).
 */

const PROPS = [
  'direction',
  'boxSizing',
  'width',
  'height',
  'overflowX',
  'overflowY',
  'borderTopWidth',
  'borderRightWidth',
  'borderBottomWidth',
  'borderLeftWidth',
  'paddingTop',
  'paddingRight',
  'paddingBottom',
  'paddingLeft',
  'fontStyle',
  'fontVariant',
  'fontWeight',
  'fontStretch',
  'fontSize',
  'lineHeight',
  'fontFamily',
  'textAlign',
  'textTransform',
  'textIndent',
  'textDecoration',
  'letterSpacing',
  'wordSpacing',
  'tabSize',
  'MozTabSize',
] as const;

function getCoords(
  element: HTMLTextAreaElement,
  position: number,
): { top: number; left: number } {
  const doc = document;
  const div = doc.createElement('div');
  doc.body.appendChild(div);

  const style = div.style;
  const computed = getComputedStyle(element);

  style.whiteSpace = 'pre-wrap';
  style.wordWrap = 'break-word';
  style.position = 'absolute';
  style.visibility = 'hidden';
  style.overflow = 'hidden';

  for (const prop of PROPS) {
    style.setProperty(
      prop,
      computed.getPropertyValue(prop),
      computed.getPropertyPriority(prop),
    );
  }

  const rect = element.getBoundingClientRect();
  style.width = `${rect.width}px`;

  const before = element.value.slice(0, position);
  div.appendChild(doc.createTextNode(before));
  const span = doc.createElement('span');
  span.textContent = element.value.slice(position) || '\u200b';
  div.appendChild(span);

  const lineHeight = parseFloat(computed.lineHeight) || 20;
  const top = span.offsetTop + lineHeight;
  const left = span.offsetLeft;

  doc.body.removeChild(div);

  return { top, left };
}

/**
 * Center of selection in textarea-local coordinates (relative to textarea padding box).
 */
export function getTextareaSelectionCenter(
  element: HTMLTextAreaElement,
): { top: number; left: number } | null {
  const start = element.selectionStart;
  const end = element.selectionEnd;
  if (start == null || end == null || start === end) {
    return null;
  }
  const a = getCoords(element, start);
  const b = getCoords(element, end);
  return {
    top: Math.min(a.top, b.top),
    left: (a.left + b.left) / 2,
  };
}
