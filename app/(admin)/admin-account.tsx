import { StyleSheet, ScrollView, Linking } from 'react-native';
import { Screen, Text, Card, Button } from '../../src/components';
import { spacing } from '../../src/theme';
import { AccountPanel } from '../../src/account/AccountPanel';
import { webUrl } from '../../src/api';

/**
 * The admin's own account, plus the one honest thing to say about scope: the
 * console lives on the website, and here is the link to it.
 */
export default function AdminAccount() {
  const consoleUrl = webUrl('/admin');

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <Text variant="title">Account</Text>
        <AccountPanel>
          <Card>
            <Text variant="label">Admin console</Text>
            <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
              Creating shops and distributors, changing roles, granting plans, uploading company
              shades and the migration tools all run on the HueVista website. The app shows you the
              platform and lets you paint a room; it does not provision anything.
            </Text>
            {consoleUrl ? (
              <Button
                label="Open the console on the website"
                variant="secondary"
                fullWidth
                style={styles.action}
                onPress={() => Linking.openURL(consoleUrl).catch(() => {})}
              />
            ) : null}
          </Card>
        </AccountPanel>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  action: { marginTop: spacing.md },
});
