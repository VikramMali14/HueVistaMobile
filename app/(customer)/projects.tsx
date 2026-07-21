import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Text, Card, Button } from '../../src/components';
import { colors, spacing, radius } from '../../src/theme';

export default function Projects() {
  const router = useRouter();
  return (
    <Screen scroll contentStyle={styles.content}>
      <Text variant="title">Your projects</Text>

      <Card style={styles.empty}>
        <View style={styles.icon}>
          <Ionicons name="albums-outline" size={26} color={colors.fgMute} />
        </View>
        <Text variant="heading">No projects yet</Text>
        <Text variant="bodySoft" center>
          Visualize a room and save it — your projects will appear here so you can resume editing and
          share them.
        </Text>
        <Button label="Visualize a room" onPress={() => router.push('/visualize')} style={styles.cta} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  empty: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.xxl },
  icon: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  cta: { marginTop: spacing.md },
});
