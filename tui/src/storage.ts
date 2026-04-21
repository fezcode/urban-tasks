import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

export interface Session {
  accessToken: string;
  refreshToken: string;
  userId: string;
  email: string;
  name: string;
  apiUrl: string;
}

const configPath = join(homedir(), '.urban-tasks', 'session.json');

export function loadSession(): Session | null {
  if (!existsSync(configPath)) return null;
  try {
    return JSON.parse(readFileSync(configPath, 'utf8')) as Session;
  } catch {
    return null;
  }
}

export function saveSession(s: Session): void {
  mkdirSync(dirname(configPath), { recursive: true });
  writeFileSync(configPath, JSON.stringify(s, null, 2), { mode: 0o600 });
}

export function clearSession(): void {
  if (existsSync(configPath)) writeFileSync(configPath, '{}');
}
