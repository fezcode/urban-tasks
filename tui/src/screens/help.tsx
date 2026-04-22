import React from 'react';
import { Box, Text, useInput } from 'ink';

interface Props {
  onClose: () => void;
}

interface Section {
  title: string;
  keys: Array<[string, string]>;
}

const SECTIONS: Section[] = [
  {
    title: 'Global',
    keys: [
      ['?', 'toggle this help'],
      ['q', 'quit'],
      ['b / Esc', 'back (most screens)'],
      ['r', 'reload'],
    ],
  },
  {
    title: 'Projects',
    keys: [
      ['j / k · ↑ / ↓', 'move'],
      ['Enter', 'open'],
      ['N', 'new (name + color)'],
      ['d', 'delete'],
      ['i', 'inbox'],
      ['l', 'logout'],
    ],
  },
  {
    title: 'Inbox',
    keys: [
      ['j / k', 'move'],
      ['a / y', 'accept invitation'],
      ['x / n', 'reject invitation'],
      ['m / Enter', 'mark read'],
      ['A', 'mark all read'],
    ],
  },
  {
    title: 'Task list',
    keys: [
      ['j / k', 'move'],
      ['Enter', 'open detail'],
      ['e', 'edit (full form)'],
      ['Space / x', 'toggle done'],
      ['n', 'new task'],
      ['d', 'delete'],
      ['/', 'search title, body, tags'],
      ['f / F', 'cycle status filter'],
      ['p / P', 'cycle priority filter'],
      ['< / > · [ / ]', 'switch project'],
      ['Esc', 'clear filters, then back'],
    ],
  },
  {
    title: 'Task detail',
    keys: [
      ['Space / x', 'toggle done'],
      ['i', 'toggle in-progress'],
      ['s', 'cycle status'],
      ['e', 'edit'],
      ['a', 'add subtask'],
      ['t', 'toggle subtask'],
      ['D', 'delete subtask'],
      ['@', 'assign / unassign'],
      ['j / k', 'move between subtasks'],
    ],
  },
  {
    title: 'Task form',
    keys: [
      ['Tab · ↑ / ↓', 'move between fields'],
      ['← / → · h / l', 'cycle enum options'],
      ['Enter', 'advance / submit on last'],
      ['Ctrl+S', 'save from anywhere'],
      ['Esc', 'cancel'],
    ],
  },
];

export default function Help({ onClose }: Props) {
  useInput((input, key) => {
    if (key.escape || input === '?' || input === 'q' || input === 'b') {
      onClose();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Box borderStyle="round" borderColor="cyan" paddingX={1} flexDirection="column">
        <Text bold color="cyan">
          Keybindings
        </Text>
        <Text dimColor>? or Esc to close</Text>
      </Box>
      <Box marginTop={1} flexDirection="column">
        {SECTIONS.map((section) => (
          <Box
            key={section.title}
            borderStyle="round"
            borderColor="gray"
            paddingX={1}
            marginBottom={1}
            flexDirection="column"
          >
            <Text bold color="magenta">
              {section.title}
            </Text>
            {section.keys.map(([k, v]) => (
              <Box key={k}>
                <Box width={20}>
                  <Text color="green">{k}</Text>
                </Box>
                <Text dimColor>{v}</Text>
              </Box>
            ))}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
