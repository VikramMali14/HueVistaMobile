import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, Button, StatusPill, AuthedImage } from '../../src/components';
import type { StatusTone } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';
import { useProjects } from '../../src/projects/queries';
import type { ProjectSummary } from '../../src/api';

function statusTone(status: string): StatusTone {
  switch (status) {
    case 'SEGMENTED':
      return 'done';
    case 'SEGMENTING':
      return 'progress';
    case 'FAILED':
      return 'expired';
    default:
      return 'neutral';
  }
}

function statusLabel(status: string): string {
  switch (status) {
    case 'CREATED':
      return 'Ready to detect';
    case 'SEGMENTING':
      return 'Detecting walls';
    case 'SEGMENTED':
      return 'Ready to paint';
    case 'FAILED':
      return 'Failed';
    default:
      return status;
  }
}

function when(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString();
}

export default function Projects() {
  const router = useRouter();
  const { data, isLoading, isError } = useProjects();

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.head}>
        <Text variant="title">Your projects</Text>
        <Button label="New" icon={<Ionicons name="add" size={18} color="#fff" />} onPress={() => router.push('/new-project')} />
      </View>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      ) : isError ? (
        <Card>
          <Text variant="bodySoft">Couldn&apos;t load your projects. Check your connection and try again.</Text>
        </Card>
      ) : (data?.length ?? 0) === 0 ? (
        <Card style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="albums-outline" size={26} color={colors.fgMute} />
          </View>
          <Text variant="heading">No projects yet</Text>
          <Text variant="bodySoft" center>
            Photograph a room, try shades on the walls, and save it — your projects appear here.
          </Text>
          <Button label="Visualize a room" onPress={() => router.push('/new-project')} style={styles.emptyCta} />
        </Card>
      ) : (
        <View style={styles.list}>
          {data!.map((p: ProjectSummary) => (
            <Card key={p.id} padded={false} onPress={() => router.push(`/project/${p.id}`)}>
              <AuthedImage url={p.imageUrl} style={styles.thumb} contentFit="cover" transition={150} />
              <View style={styles.cardBody}>
                <View style={styles.cardRow}>
                  <Text variant="heading" numberOfLines={1} style={styles.cardName}>
                    {p.name ?? 'Untitled room'}
                  </Text>
                  <StatusPill label={statusLabel(p.status)} tone={statusTone(p.status)} />
                </View>
                <Text variant="caption">
                  {p.regionCount} {p.regionCount === 1 ? 'wall' : 'walls'}
                  {when(p.updatedAt) ? ` · ${when(p.updatedAt)}` : ''}
                </Text>
              </View>
            </Card>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg, paddingTop: spacing.xl },
  head: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  center: { paddingVertical: spacing.xxxl, alignItems: 'center' },
  list: { gap: spacing.md },
  thumb: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.surface2,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
  },
  cardBody: { padding: spacing.md, gap: spacing.xs },
  cardRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  cardName: { flex: 1 },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyCta: { marginTop: spacing.md },
});
