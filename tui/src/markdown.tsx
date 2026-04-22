import React from 'react';
import { Box, Text } from 'ink';

type InlineNode =
  | { kind: 'text'; value: string }
  | { kind: 'bold'; value: string }
  | { kind: 'italic'; value: string }
  | { kind: 'code'; value: string }
  | { kind: 'link'; text: string; url: string };

const INLINE_RE =
  /(\*\*[^*]+\*\*)|(\*[^*]+\*)|(`[^`]+`)|(\[[^\]]+\]\([^)]+\))/g;

function parseInline(line: string): InlineNode[] {
  const out: InlineNode[] = [];
  let last = 0;
  for (const m of line.matchAll(INLINE_RE)) {
    const i = m.index ?? 0;
    if (i > last) out.push({ kind: 'text', value: line.slice(last, i) });
    const token = m[0];
    if (token.startsWith('**')) {
      out.push({ kind: 'bold', value: token.slice(2, -2) });
    } else if (token.startsWith('`')) {
      out.push({ kind: 'code', value: token.slice(1, -1) });
    } else if (token.startsWith('[')) {
      const close = token.indexOf(']');
      const text = token.slice(1, close);
      const url = token.slice(close + 2, -1);
      out.push({ kind: 'link', text, url });
    } else {
      out.push({ kind: 'italic', value: token.slice(1, -1) });
    }
    last = i + token.length;
  }
  if (last < line.length) out.push({ kind: 'text', value: line.slice(last) });
  return out;
}

function Inline({ line }: { line: string }) {
  const nodes = parseInline(line);
  return (
    <Text>
      {nodes.map((n, i) => {
        switch (n.kind) {
          case 'bold':
            return (
              <Text key={i} bold>
                {n.value}
              </Text>
            );
          case 'italic':
            return (
              <Text key={i} italic>
                {n.value}
              </Text>
            );
          case 'code':
            return (
              <Text key={i} color="yellow" backgroundColor="gray">
                {' '}
                {n.value}{' '}
              </Text>
            );
          case 'link':
            return (
              <Text key={i}>
                <Text color="cyan" underline>
                  {n.text}
                </Text>
                <Text dimColor> ({n.url})</Text>
              </Text>
            );
          default:
            return <Text key={i}>{n.value}</Text>;
        }
      })}
    </Text>
  );
}

type Block =
  | { kind: 'heading'; level: number; text: string }
  | { kind: 'paragraph'; text: string }
  | { kind: 'list'; items: string[]; ordered: boolean }
  | { kind: 'code'; lines: string[] }
  | { kind: 'quote'; text: string }
  | { kind: 'blank' };

function parseBlocks(src: string): Block[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const blocks: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const ln = lines[i] ?? '';
    if (ln.startsWith('```')) {
      const buf: string[] = [];
      i += 1;
      while (i < lines.length && !(lines[i] ?? '').startsWith('```')) {
        buf.push(lines[i] ?? '');
        i += 1;
      }
      i += 1; // closing fence
      blocks.push({ kind: 'code', lines: buf });
      continue;
    }
    const heading = /^(#{1,6})\s+(.*)$/.exec(ln);
    if (heading) {
      blocks.push({ kind: 'heading', level: heading[1]!.length, text: heading[2]! });
      i += 1;
      continue;
    }
    if (/^\s*([-*])\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*([-*])\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*([-*])\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'list', items, ordered: false });
      continue;
    }
    if (/^\s*\d+\.\s+/.test(ln)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i] ?? '')) {
        items.push((lines[i] ?? '').replace(/^\s*\d+\.\s+/, ''));
        i += 1;
      }
      blocks.push({ kind: 'list', items, ordered: true });
      continue;
    }
    if (ln.startsWith('> ')) {
      const buf: string[] = [];
      while (i < lines.length && (lines[i] ?? '').startsWith('> ')) {
        buf.push((lines[i] ?? '').slice(2));
        i += 1;
      }
      blocks.push({ kind: 'quote', text: buf.join(' ') });
      continue;
    }
    if (ln.trim() === '') {
      blocks.push({ kind: 'blank' });
      i += 1;
      continue;
    }
    // paragraph: collect until blank line or block boundary
    const buf: string[] = [ln];
    i += 1;
    while (i < lines.length) {
      const n = lines[i] ?? '';
      if (
        n.trim() === '' ||
        n.startsWith('```') ||
        /^(#{1,6})\s+/.test(n) ||
        /^\s*([-*])\s+/.test(n) ||
        /^\s*\d+\.\s+/.test(n) ||
        n.startsWith('> ')
      )
        break;
      buf.push(n);
      i += 1;
    }
    blocks.push({ kind: 'paragraph', text: buf.join(' ') });
  }
  return blocks;
}

export function Markdown({ source }: { source: string }) {
  const blocks = parseBlocks(source);
  return (
    <Box flexDirection="column">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case 'heading': {
            const color = b.level === 1 ? 'cyan' : b.level === 2 ? 'magenta' : 'yellow';
            return (
              <Box key={i} marginTop={i === 0 ? 0 : 1}>
                <Text bold color={color}>
                  {'#'.repeat(b.level)} {b.text}
                </Text>
              </Box>
            );
          }
          case 'paragraph':
            return <Inline key={i} line={b.text} />;
          case 'list':
            return (
              <Box key={i} flexDirection="column">
                {b.items.map((it, j) => (
                  <Box key={j}>
                    <Text color="magenta">{b.ordered ? `${j + 1}. ` : '• '}</Text>
                    <Inline line={it} />
                  </Box>
                ))}
              </Box>
            );
          case 'code':
            return (
              <Box
                key={i}
                borderStyle="round"
                borderColor="gray"
                paddingX={1}
                flexDirection="column"
              >
                {b.lines.map((l, j) => (
                  <Text key={j} color="yellow">
                    {l || ' '}
                  </Text>
                ))}
              </Box>
            );
          case 'quote':
            return (
              <Box key={i}>
                <Text color="gray">│ </Text>
                <Text italic dimColor>
                  {b.text}
                </Text>
              </Box>
            );
          case 'blank':
            return <Box key={i} height={1} />;
        }
      })}
    </Box>
  );
}
