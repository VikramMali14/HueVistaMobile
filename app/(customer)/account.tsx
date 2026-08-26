import { useState } from 'react';
import { View, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useQueryClient } from '@tanstack/react-query';
import {
  Screen,
  Text,
  Card,
  Button,
  Input,
  CodeInput,
  SheetModal,
  SettingsRow,
  SettingsGroup,
  StatusPill,
  Reveal,
} from '../../src/components';
import { colors, spacing, radius, useReducedMotion } from '../../src/theme';
import { useSession } from '../../src/auth';
import {
  API_ORIGIN,
  accessCodesApi,
  authApi,
  ApiError,
  userMessage,
  AccessCodeResponse,
} from '../../src/api';
import {
  useAssignedProducts,
  useMyEntitlement,
  useMyProfile,
  useAiCredits,
} from '../../src/account/queries';
import { expiryText } from '../../src/account';
import { useHapticsPreference } from '../../src/haptics/preference';
import { haptics } from '../../src/haptics';

const CODE_LENGTH = 6;

/**
 * You, and everything that is true about your account.
 *
 * Laid out as a settings list rather than the column of seven cards it used to
 * be, each with its own full-width button — which gave "Sign out" and "Haptics"
 * identical weight and made the destructive row the same size as the rest.
 */
export default function Account() {
  const { user, signOut } = useSession();
  const router = useRouter();
  const queryClient = useQueryClient();

  const profile = useMyProfile().data;
  const entitlement = useMyEntitlement().data;
  const credits = useAiCredits().data;
  const assigned = useAssignedProducts().data;
  const shopName = assigned?.shopName ?? null;

  const [hapticsOn, setHapticsOn] = useHapticsPreference();
  const reducedMotion = useReducedMotion();

  const [busy, setBusy] = useState(false);

  // Link a paint shop (redeem an access code onto an existing account).
  const [linkOpen, setLinkOpen] = useState(false);
  const [code, setCode] = useState('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linked, setLinked] = useState<AccessCodeResponse | null>(null);

  // Change password.
  const [pwOpen, setPwOpen] = useState(false);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwDone, setPwDone] = useState(false);
  const [pwBusy, setPwBusy] = useState(false);

  /**
   * An account provisioned from a shop code has a synthetic address and no
   * password, so offering "change password" would open a form that cannot
   * succeed. The same is true of the verify prompt.
   */
  const passwordless = profile?.provider != null && profile.provider !== 'LOCAL';
  const realEmail = profile?.email && !profile.email.endsWith('.local') ? profile.email : null;
  const expiry = expiryText(entitlement?.accessExpiresAt);

  async function redeem() {
    if (code.length < CODE_LENGTH) return;
    setLinking(true);
    setLinkError(null);
    try {
      setLinked(await accessCodesApi.redeem(code));
      haptics.success();
      // The code carries the projects, the brands and the products — every one
      // of those reads is now stale.
      queryClient.invalidateQueries({ queryKey: ['account'] });
    } catch (err) {
      haptics.error();
      if (err instanceof ApiError && (err.status === 404 || err.status === 400 || err.status === 410)) {
        setLinkError('That code isn’t valid, or it has already been used.');
      } else {
        setLinkError(userMessage(err));
      }
    } finally {
      setLinking(false);
    }
  }

  function closeLink() {
    setLinkOpen(false);
    setCode('');
    setLinkError(null);
    setLinked(null);
  }

  async function changePassword() {
    setPwBusy(true);
    setPwError(null);
    try {
      await authApi.changePassword(current, next);
      haptics.success();
      setPwDone(true);
      setCurrent('');
      setNext('');
    } catch (err) {
      haptics.error();
      setPwError(userMessage(err));
    } finally {
      setPwBusy(false);
    }
  }

  /**
   * Deleting is irreversible and takes the rooms with it, so it asks first and
   * names what goes — a second tap on a red row is not consent.
   */
  function confirmDelete() {
    Alert.alert(
      'Delete your account?',
      'Your rooms, boards and saved colours are removed for good. Boards you already downloaded stay on your phone. This cannot be undone.',
      [
        { text: 'Keep my account', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await authApi.deleteAccount();
              await signOut();
            } catch (err) {
              Alert.alert('Could not delete', userMessage(err));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }

  const initial = (user?.name ?? user?.email ?? '?').charAt(0).toUpperCase();

  return (
    <Screen scroll contentStyle={styles.content}>
      <Reveal>
        <View style={styles.head}>
          <Text variant="eyebrow">Account</Text>
          <View style={styles.identity}>
            <View style={styles.avatar}>
              <Text variant="heading">{initial}</Text>
            </View>
            <View style={styles.identityText}>
              <Text variant="title" numberOfLines={1}>
                {user?.name ?? 'Your account'}
              </Text>
              {realEmail ? (
                <Text variant="caption" numberOfLines={1}>
                  {realEmail}
                </Text>
              ) : null}
            </View>
          </View>
        </View>
      </Reveal>

      {/* The unverified e-mail is the one thing here that will refuse a room
          later, so it leads rather than sitting among the settings. */}
      {profile && !passwordless && !profile.emailVerified ? (
        <Reveal index={1}>
          <Card tone="feature" onPress={() => router.push('/verify')} style={styles.verify}>
            <View style={styles.verifyText}>
              <Text variant="subhead">Verify your email</Text>
              <Text variant="caption">
                Starting a room asks for a verified address. It takes one code.
              </Text>
            </View>
            <StatusPill label="Incomplete" tone="progress" />
          </Card>
        </Reveal>
      ) : null}

      <Reveal index={2}>
        <SettingsGroup>
          <SettingsRow
            icon="cube-outline"
            label="Rooms & AI images"
            hint={
              entitlement
                ? `${entitlement.projectsRemaining} of ${entitlement.projectAllowance} rooms left${
                    expiry && !entitlement.expired ? ` · access ends ${expiry}` : ''
                  }`
                : 'What you have, and how to get more'
            }
            value={credits ? `${credits.balance}` : undefined}
            onPress={() => router.push('/credits')}
          />
          <SettingsRow
            icon="storefront-outline"
            label={shopName ? 'Your shop' : 'Link a paint shop'}
            hint={shopName ?? 'Redeem a code from the counter'}
            onPress={shopName ? undefined : () => setLinkOpen(true)}
          />
          {shopName ? (
            <SettingsRow
              icon="color-fill-outline"
              label="Your products"
              hint="The paint your shop picked for you"
              onPress={() => router.push('/assigned-products')}
            />
          ) : null}
          <SettingsRow
            icon="albums-outline"
            label="My library"
            hint="Rooms, AI images and saved shades"
            onPress={() => router.push('/library')}
          />
        </SettingsGroup>
      </Reveal>

      <Reveal index={3}>
        <SettingsGroup>
          <SettingsRow
            icon="phone-portrait-outline"
            label="Vibration"
            hint="A small buzz when you pick a shade or finish a step"
            toggle={{
              value: hapticsOn,
              onChange: (on) => {
                setHapticsOn(on);
                // Fire once on the way ON so the switch demonstrates what it
                // just enabled. Turning it off is silent, which is the point.
                if (on) haptics.press();
              },
            }}
          />
          <SettingsRow
            icon="contrast-outline"
            label="Appearance"
            hint={
              reducedMotion
                ? 'Dark, and following your phone’s reduced-motion setting'
                : 'Dark, so the wall stays the brightest thing on screen'
            }
          />
          <SettingsRow
            icon="chatbubble-ellipses-outline"
            label="Help & support"
            hint="Ask a question — a person takes over if you need one"
            onPress={() => router.push('/support')}
          />
        </SettingsGroup>
      </Reveal>

      <Reveal index={4}>
        <SettingsGroup>
          {!passwordless ? (
            <SettingsRow icon="key-outline" label="Change password" onPress={() => setPwOpen(true)} />
          ) : null}
          <SettingsRow
            icon="log-out-outline"
            label={busy ? 'Signing out…' : 'Sign out'}
            onPress={() => {
              if (busy) return;
              setBusy(true);
              signOut().finally(() => setBusy(false));
            }}
          />
          <SettingsRow
            icon="trash-outline"
            label="Delete account"
            tone="danger"
            hint="Removes your rooms and boards for good"
            onPress={confirmDelete}
          />
        </SettingsGroup>
      </Reveal>

      <Text variant="caption" center style={styles.build}>
        HueVista {Constants.expoConfig?.version ?? ''} · {API_ORIGIN}
      </Text>

      <SheetModal visible={linkOpen} onClose={closeLink} title="Link a paint shop">
        {linked ? (
          <View style={styles.sheet}>
            <Text variant="subhead" color={colors.success}>
              Linked to {linked.organizationName ?? 'your shop'}.
            </Text>
            <Text variant="bodySoft">
              {linked.projectsRemaining ?? linked.projectQuota ?? 0} room
              {(linked.projectsRemaining ?? linked.projectQuota ?? 0) === 1 ? '' : 's'} are now on your
              account.
            </Text>
            <Button label="Done" fullWidth onPress={closeLink} />
          </View>
        ) : (
          <View style={styles.sheet}>
            <Text variant="bodySoft">
              Six characters from the counter. It adds the rooms your shop assigned and opens the paint
              companies they stock.
            </Text>
            <CodeInput
              value={code}
              onChangeText={(nextCode) => {
                setCode(nextCode);
                setLinkError(null);
              }}
              length={CODE_LENGTH}
              onSubmitEditing={redeem}
              invalid={!!linkError}
              accessibilityLabel="Shop access code"
            />
            {linkError ? (
              <Text variant="caption" color={colors.dangerSoft}>
                {linkError}
              </Text>
            ) : null}
            <Button
              label="Link my shop"
              fullWidth
              loading={linking}
              disabled={code.length < CODE_LENGTH || linking}
              onPress={redeem}
            />
          </View>
        )}
      </SheetModal>

      <SheetModal
        visible={pwOpen}
        onClose={() => {
          setPwOpen(false);
          setPwDone(false);
          setPwError(null);
        }}
        title="Change password"
      >
        {pwDone ? (
          <View style={styles.sheet}>
            <Text variant="subhead" color={colors.success}>
              Password changed.
            </Text>
            <Text variant="bodySoft">Other devices have been signed out.</Text>
            <Button
              label="Done"
              fullWidth
              onPress={() => {
                setPwOpen(false);
                setPwDone(false);
              }}
            />
          </View>
        ) : (
          <View style={styles.sheet}>
            <Input
              label="Current password"
              value={current}
              onChangeText={setCurrent}
              secureTextEntry
              autoComplete="current-password"
            />
            <Input
              label="New password"
              value={next}
              onChangeText={setNext}
              secureTextEntry
              autoComplete="new-password"
              hint="8+ characters, with a letter and a number."
              error={pwError ?? undefined}
            />
            <Button
              label="Change password"
              fullWidth
              loading={pwBusy}
              disabled={current.length === 0 || next.length < 8 || pwBusy}
              onPress={changePassword}
            />
          </View>
        )}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  head: { gap: spacing.md },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: colors.accentGhost,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityText: { flex: 1, gap: 2 },
  verify: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  verifyText: { flex: 1, gap: 3 },
  sheet: { gap: spacing.lg },
  build: { marginTop: spacing.sm },
});
