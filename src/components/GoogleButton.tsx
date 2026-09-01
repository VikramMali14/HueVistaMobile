import { useState } from 'react';
import { ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme';
import { Button } from './Button';
import { useSession } from '../auth';
import { userMessage } from '../api';
import { haptics } from '../haptics';

export interface GoogleButtonProps {
  /** Defaults to "Continue with Google" — the wording Google's own guidance uses. */
  label?: string;
  /** Told what went wrong, so the screen can show it where its other errors go. */
  onError?: (message: string) => void;
  /** Cleared when the sheet opens, so a stale error is not left under the button. */
  onStart?: () => void;
  style?: ViewStyle;
}

/**
 * Continue with Google.
 *
 * There is no Google SDK in this build and no OAuth client of its own: the whole
 * flow is the backend's, opened in a system browser session (see
 * `signInWithGoogle`). That is what makes it possible to offer here at all —
 * this button used to be missing with a note explaining that it was a promise
 * the app could not keep, which stopped being true once the server learned to
 * hand its one-time code back to the app's own scheme instead of the website.
 *
 * Backing out of the sheet is not an error and says nothing: the customer closed
 * a browser they opened. Only a real refusal reaches `onError`.
 */
export function GoogleButton({ label = 'Continue with Google', onError, onStart, style }: GoogleButtonProps) {
  const { signInWithGoogle } = useSession();
  const [busy, setBusy] = useState(false);

  async function run() {
    if (busy) return;
    onStart?.();
    setBusy(true);
    try {
      // On success the root auth gate routes into the app, so there is nothing
      // to do here but stop spinning.
      if (await signInWithGoogle()) haptics.success();
    } catch (err) {
      haptics.error();
      onError?.(userMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Button
      label={label}
      variant="secondary"
      size="lg"
      fullWidth
      loading={busy}
      haptic="none"
      onPress={run}
      style={style}
      icon={<Ionicons name="logo-google" size={18} color={colors.fg} />}
    />
  );
}
