import { useState } from 'react';
import {
  View,
  StyleSheet,
  ActivityIndicator,
  Image as RNImage,
  Linking,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import {
  Screen,
  Text,
  Button,
  BackLink,
  EmptyState,
  Disclosure,
  PressableScale,
} from '../../src/components';
import { StepRail } from '../../src/studio/StepRail';
import { colors, spacing, radius, hairline, alpha } from '../../src/theme';
import {
  imagesApi,
  projectsApi,
  ApiError,
  API_CODES,
  hasCode,
  type LocalImage,
} from '../../src/api';
import { haptics } from '../../src/haptics';
import { useMyEntitlement, useRequestMoreProjects } from '../../src/account/queries';

type Phase = 'idle' | 'uploading';
/** Something stopped us, and each one has its own way out. */
type Blocker =
  | { kind: 'permission'; source: 'camera' | 'library' }
  | { kind: 'unreadable' }
  | { kind: 'tooBig' }
  | { kind: 'allowance'; message: string; askable: boolean }
  | { kind: 'network'; message: string };

/**
 * Step 1 — the photograph.
 *
 * Everything downstream is built on this one image, which is why the guidance
 * ("whole wall in frame, lights on, don't stand too close") is on the screen
 * rather than in a tip after the fact: a bad photo costs a round trip to the
 * server and comes back as a refusal.
 *
 * Every failure here is a screen with a route onward, not a red sentence. A
 * denied camera offers the gallery and the phone's settings; an unreadable photo
 * offers another try and the sample room; a spent allowance offers the shop or
 * the counter. The one thing this screen must never do is stop.
 */
export default function NewRoom() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ code?: string; name?: string; hex?: string; brandSlug?: string }>();

  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [blocker, setBlocker] = useState<Blocker | null>(null);

  const entitlement = useMyEntitlement().data;
  const askShop = useRequestMoreProjects();

  // A shop-managed customer with nothing left is stopped here rather than after
  // they have framed a photo and waited through an upload.
  const outOfRooms = entitlement != null && entitlement.projectsRemaining <= 0;
  const accessEnded = entitlement?.expired ?? false;

  async function pick(source: 'camera' | 'library') {
    setBlocker(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setBlocker({ kind: 'permission', source });
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    await upload({ uri: asset.uri, name: asset.fileName ?? undefined, mimeType: asset.mimeType ?? undefined });
  }

  /**
   * The sample room, for someone who wants to see what this does before
   * standing in front of a wall with their phone up. It goes through the same
   * upload as a real photo, so what they see is the real pipeline and not a
   * canned demo of it.
   */
  async function useSample() {
    setBlocker(null);
    // `resolveAssetSource` lives on React Native's own Image, not on
    // expo-image's — a bundled asset has no file path until the bundler is
    // asked for one, and this is the only API that answers.
    const asset = RNImage.resolveAssetSource(require('../../assets/spike/sample-room.png'));
    setPreview(asset.uri);
    await upload({ uri: asset.uri, name: 'sample-room.png', mimeType: 'image/png' });
  }

  async function upload(image: LocalImage) {
    setPhase('uploading');
    setBlocker(null);
    try {
      const uploaded = await imagesApi.upload(image);
      const project = await projectsApi.create({ imageId: uploaded.imageId });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['account', 'entitlement'] });
      haptics.success();
      // `replace`, not `push`: going back from the room should reach whatever
      // sent them here, not this screen with a stale preview on it.
      router.replace({
        pathname: '/studio/[id]',
        params: { id: project.id, ...params },
      });
    } catch (err) {
      haptics.error();
      setPhase('idle');
      if (err instanceof ApiError && err.status === 422) {
        setBlocker({ kind: 'unreadable' });
      } else if (hasCode(err, API_CODES.VERIFICATION_REQUIRED)) {
        // Not a dead end: the verify screen is the way through, so go there
        // rather than printing a refusal the user cannot act on.
        router.push('/verify');
      } else if (
        hasCode(err, API_CODES.ASK_RETAILER) ||
        hasCode(err, API_CODES.SUBSCRIPTION_REQUIRED) ||
        hasCode(err, API_CODES.PROJECT_LIMIT_REACHED)
      ) {
        setBlocker({
          kind: 'allowance',
          message: (err as ApiError).message,
          askable: hasCode(err, API_CODES.ASK_RETAILER),
        });
      } else if (err instanceof ApiError && err.status === 400) {
        setBlocker({ kind: 'tooBig' });
      } else {
        setBlocker({
          kind: 'network',
          message: err instanceof ApiError ? err.message : 'The upload didn’t finish. Please try again.',
        });
      }
    }
  }

  /* ── Gates ──────────────────────────────────────────────────────────────
     Stopped before a photo is even taken. Nothing was charged, and each of
     these says who can undo it. */
  if (outOfRooms || accessEnded) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink />
        <EmptyState
          icon={accessEnded ? 'time-outline' : 'cube-outline'}
          eyebrow={accessEnded ? 'Access ended' : 'Nothing left to open'}
          title={
            accessEnded
              ? 'Your access window has closed.'
              : `You've used all ${entitlement?.projectAllowance ?? 0} rooms.`
          }
          body={
            accessEnded
              ? 'Your rooms and boards are still here to look at. To start a new one, your shop needs to open a new window.'
              : 'The rooms you finished are saved and you can open them any time. To paint another, you need one more.'
          }
        >
          {askShop.isSuccess ? (
            <View style={styles.asked}>
              <Ionicons name="checkmark-circle" size={17} color={colors.success} />
              <Text variant="label" color={colors.success}>
                Asked — your shop has been notified.
              </Text>
            </View>
          ) : (
            <Button
              label="Ask my shop for another"
              fullWidth
              loading={askShop.isPending}
              onPress={() => askShop.mutate()}
            />
          )}
          <Button
            label="Open my library"
            variant="secondary"
            fullWidth
            onPress={() => router.replace('/library')}
          />
        </EmptyState>
      </Screen>
    );
  }

  if (blocker?.kind === 'allowance') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink onPress={() => setBlocker(null)} />
        <EmptyState
          icon="cube-outline"
          eyebrow="Nothing was charged"
          title="This room can’t be started yet."
          body={blocker.message}
        >
          {blocker.askable ? (
            askShop.isSuccess ? (
              <View style={styles.asked}>
                <Ionicons name="checkmark-circle" size={17} color={colors.success} />
                <Text variant="label" color={colors.success}>
                  Asked — your shop has been notified.
                </Text>
              </View>
            ) : (
              <Button
                label="Ask my shop"
                fullWidth
                loading={askShop.isPending}
                onPress={() => askShop.mutate()}
              />
            )
          ) : (
            <Button label="Buy a room" fullWidth onPress={() => router.push('/buy?what=room')} />
          )}
          <Button label="Back" variant="secondary" fullWidth onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  if (blocker?.kind === 'permission') {
    const camera = blocker.source === 'camera';
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink onPress={() => setBlocker(null)} />
        <EmptyState
          tone="error"
          icon={camera ? 'camera-outline' : 'images-outline'}
          eyebrow={camera ? 'Camera is off' : 'Photos are off'}
          title={`HueVista can’t reach your ${camera ? 'camera' : 'photos'}.`}
          body={`The permission is switched off for this app. Turn it on in ${
            Platform.OS === 'ios' ? 'Settings' : 'the phone’s app settings'
          }, or ${camera ? 'pick a photo you already have' : 'take one instead'}.`}
        >
          <Button label="Open settings" fullWidth onPress={() => Linking.openSettings()} />
          <Button
            label={camera ? 'Choose from gallery' : 'Take a photo'}
            variant="secondary"
            fullWidth
            onPress={() => pick(camera ? 'library' : 'camera')}
          />
          <Button label="Use the sample room" variant="secondary" fullWidth onPress={useSample} />
        </EmptyState>
      </Screen>
    );
  }

  if (blocker?.kind === 'unreadable' || blocker?.kind === 'tooBig') {
    const tooBig = blocker.kind === 'tooBig';
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink onPress={() => setBlocker(null)} />
        {preview ? <Image source={{ uri: preview }} style={styles.rejected} contentFit="cover" /> : null}
        <EmptyState
          tone="error"
          eyebrow={tooBig ? 'That file won’t go' : 'Could not read the photo'}
          title={tooBig ? 'That image is too large.' : 'We can’t find a wall in this one.'}
          body={
            tooBig
              ? 'Use a JPEG, PNG or WebP under 10 MB — a photo straight from the camera is usually fine.'
              : undefined
          }
        >
          {!tooBig ? (
            <View style={styles.tips}>
              <Tip text="The room may be too dark — switch the lights on." />
              <Tip text="Step back so a whole wall is in frame." />
              <Tip text="Hold the phone steady and level." />
            </View>
          ) : null}
          <Text variant="caption">Nothing was charged for this attempt.</Text>
          <Button label="Take another" fullWidth onPress={() => pick('camera')} />
          <Button label="Choose from gallery" variant="secondary" fullWidth onPress={() => pick('library')} />
          <Button label="Use the sample room" variant="secondary" fullWidth onPress={useSample} />
        </EmptyState>
      </Screen>
    );
  }

  if (blocker?.kind === 'network') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <BackLink onPress={() => setBlocker(null)} />
        <EmptyState
          tone="error"
          icon="cloud-offline-outline"
          eyebrow="The upload stopped"
          title="That didn’t reach us."
          body={`${blocker.message} Nothing was charged.`}
        >
          <Button label="Try again" fullWidth onPress={() => pick('camera')} />
          <Button label="Back" variant="secondary" fullWidth onPress={() => router.back()} />
        </EmptyState>
      </Screen>
    );
  }

  /* ── The step itself ──────────────────────────────────────────────────── */
  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <BackLink label="Close" />
        <StepRail current="photo" busy={phase === 'uploading' ? 'photo' : null} />
      </View>

      <View style={styles.head}>
        <Text variant="display">Photograph the wall.</Text>
        <Text variant="bodySoft">
          Whole wall in frame, lights on, and don&apos;t stand too close. Everything after this is built
          on this one picture.
        </Text>
      </View>

      <View style={styles.frame}>
        {preview ? (
          <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
        ) : (
          <View style={styles.guides}>
            <View style={[styles.corner, styles.tl]} />
            <View style={[styles.corner, styles.tr]} />
            <View style={[styles.corner, styles.bl]} />
            <View style={[styles.corner, styles.br]} />
            <Ionicons name="scan-outline" size={30} color={alpha(colors.fg, 0.25)} />
          </View>
        )}
        {phase === 'uploading' ? (
          <View style={styles.busy}>
            <ActivityIndicator color="#fff" />
            <Text variant="label" color="#fff">
              Checking your photo…
            </Text>
          </View>
        ) : null}
      </View>

      {phase === 'idle' ? (
        <View style={styles.actions}>
          <Button
            label="Take a photo"
            size="lg"
            fullWidth
            icon={<Ionicons name="camera" size={18} color="#fff" />}
            onPress={() => pick('camera')}
          />
          <View style={styles.altRow}>
            <AltButton icon="images-outline" label="From gallery" onPress={() => pick('library')} />
            <AltButton icon="home-outline" label="Sample room" onPress={useSample} />
          </View>
        </View>
      ) : null}

      <Disclosure kind="ai" />

      {entitlement ? (
        <Text variant="caption">
          Uses 1 of your {entitlement.projectsRemaining} remaining room
          {entitlement.projectsRemaining === 1 ? '' : 's'}. Charged when the room is created, not per step.
        </Text>
      ) : null}
    </Screen>
  );
}

function Tip({ text }: { text: string }) {
  return (
    <View style={styles.tip}>
      <View style={styles.tipDot} />
      <Text variant="bodySoft" style={styles.tipText}>
        {text}
      </Text>
    </View>
  );
}

function AltButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <PressableScale
      onPress={onPress}
      haptic="tap"
      activeScale={0.96}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={styles.alt}
    >
      <Ionicons name={icon} size={17} color={colors.fgSoft} />
      <Text variant="label">{label}</Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.lg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  head: { gap: spacing.md },
  frame: {
    aspectRatio: 4 / 3,
    borderRadius: radius.well,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: hairline,
    borderColor: colors.glassEdgeSoft,
  },
  preview: { width: '100%', height: '100%' },
  guides: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: alpha(colors.fg, 0.3),
  },
  tl: { top: 18, left: 18, borderTopWidth: 2, borderLeftWidth: 2 },
  tr: { top: 18, right: 18, borderTopWidth: 2, borderRightWidth: 2 },
  bl: { bottom: 18, left: 18, borderBottomWidth: 2, borderLeftWidth: 2 },
  br: { bottom: 18, right: 18, borderBottomWidth: 2, borderRightWidth: 2 },
  busy: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    backgroundColor: colors.scrim,
  },
  rejected: {
    width: '100%',
    aspectRatio: 4 / 3,
    borderRadius: radius.well,
    backgroundColor: colors.surface,
  },
  actions: { gap: spacing.sm },
  altRow: { flexDirection: 'row', gap: spacing.sm },
  alt: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    height: 48,
    borderRadius: radius.button,
    borderWidth: hairline,
    borderColor: colors.glassEdge,
    backgroundColor: colors.glass,
  },
  tips: { gap: spacing.sm },
  tip: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  tipDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.fgMute,
    marginTop: 8,
  },
  tipText: { flex: 1 },
  asked: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
