import * as chrono from 'chrono-node';

export interface QuickAddResult {
  title: string;
  tags: string[];
  priority?: 'high' | 'medium' | 'low';
  recurrence?: 'daily' | 'weekly' | 'biweekly' | 'monthly';
  dueDate?: string; // YYYY-MM-DD
  hasTime: boolean; // true when chrono parsed a specific time-of-day
}

const TAG_RE = /(?:^|\s)#([A-Za-z0-9_-]+)/g;
const PRIORITY_RE = /(?:^|\s)!(high|h|medium|med|m|low|l)\b/i;
const RECURRENCE_RE = /(?:^|\s)\^(daily|weekly|biweekly|monthly)\b/i;

const PRIORITY_MAP: Record<string, 'high' | 'medium' | 'low'> = {
  h: 'high',
  high: 'high',
  m: 'medium',
  med: 'medium',
  medium: 'medium',
  l: 'low',
  low: 'low',
};

function stripMatch(input: string, match: RegExpMatchArray): string {
  const start = match.index ?? 0;
  return (input.slice(0, start) + input.slice(start + match[0].length)).trim();
}

export function parseQuickAdd(input: string, now: Date = new Date()): QuickAddResult {
  let working = input;
  const tags: string[] = [];

  // Tags: collect all #tag matches, then strip them
  const tagMatches = Array.from(working.matchAll(TAG_RE));
  for (const m of tagMatches) {
    if (m[1]) tags.push(m[1].toLowerCase());
  }
  working = working.replace(TAG_RE, ' ').replace(/\s+/g, ' ').trim();

  // Priority
  let priority: QuickAddResult['priority'];
  const pm = working.match(PRIORITY_RE);
  if (pm) {
    priority = PRIORITY_MAP[pm[1].toLowerCase()];
    working = stripMatch(working, pm);
  }

  // Recurrence
  let recurrence: QuickAddResult['recurrence'];
  const rm = working.match(RECURRENCE_RE);
  if (rm) {
    recurrence = rm[1].toLowerCase() as QuickAddResult['recurrence'];
    working = stripMatch(working, rm);
  }

  // Date/time via chrono — take the first parsed result so trailing date phrases
  // don't accidentally consume a meaningful title prefix.
  let dueDate: string | undefined;
  let hasTime = false;
  const parsed = chrono.parse(working, now, { forwardDate: true });
  if (parsed.length > 0) {
    const first = parsed[0];
    const date = first.start.date();
    if (!Number.isNaN(date.getTime())) {
      dueDate = date.toISOString().slice(0, 10);
      hasTime = first.start.isCertain('hour');
      // strip the matched span from the title
      const before = working.slice(0, first.index);
      const after = working.slice(first.index + first.text.length);
      working = (before + ' ' + after).replace(/\s+/g, ' ').trim();
    }
  }

  return {
    title: working,
    tags,
    priority,
    recurrence,
    dueDate,
    hasTime,
  };
}
