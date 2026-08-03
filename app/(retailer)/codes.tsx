import { useState } from 'react';
import { View, StyleSheet, FlatList, Share, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen, Serif, Text, Button, Card, Input, SheetModal, StatusPill } from '../../src/components';
import { colors, spacing, fontSize } from '../../src/theme';
import {
  useAccessCodes,
  useCreateCode,
  useExtendCode,
  useMyOrg,
  useRevokeCode,
  useTopUpCode,
} from '../../src/account/roleQueries';
import { userMessage } from '../../src/api';
import { expiryText } from '../../src/account/EntitlementCard';
import type { ShopAccessCode } from '../../src/api';

/**
 * The codes a shop hands its walk-ins.
 *
 * A code is the shop paying for a customer's projects up front: creating one
 * reserves that many projects from the shop's own monthly allowance, which is
 * why the quota lives on this screen too and why the backend can refuse here
 * (402) rather than when the customer is already holding a photo.
 */
export default function CodesScreen() {
  const org = useMyOrg();
  const orgId = org.data?.id;
  const codes = useAccessCodes(orgId);

  const create = useCreateCode(orgId);
  const revoke = useRevokeCode(orgId);
  const extend = useExtendCode(orgId);
  const topUp = useTopUpCode(orgId);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [name, setName] = useState('');
  const [quota, setQuota] = useState('1');
  const [error, setError] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<ShopAccessCode | null>(null);

  async function submit() {
    setError(null);
    const projects = Math.max(1, Number(quota) || 1);
    try {
      const code = await create.mutateAsync({ customerName: name, projectQuota: projects });
      setJustCreated(code);
      setName('');
      setQuota('1');
    } catch (err) {
      setError(userMessage(err));
    }
  }

  function closeSheet() {
    setSheetOpen(false);
    setJustCreated(null);
    setError(null);
  }

  /** Hand the code over the way a counter actually does — WhatsApp, SMS, out loud. */
  async function shareCode(code: ShopAccessCode) {
    const days = code.validDays ?? 0;
    await Share.share({
      message:
        `Your HueVista code: ${code.code}\n` +
        `It opens ${code.projectQuota ?? 1} room${(code.projectQuota ?? 1) === 1 ? '' : 's'}` +
        (days ? ` and lasts ${days} days.` : '.'),
    }).catch(() => {});
  }

  return (
    <Screen>
      <View style={styles.header}>
        <View>
          <Text variant="display">
        <Serif size={fontSize.display}>Codes</Serif>
      </Text>
          <Text variant="bodySoft">{codes.data?.length ?? 0} issued</Text>
        </View>
        <Button
          label="New"
          icon={<Ionicons name="add" size={18} color="#fff" />}
          onPress={() => setSheetOpen(true)}
        />
      </View>

      <FlatList
        data={codes.data ?? []}
        keyExtractor={(c) => c.id ?? c.code ?? String(Math.random())}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={codes.isRefetching}
            onRefresh={() => codes.refetch()}
            tintColor={colors.accent}
          />
        }
        ListEmptyComponent={
          codes.isLoading ? (
            <Text variant="caption">Loading…</Text>
          ) : (
            <Card>
              <Text variant="bodySoft">
                No codes yet. Issue one for a walk-in — they redeem it on their own phone, with no
                account to create at your counter.
              </Text>
            </Card>
          )
        }
        renderItem={({ item }) => {
          const dead = item.revoked || item.expired;
          return (
            <Card style={styles.row}>
              <View style={styles.rowHead}>
                <Text variant="mono">{item.code}</Text>
                <StatusPill
                  label={
                    item.revoked ? 'Revoked' : item.expired ? 'Expired' : item.used ? 'Redeemed' : 'Active'
                  }
                  tone={dead ? 'expired' : item.used ? 'done' : 'progress'}
                />
              </View>

              <Text variant="caption">
                {item.customerName ?? 'Walk-in'} · {item.projectsRemaining ?? 0} of{' '}
                {item.projectQuota ?? 0} projects left
                {item.expiresAt && !dead ? ` · ends ${expiryText(item.expiresAt)}` : ''}
              </Text>

              {!dead ? (
                <View style={styles.rowActions}>
                  <Button label="Send" variant="ghost" onPress={() => shareCode(item)} />
                  {/* Only a code the shop may still add to shows the button — the
                      backend decides that, not a guess from the quota numbers. */}
                  {item.topUpAllowed !== false ? (
                    <Button
                      label="+1 project"
                      variant="ghost"
                      loading={topUp.isPending}
                      onPress={() => topUp.mutate({ codeId: item.id as string, projects: 1 })}
                    />
                  ) : null}
                  <Button
                    label="Extend"
                    variant="ghost"
                    loading={extend.isPending}
                    onPress={() => extend.mutate(item.id as string)}
                  />
                  <Button
                    label="Revoke"
                    variant="ghost"
                    loading={revoke.isPending}
                    onPress={() => revoke.mutate(item.id as string)}
                  />
                </View>
              ) : null}
            </Card>
          );
        }}
      />

      <SheetModal visible={sheetOpen} onClose={closeSheet} title="Issue a code">
        {justCreated ? (
          <View style={styles.done}>
            <Text variant="bodySoft">Hand this to your customer:</Text>
            <Text variant="mono" style={styles.bigCode}>
              {justCreated.code}
            </Text>
            <Text variant="caption">
              Opens {justCreated.projectQuota ?? 1} room
              {(justCreated.projectQuota ?? 1) === 1 ? '' : 's'}
              {justCreated.validDays ? ` · lasts ${justCreated.validDays} days` : ''}
            </Text>
            <Button label="Send it" fullWidth onPress={() => shareCode(justCreated)} />
            <Button label="Done" variant="secondary" fullWidth onPress={closeSheet} />
          </View>
        ) : (
          <View style={styles.form}>
            <Input
              label="Customer name"
              value={name}
              onChangeText={setName}
              placeholder="As you'd write it on a bill"
              autoCapitalize="words"
            />
            <Input
              label="Rooms this code opens"
              value={quota}
              onChangeText={setQuota}
              keyboardType="number-pad"
            />
            <Text variant="caption">
              Each room is taken from your monthly allowance the moment you issue the code, so it is
              paid for before your customer walks out.
            </Text>
            {error ? (
              <Text variant="body" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <Button
              label="Create code"
              fullWidth
              loading={create.isPending}
              disabled={!name.trim()}
              onPress={submit}
            />
          </View>
        )}
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
  },
  list: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.sm },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  rowActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs, marginTop: spacing.xs },
  form: { gap: spacing.md },
  done: { gap: spacing.sm, alignItems: 'center' },
  bigCode: { fontSize: 28, letterSpacing: 2, marginVertical: spacing.sm },
});
