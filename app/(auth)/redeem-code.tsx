import { useState } from 'react';
import { View, StyleSheet, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { Screen, Text, Button, Input, Card } from '../../src/components';
import { colors, spacing } from '../../src/theme';

/**
 * Access-code redeem entry (PLAN.md §3). The code field + linked-shop card are
 * laid out here; wiring to `POST /api/access-codes/redeem` (which links the
 * customer to the issuing retailer) is the next Phase 1 task, so submit is
 * disabled for now.
 */
export default function RedeemCode() {
  const router = useRouter();
  const [code, setCode] = useState('');

  return (
    <Screen scroll contentStyle={styles.content}>
      <Pressable onPress={() => router.back()} hitSlop={12}>
        <Text variant="label" color={colors.fgSoft}>
          ‹ Back
        </Text>
      </Pressable>

      <View style={styles.header}>
        <Text variant="title">Enter your shop code</Text>
        <Text variant="bodySoft">
          Your paint shop can give you a code like HV-4821KP to unlock visualizing with them.
        </Text>
      </View>

      <View style={styles.form}>
        <Input
          label="Access code"
          value={code}
          onChangeText={(t) => setCode(t.toUpperCase())}
          placeholder="HV-XXXXXX"
          autoCapitalize="characters"
          autoCorrect={false}
          mono
          maxLength={10}
        />
        <Button label="Redeem code" size="lg" fullWidth disabled onPress={() => {}} />
        <Card>
          <Text variant="label">Coming next</Text>
          <Text variant="bodySoft" style={{ marginTop: spacing.xs }}>
            Redeeming links your account to the shop and shows their store card here. That connection
            lands in the next update.
          </Text>
        </Card>
      </View>

      <View style={styles.footer}>
        <Text variant="bodySoft">Don&apos;t have a code? </Text>
        <Pressable onPress={() => router.replace('/register')} hitSlop={8}>
          <Text variant="label" color={colors.accentSoft}>
            Create an account
          </Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.xl, paddingTop: spacing.xl },
  header: { gap: spacing.xs },
  form: { gap: spacing.md },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
});
