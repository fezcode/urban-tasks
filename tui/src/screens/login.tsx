import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';
import Spinner from 'ink-spinner';
import { createClient } from '../api.js';
import { saveSession, type Session } from '../storage.js';

interface Props {
  apiUrl: string;
  onLoggedIn: (s: Session) => void;
}

type Field = 'email' | 'password';
type Mode = 'login' | 'register';

export default function Login({ apiUrl, onLoggedIn }: Props) {
  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [focus, setFocus] = useState<Field | 'name'>('email');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useInput((_input, key) => {
    if (submitting) return;
    if (key.tab) {
      if (mode === 'register') {
        setFocus((f) => (f === 'email' ? 'name' : f === 'name' ? 'password' : 'email'));
      } else {
        setFocus((f) => (f === 'email' ? 'password' : 'email'));
      }
    } else if (key.ctrl && _input === 'r') {
      setMode((m) => (m === 'login' ? 'register' : 'login'));
      setError(null);
    }
  });

  const submit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const api = createClient(apiUrl, undefined);
      const resp =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, name, password);
      const session: Session = {
        accessToken: resp.accessToken,
        refreshToken: resp.refreshToken,
        userId: resp.user.id,
        email: resp.user.email,
        name: resp.user.name,
        apiUrl,
      };
      saveSession(session);
      onLoggedIn(session);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
      setSubmitting(false);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Box
        borderStyle="round"
        borderColor="cyan"
        paddingX={1}
        flexDirection="column"
      >
        <Text bold color="cyan">
          Urban Tasks — {mode === 'login' ? 'Sign in' : 'Create account'}
        </Text>
        <Text dimColor>
          Tab: next field · Enter: submit · Ctrl+R:{' '}
          {mode === 'login' ? 'register' : 'sign in'} instead
        </Text>
      </Box>
      <Box
        borderStyle="round"
        borderColor="gray"
        paddingX={1}
        marginTop={1}
        flexDirection="column"
      >
        <Box>
          <Text color={focus === 'email' ? 'green' : undefined}>email    </Text>
          <TextInput
            value={email}
            onChange={setEmail}
            focus={focus === 'email' && !submitting}
            onSubmit={() =>
              setFocus(mode === 'register' ? 'name' : 'password')
            }
          />
        </Box>
        {mode === 'register' && (
          <Box>
            <Text color={focus === 'name' ? 'green' : undefined}>name     </Text>
            <TextInput
              value={name}
              onChange={setName}
              focus={focus === 'name' && !submitting}
              onSubmit={() => setFocus('password')}
            />
          </Box>
        )}
        <Box>
          <Text color={focus === 'password' ? 'green' : undefined}>password </Text>
          <TextInput
            value={password}
            onChange={setPassword}
            mask="•"
            focus={focus === 'password' && !submitting}
            onSubmit={submit}
          />
        </Box>
      </Box>
      {submitting && (
        <Box marginTop={1}>
          <Text color="yellow">
            <Spinner type="dots" /> Signing in…
          </Text>
        </Box>
      )}
      {error && (
        <Box marginTop={1}>
          <Text color="red">{error}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>API: {apiUrl}</Text>
      </Box>
    </Box>
  );
}
