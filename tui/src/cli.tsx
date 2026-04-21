#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import meow from 'meow';
import App from './app.js';

const cli = meow(
  `
  Usage
    $ urban-tasks [options]

  Options
    --api-url   Backend URL (default: $URBAN_TASKS_API or http://localhost:8080)
    --logout    Clear stored session and exit

  Keys
    Login     tab/enter · ctrl+r to toggle login/register
    Projects  j/k or arrows · enter to open · l logout · q quit
    Tasks     j/k · space toggle done · n new · d delete · r reload · b back
`,
  {
    importMeta: import.meta,
    flags: {
      apiUrl: { type: 'string' },
      logout: { type: 'boolean' },
    },
  },
);

if (cli.flags.logout) {
  const { clearSession } = await import('./storage.js');
  clearSession();
  console.log('Session cleared.');
  process.exit(0);
}

const apiUrl =
  cli.flags.apiUrl ?? process.env.URBAN_TASKS_API ?? 'http://localhost:8080';

render(<App apiUrl={apiUrl} />);
