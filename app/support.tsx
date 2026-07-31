import { useState } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Screen, Text, Card, Button, Input } from '../src/components';
import { colors, radius, spacing } from '../src/theme';
import { supportApi, userMessage, SupportConversation } from '../src/api';

/**
 * Support: an assisted chat, with a person one tap away.
 *
 * The thread lives on the server, so it survives the app being closed and is the
 * same conversation the shop's e-mail replies land in. The assistant answers in
 * the response to a post, which is why sending and receiving are one round-trip
 * rather than a socket.
 */
export default function SupportScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [error, setError] = useState<string | null>(null);

  const threads = useQuery({
    queryKey: ['support', 'conversations'],
    queryFn: () => supportApi.conversations(),
    staleTime: 30_000,
  });

  const thread = useQuery({
    queryKey: ['support', 'thread', openId],
    queryFn: () => supportApi.get(openId as string),
    enabled: Boolean(openId),
  });

  const send = useMutation({
    mutationFn: (message: string) =>
      openId ? supportApi.post(openId, message) : supportApi.start(message),
    onSuccess: (conv: SupportConversation) => {
      setOpenId(conv.id);
      setDraft('');
      setError(null);
      queryClient.setQueryData(['support', 'thread', conv.id], conv);
      queryClient.invalidateQueries({ queryKey: ['support', 'conversations'] });
    },
    onError: (err) => setError(userMessage(err)),
  });

  const escalate = useMutation({
    mutationFn: () => supportApi.requestHuman(openId as string),
    onSuccess: (conv) => queryClient.setQueryData(['support', 'thread', conv.id], conv),
  });

  const messages = thread.data?.messages ?? [];

  return (
    <Screen>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <Pressable onPress={() => (openId ? setOpenId(null) : router.back())} hitSlop={12}>
            <Text variant="label" color={colors.fgSoft}>
              ‹ {openId ? 'All conversations' : 'Back'}
            </Text>
          </Pressable>
          <Text variant="title">Support</Text>
        </View>

        {!openId ? (
          <ScrollView contentContainerStyle={styles.list}>
            <Card>
              <Text variant="bodySoft">
                Ask anything about your codes, your plan or a room that isn&apos;t behaving. Type
                below to start.
              </Text>
            </Card>

            {(threads.data ?? []).map((t) => (
              <Pressable key={t.id} onPress={() => setOpenId(t.id)}>
                <Card style={styles.threadRow}>
                  <Text variant="label" numberOfLines={1}>
                    {t.subject?.trim() || 'Conversation'}
                  </Text>
                  <Text variant="caption" numberOfLines={2}>
                    {t.lastMessage ?? '—'}
                  </Text>
                </Card>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <ScrollView contentContainerStyle={styles.list}>
            {thread.isLoading ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              messages.map((m) => {
                const mine = m.sender === 'USER' || m.sender === 'CUSTOMER';
                return (
                  <View
                    key={m.id}
                    style={[styles.bubble, mine ? styles.mine : styles.theirs]}
                  >
                    <Text variant="body">{m.body}</Text>
                  </View>
                );
              })
            )}
            {thread.data?.status && thread.data.status !== 'CLOSED' ? (
              <Button
                label="Ask for a person"
                variant="ghost"
                loading={escalate.isPending}
                onPress={() => escalate.mutate()}
              />
            ) : null}
          </ScrollView>
        )}

        <View style={styles.composer}>
          {error ? (
            <Text variant="caption" color={colors.danger}>
              {error}
            </Text>
          ) : null}
          <Input
            value={draft}
            onChangeText={setDraft}
            placeholder={openId ? 'Write a reply…' : 'What do you need help with?'}
            multiline
          />
          <Button
            label={send.isPending ? 'Sending…' : 'Send'}
            fullWidth
            loading={send.isPending}
            disabled={!draft.trim()}
            onPress={() => send.mutate(draft.trim())}
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, gap: spacing.xs },
  list: { padding: spacing.lg, gap: spacing.sm },
  threadRow: { gap: spacing.xs },
  bubble: {
    padding: spacing.md,
    borderRadius: radius.card,
    maxWidth: '88%',
    borderWidth: 1,
    borderColor: colors.rule,
  },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.surface2 },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.surface },
  composer: {
    padding: spacing.lg,
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.rule,
  },
});
