import { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator, Linking } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Text, Button, Card } from '../src/components';
import { colors, spacing, radius } from '../src/theme';
import { imagesApi, projectsApi, ApiError, API_CODES, hasCode, formatPaise, webUrl } from '../src/api';
import {
  useMyEntitlement,
  useProjectPurchaseOptions,
  useRequestMoreProjects,
} from '../src/account/queries';

type Phase = 'idle' | 'uploading' | 'error';

/**
 * Start a project: take a photo or pick one, upload it (the backend classifies
 * it as a room/exterior and rejects anything else with 422), create a project,
 * then open the editor. Uses the OS camera/gallery via expo-image-picker.
 */
export default function NewProject() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [phase, setPhase] = useState<Phase>('idle');
  const [preview, setPreview] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** A refusal with a way out, rather than a sentence in red. */
  const [blocked, setBlocked] = useState<{ code: string; message: string } | null>(null);

  const { data: entitlement } = useMyEntitlement();
  const { data: purchase } = useProjectPurchaseOptions();
  const askRetailer = useRequestMoreProjects();

  // A shop-managed customer whose projects are used up is stopped here rather
  // than after they have framed a photo and waited for an upload.
  const outOfProjects = entitlement != null && entitlement.projectsRemaining <= 0;
  const accessEnded = entitlement?.expired ?? false;
  const canStart = !outOfProjects && !accessEnded;

  async function pick(source: 'camera' | 'library') {
    setError(null);
    const perm =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setError(
        source === 'camera'
          ? 'Camera permission is needed to take a photo. You can enable it in Settings.'
          : 'Photo permission is needed to choose a picture. You can enable it in Settings.',
      );
      setPhase('error');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
        : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
    if (result.canceled || !result.assets?.[0]) return;

    const asset = result.assets[0];
    setPreview(asset.uri);
    await upload(asset);
  }

  async function upload(asset: ImagePicker.ImagePickerAsset) {
    setPhase('uploading');
    setError(null);
    try {
      const image = await imagesApi.upload({
        uri: asset.uri,
        name: asset.fileName ?? undefined,
        mimeType: asset.mimeType ?? undefined,
      });
      const project = await projectsApi.create({ imageId: image.imageId });
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      router.replace(`/project/${project.id}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        setError("That doesn't look like a room or building. Try a photo of the walls you want to paint.");
      } else if (
        hasCode(err, API_CODES.ASK_RETAILER) ||
        hasCode(err, API_CODES.SUBSCRIPTION_REQUIRED) ||
        hasCode(err, API_CODES.IMAGE_LIMIT_REACHED)
      ) {
        setBlocked({ code: (err as ApiError).code as string, message: (err as ApiError).message });
      } else if (err instanceof ApiError && err.status === 400) {
        setError('That image is too large or the wrong type. Use a JPEG, PNG or WebP under 10 MB.');
      } else {
        setError(err instanceof ApiError ? err.message : 'Upload failed. Please try again.');
      }
      setPhase('error');
    }
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Back
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text variant="title">Visualize a room</Text>
        <Text variant="bodySoft">Photograph the room, or pick a photo. We&apos;ll detect the walls next.</Text>
      </View>

      {preview ? (
        <View style={styles.previewWrap}>
          <Image source={{ uri: preview }} style={styles.preview} contentFit="cover" />
          {phase === 'uploading' ? (
            <View style={styles.previewOverlay}>
              <ActivityIndicator color="#fff" />
              <Text variant="label" color="#fff" style={{ marginTop: spacing.sm }}>
                Uploading & checking your photo…
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {phase === 'error' && error ? (
        <Card>
          <Text variant="body" color={colors.danger}>
            {error}
          </Text>
        </Card>
      ) : null}

      {/* Out of projects, or the access window closed. Which one it is decides
          who can fix it: a shop-onboarded customer asks their shop (it assigned
          and paid for these projects), anyone else buys another on the web. */}
      {blocked || !canStart ? (
        <Card>
          <Text variant="label" color={colors.warning}>
            {accessEnded ? 'Your access has ended' : 'No projects left'}
          </Text>
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            {blocked?.message ??
              (accessEnded
                ? 'Ask your shop for a new code to carry on visualizing.'
                : `You've used all ${entitlement?.projectAllowance ?? 0} project${
                    entitlement?.projectAllowance === 1 ? '' : 's'
                  } on your code.`)}
          </Text>

          {entitlement && !accessEnded ? (
            askRetailer.isSuccess ? (
              <Text variant="label" color={colors.success} style={styles.gateAction}>
                Asked ✓ — your shop has been notified.
              </Text>
            ) : (
              <Button
                label="Ask my shop for another"
                variant="secondary"
                fullWidth
                style={styles.gateAction}
                loading={askRetailer.isPending}
                onPress={() => askRetailer.mutate()}
              />
            )
          ) : !entitlement && purchase ? (
            <View style={styles.gateAction}>
              <Text variant="body">
                Another project costs {formatPaise(purchase.projectPricePaise)} and stays open for{' '}
                {purchase.validDays} days.
              </Text>
              {webUrl('/dashboard') ? (
                <Button
                  label="Buy on the website"
                  variant="secondary"
                  fullWidth
                  style={styles.gateAction}
                  onPress={() => Linking.openURL(webUrl('/dashboard') as string).catch(() => {})}
                />
              ) : (
                <Text variant="caption">Payments run on the HueVista website.</Text>
              )}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* Projects already paid for and not yet used — worth saying before the
          user wonders whether starting one will charge them again. */}
      {canStart && !blocked && (purchase?.availableCredits ?? 0) > 0 ? (
        <Text variant="caption">
          {purchase!.availableCredits} paid project{purchase!.availableCredits === 1 ? '' : 's'} ready to use.
        </Text>
      ) : null}

      {phase !== 'uploading' && canStart && !blocked ? (
        <View style={styles.actions}>
          <Button
            label="Take a photo"
            size="lg"
            fullWidth
            icon={<Ionicons name="camera" size={18} color="#fff" />}
            onPress={() => pick('camera')}
          />
          <Button
            label="Choose from gallery"
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Ionicons name="images" size={18} color={colors.fg} />}
            onPress={() => pick('library')}
          />
        </View>
      ) : null}

      <Text variant="caption" center>
        Tip: stand back so the whole wall is in frame, with even lighting.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  header: { gap: spacing.xs },
  actions: { gap: spacing.md },
  gateAction: { marginTop: spacing.md },
  previewWrap: { borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.rule },
  preview: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.surface },
  previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim },
});
