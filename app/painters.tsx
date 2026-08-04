import { useState } from 'react';
import { View, StyleSheet, ScrollView, Share } from 'react-native';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Text, Card, Button, StatusPill, Input, SheetModal, BackLink } from '../src/components';
import { colors, spacing } from '../src/theme';
import { painterApi, decimal, userMessage, AdminUser, PainterInvitation } from '../src/api';
import { useCreatePainter, useMyOrg } from '../src/account/roleQueries';
import { expiryText } from '../src/account/EntitlementCard';

/**
 * The shop's painters: who works with it, and the invitations it has sent.
 *
 * A painter joins by redeeming a code, never by being added — the account is
 * theirs, with their own login and their own job list, so it has to be them who
 * accepts. The shop's side of that is minting the code and getting it to them.
 */
export default function PaintersScreen() {
  const queryClient = useQueryClient();
  const org = useMyOrg();
  const orgId = org.data?.id;

  const [inviteOpen, setInviteOpen] = useState(false);
  const [phone, setPhone] = useState('');
  const [minted, setMinted] = useState<PainterInvitation | null>(null);
  const [error, setError] = useState<string | null>(null);

  const createPainter = useCreatePainter(orgId);
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [created, setCreated] = useState<AdminUser | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);

  function closeCreate() {
    setCreateOpen(false);
    setCreated(null);
    setCreateError(null);
    setNewName('');
    setNewEmail('');
    setNewPhone('');
    setNewPassword('');
  }

  async function submitCreate() {
    setCreateError(null);
    try {
      const user = await createPainter.mutateAsync({
        name: newName,
        email: newEmail,
        password: newPassword,
        phone: newPhone.trim() || undefined,
      });
      setCreated(user);
    } catch (err) {
      setCreateError(userMessage(err));
    }
  }

  const painters = useQuery({
    queryKey: ['painter', 'for-retailer', orgId],
    queryFn: () => painterApi.forRetailer(orgId as string),
    enabled: Boolean(orgId),
  });

  const invitations = useQuery({
    queryKey: ['painter', 'invitations', orgId],
    queryFn: () => painterApi.listInvitations(orgId as string),
    enabled: Boolean(orgId),
  });

  const invite = useMutation({
    mutationFn: () => painterApi.invite(orgId as string, phone.trim() || undefined),
    onSuccess: (inv) => {
      setMinted(inv);
      setPhone('');
      setError(null);
      queryClient.invalidateQueries({ queryKey: ['painter', 'invitations', orgId] });
    },
    onError: (err) => setError(userMessage(err)),
  });

  async function sendInvite(inv: PainterInvitation) {
    await Share.share({
      message:
        `Join ${inv.retailerName ?? 'our shop'} on HueVista.\n` +
        `Your invitation code: ${inv.code}\n` +
        `Install the HueVista app, create your account, and enter this code under Account.`,
    }).catch(() => {});
  }

  const live = (invitations.data ?? []).filter((i) => !i.used && !i.expired);

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content}>
        <BackLink />

        <View style={styles.header}>
          <Text variant="title">Painters</Text>
          <Text variant="bodySoft">
            {(painters.data ?? []).length} working with you
            {live.length ? ` · ${live.length} invitation${live.length === 1 ? '' : 's'} out` : ''}
          </Text>
        </View>

        <Button label="Invite a painter" fullWidth onPress={() => setInviteOpen(true)} />
        <Button
          label="Create an account for them"
          variant="secondary"
          fullWidth
          onPress={() => setCreateOpen(true)}
        />

        {painters.isLoading ? (
          <Text variant="caption">Loading…</Text>
        ) : (painters.data ?? []).length === 0 ? (
          <Card>
            <Text variant="bodySoft">
              No painters yet. Invite one and the jobs you assign them land straight on their phone.
            </Text>
          </Card>
        ) : (
          (painters.data ?? []).map((p) => {
            const rate = decimal(p.dayRateInr);
            return (
              <Card key={p.userId} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text variant="heading" numberOfLines={1} style={styles.name}>
                    {p.name ?? 'Painter'}
                  </Text>
                  <StatusPill
                    label={p.active ? 'Active' : 'Inactive'}
                    tone={p.active ? 'done' : 'expired'}
                  />
                </View>
                <Text variant="caption">
                  {p.specialties?.length ? p.specialties.join(', ') : 'General'}
                  {p.jobsCompleted ? ` · ${p.jobsCompleted} jobs done` : ''}
                  {rate != null ? ` · ₹${rate.toLocaleString('en-IN')}/day` : ''}
                </Text>
                {p.phone ? (
                  <Text variant="caption" color={colors.fgSoft}>
                    {p.phone}
                  </Text>
                ) : null}
              </Card>
            );
          })
        )}

        {live.length ? (
          <>
            <Text variant="label">Invitations out</Text>
            {live.map((i) => (
              <Card key={i.id} style={styles.row}>
                <View style={styles.rowHead}>
                  <Text variant="mono">{i.code}</Text>
                  <Button label="Send" variant="ghost" onPress={() => sendInvite(i)} />
                </View>
                <Text variant="caption">
                  {i.phoneHint ? `For ${i.phoneHint} · ` : ''}
                  {i.expiresAt ? `expires ${expiryText(i.expiresAt)}` : 'no expiry'}
                </Text>
              </Card>
            ))}
          </>
        ) : null}
      </ScrollView>

      <SheetModal
        visible={inviteOpen}
        onClose={() => {
          setInviteOpen(false);
          setMinted(null);
          setError(null);
        }}
        title="Invite a painter"
      >
        {minted ? (
          <View style={styles.sheet}>
            <Text variant="bodySoft">Give this code to your painter:</Text>
            <Text variant="mono" style={styles.bigCode}>
              {minted.code}
            </Text>
            <Button label="Send it" fullWidth onPress={() => sendInvite(minted)} />
            <Button
              label="Done"
              variant="secondary"
              fullWidth
              onPress={() => {
                setInviteOpen(false);
                setMinted(null);
              }}
            />
          </View>
        ) : (
          <View style={styles.sheet}>
            <Input
              label="Their mobile number (optional)"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              placeholder="Helps you tell invitations apart"
            />
            {error ? (
              <Text variant="body" color={colors.danger}>
                {error}
              </Text>
            ) : null}
            <Button
              label="Create the code"
              fullWidth
              loading={invite.isPending}
              onPress={() => invite.mutate()}
            />
          </View>
        )}
      </SheetModal>

      {/*
        The other way in, which the website has had all along and the app did not.
        An invitation is still the better default — the painter sets their own
        password and the account is unambiguously theirs — so this sheet says so
        rather than presenting the two as equivalent. It exists for the painter
        standing at the counter who cannot check an email right now.
      */}
      <SheetModal
        visible={createOpen}
        onClose={closeCreate}
        title="Create a painter account"
      >
        <ScrollView
          style={styles.createScroll}
          contentContainerStyle={styles.createSheet}
          keyboardShouldPersistTaps="handled"
        >
          {created ? (
            <>
              <Text variant="bodySoft">
                {created.name ?? 'The painter'} can sign in now with {created.email} and the
                password you set. Ask them to change it once they are in.
              </Text>
              <Button label="Done" fullWidth onPress={closeCreate} />
            </>
          ) : (
            <>
              <Text variant="bodySoft">
                You set their first password, so use this when they cannot pick up an invitation —
                otherwise inviting them is cleaner, because they choose their own.
              </Text>
              <Input
                label="Name"
                value={newName}
                onChangeText={setNewName}
                autoCapitalize="words"
                placeholder="As you'd write it on a job sheet"
              />
              <Input
                label="Email"
                value={newEmail}
                onChangeText={setNewEmail}
                autoCapitalize="none"
                keyboardType="email-address"
              />
              <Input
                label="Mobile number (optional)"
                value={newPhone}
                onChangeText={setNewPhone}
                keyboardType="phone-pad"
              />
              <Input
                label="First password"
                value={newPassword}
                onChangeText={setNewPassword}
                autoCapitalize="none"
                secureTextEntry
                hint="At least 8 characters. They can change it after signing in."
              />
              {createError ? (
                <Text variant="body" color={colors.danger}>
                  {createError}
                </Text>
              ) : null}
              <Button
                label="Create the account"
                fullWidth
                loading={createPainter.isPending}
                disabled={!newName.trim() || !newEmail.trim() || newPassword.length < 8}
                onPress={submitCreate}
              />
            </>
          )}
        </ScrollView>
      </SheetModal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.xs },
  row: { gap: spacing.xs },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  name: { flexShrink: 1 },
  sheet: { gap: spacing.sm, alignItems: 'center' },
  bigCode: { fontSize: 26, letterSpacing: 2, marginVertical: spacing.sm },
  createScroll: { maxHeight: 460 },
  createSheet: { gap: spacing.md, paddingBottom: spacing.lg },
});
