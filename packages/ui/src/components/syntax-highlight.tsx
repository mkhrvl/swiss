import type { CSSProperties } from 'react';
import { cn } from '#lib/utils';

type HighlightRange = Readonly<{
  offset: number;
  length: number;
  kind: string;
}>;

export function syntaxGutterStyle(text: string): CSSProperties {
  const lines = 1 + (text.match(/\r\n|\r|\n/g)?.length ?? 0);
  return {
    '--syntax-gutter': `${String(lines).length + 2}ch`,
  } as CSSProperties;
}

function lineRanges(text: string) {
  const lines: { start: number; end: number }[] = [];
  let start = 0;
  for (const match of text.matchAll(/\r\n|\r|\n/g)) {
    lines.push({ start, end: match.index });
    start = match.index + match[0].length;
    if (lines.length === 20_000) break;
  }
  lines.push({ start, end: text.length });
  return lines;
}

// Presentation only: hosts supply token ranges from their feature library.
// Each logical line owns its number, so soft-wrapped continuations stay aligned.
export function SyntaxHighlight({
  text,
  ranges,
  className,
}: Readonly<{
  text: string;
  ranges: readonly HighlightRange[];
  className?: string;
}>) {
  let rangeIndex = 0;
  // Bound decorative DOM size; the native control always retains the full text.
  const content = lineRanges(text).map(({ start, end }, index) => {
    const lineContent = [];
    let cursor = start;
    while (rangeIndex < ranges.length) {
      const range = ranges[rangeIndex];
      if (!range) break;
      if (range.offset >= end) break;
      const tokenEnd = Math.min(end, range.offset + range.length);
      if (tokenEnd > cursor) {
        const tokenStart = Math.max(cursor, range.offset);
        lineContent.push(
          text.slice(cursor, tokenStart),
          <span key={range.offset} data-syntax={range.kind}>
            {text.slice(tokenStart, tokenEnd)}
          </span>,
        );
        cursor = tokenEnd;
      }
      if (range.offset + range.length > end) break;
      rangeIndex++;
    }
    return (
      <span
        className="syntax-line"
        data-line={index < 20_000 ? index + 1 : undefined}
        key={start}
      >
        {lineContent}
        {text.slice(cursor, end)}
        {'\u200b'}
      </span>
    );
  });
  return (
    <pre aria-hidden="true" className={cn('syntax-highlight', className)}>
      {content}
    </pre>
  );
}
