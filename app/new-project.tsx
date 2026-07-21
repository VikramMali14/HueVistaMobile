import { useState } from 'react';
import { View, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Screen, Text, Button, Card } from '../src/components';
import { colors, spacing, radius } from '../src/theme';
import { imagesApi, projectsApi, ApiError } from '../src/api';

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

      {phase !== 'uploading' ? (
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
  previewWrap: { borderRadius: radius.card, overflow: 'hidden', borderWidth: 1, borderColor: colors.rule },
  preview: { width: '100%', aspectRatio: 4 / 3, backgroundColor: colors.surface },
  previewOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.scrim },
});
