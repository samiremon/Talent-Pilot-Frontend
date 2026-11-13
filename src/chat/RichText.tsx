/**
 * Shows the AI's reply with light formatting: **bold**, bullet lists ("- " or "* "),
 * and line breaks. Everything else is plain text.
 *
 * We build React elements ourselves instead of inserting HTML, so text from the AI (or
 * from a candidate's email it quotes) can never inject scripts into the page.
 */
import type { ReactNode } from 'react';

/** "a **b** c" -> ["a ", <strong>b</strong>, " c"] */
function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') && part.length > 4 ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  );
}

export function RichText({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let bullets: string[] = [];
  let paragraph: string[] = [];

  const flushParagraph = () => {
    if (paragraph.length) blocks.push(<p key={blocks.length}>{inline(paragraph.join(' '))}</p>);
    paragraph = [];
  };
  const flushBullets = () => {
    if (bullets.length) {
      blocks.push(
        <ul key={blocks.length}>
          {bullets.map((b, i) => (
            <li key={i}>{inline(b)}</li>
          ))}
        </ul>,
      );
    }
    bullets = [];
  };

  for (const raw of text.split('\n')) {
    const line = raw.trim();
    const bullet = /^[-*•]\s+(.*)$/.exec(line);
    if (bullet) {
      flushParagraph();
      bullets.push(bullet[1] ?? '');
    } else if (line === '') {
      flushParagraph();
      flushBullets();
    } else {
      flushBullets();
      paragraph.push(line);
    }
  }
  flushParagraph();
  flushBullets();
  return <div className="rich">{blocks}</div>;
}
