export interface InlineSegment {
  text: string;
  bold: boolean;
}

export type ReviewBlock =
  | { kind: 'heading'; text: string }
  | { kind: 'paragraph'; segments: InlineSegment[] }
  | { kind: 'list'; items: InlineSegment[][] };

export interface ParsedReview {
  score: number | null;
  blocks: ReviewBlock[];
}


const SCORE_PREFIX = /^\*\*(\d{1,3})\s*\/\s*100\*\*\s*[—–-]?\s*/;


function toSegments(text: string): InlineSegment[] {
  return text
    .split('**')
    .map((part, index) => ({ text: part, bold: index % 2 === 1 }))
    .filter((segment) => segment.text !== '');
}


export function parseReview(markdown: string): ParsedReview {
  const result: ParsedReview = { score: null, blocks: [] };
  let paragraph: string[] = [];
  let list: InlineSegment[][] = [];

  const flushParagraph = (): void => {
    if (paragraph.length === 0) {
      return;
    }

    let text = paragraph.join(' ');
    paragraph = [];

    const match = SCORE_PREFIX.exec(text);

    if (match !== null && result.score === null) {
      const value = Number(match[1]);

      if (value <= 100) {
        result.score = value;
        text = text.slice(match[0].length);
      }
    }

    if (text !== '') {
      result.blocks.push({ kind: 'paragraph', segments: toSegments(text) });
    }
  };

  const flushList = (): void => {
    if (list.length > 0) {
      result.blocks.push({ kind: 'list', items: list });
      list = [];
    }
  };

  for (const rawLine of markdown.split('\n')) {
    const line = rawLine.trim();

    if (line === '') {
      flushParagraph();
      flushList();
    } else if (line.startsWith('## ')) {
      flushParagraph();
      flushList();
      result.blocks.push({ kind: 'heading', text: line.slice(3).trim() });
    } else if (line.startsWith('- ') || line.startsWith('* ')) {
      flushParagraph();
      list.push(toSegments(line.slice(2)));
    } else {
      flushList();
      paragraph.push(line);
    }
  }

  flushParagraph();
  flushList();

  return result;
}