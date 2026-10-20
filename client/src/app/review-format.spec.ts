import { parseReview } from './review-format';

const SAMPLE = `## Nota
**35/100** — O texto é só um resumo.

## Pontos fortes
- Clareza sobre a **stack** principal.
- Formação relevante.

## Problemas
- **Formato inadequado:** falta estrutura.
`;

describe('parseReview', () => {
  it('returns an empty review for empty text', () => {
    expect(parseReview('')).toEqual({ score: null, blocks: [] });
  });

  it('extracts the score and removes it from the paragraph', () => {
    const review = parseReview(SAMPLE);

    expect(review.score).toBe(35);
    expect(review.blocks[1]).toEqual({
      kind: 'paragraph',
      segments: [{ text: 'O texto é só um resumo.', bold: false }],
    });
  });

  it('accepts different dash styles and spacing in the score line', () => {
    expect(parseReview('**80 / 100** - Bom').score).toBe(80);
    expect(parseReview('**7/100** – Fraco').score).toBe(7);
    expect(parseReview('**100/100**').score).toBe(100);
  });

  it('ignores scores above 100', () => {
    const review = parseReview('**150/100** — impossível');

    expect(review.score).toBeNull();
    expect(review.blocks).toHaveLength(1);
  });

  it('keeps only the first score', () => {
    expect(parseReview('**10/100** — a\n\n**90/100** — b').score).toBe(10);
  });

  it('turns "## " lines into headings', () => {
    const review = parseReview(SAMPLE);

    expect(review.blocks.filter((block) => block.kind === 'heading')).toEqual([
      { kind: 'heading', text: 'Nota' },
      { kind: 'heading', text: 'Pontos fortes' },
      { kind: 'heading', text: 'Problemas' },
    ]);
  });

  it('groups consecutive bullets into one list and keeps bold segments', () => {
    const review = parseReview(SAMPLE);
    const list = review.blocks[3];

    expect(list).toEqual({
      kind: 'list',
      items: [
        [
          { text: 'Clareza sobre a ', bold: false },
          { text: 'stack', bold: true },
          { text: ' principal.', bold: false },
        ],
        [{ text: 'Formação relevante.', bold: false }],
      ],
    });
  });

  it('accepts "* " as a bullet marker', () => {
    expect(parseReview('* um\n* dois').blocks).toEqual([
      {
        kind: 'list',
        items: [[{ text: 'um', bold: false }], [{ text: 'dois', bold: false }]],
      },
    ]);
  });

  it('joins lines of the same paragraph with a space', () => {
    expect(parseReview('linha um\nlinha dois').blocks).toEqual([
      { kind: 'paragraph', segments: [{ text: 'linha um linha dois', bold: false }] },
    ]);
  });

  it('never produces HTML: tags stay as plain text', () => {
    const review = parseReview('<script>alert(1)</script>');

    expect(review.blocks).toEqual([
      { kind: 'paragraph', segments: [{ text: '<script>alert(1)</script>', bold: false }] },
    ]);
  });

  it('copes with text that is cut in the middle (streaming)', () => {
    const review = parseReview('## Nota\n**35/100** — O tex');

    expect(review.score).toBe(35);
    expect(review.blocks).toHaveLength(2);
  });

  it('copes with an unclosed bold marker', () => {
    expect(parseReview('- **Formato').blocks).toEqual([
      { kind: 'list', items: [[{ text: 'Formato', bold: true }]] },
    ]);
  });
});