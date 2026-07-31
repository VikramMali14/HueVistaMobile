import { z } from 'zod';
import { apiFetch } from './client';

/**
 * AI-assisted support chat, available to every role.
 *
 * Verified against `SupportController`. The `/inbox` half of that controller is
 * the ADMIN side of the same threads and stays on the web, per the locked
 * decision that admin tools are not built into the app.
 */

/** MessageResponse.sender — who wrote a line in the thread. */
export const messageSenderSchema = z.string();

export const supportMessageSchema = z.object({
  id: z.string(),
  sender: messageSenderSchema,
  body: z.string().nullish(),
  createdAt: z.string().nullish(),
});
export type SupportMessage = z.infer<typeof supportMessageSchema>;

/** ConversationResponse — one thread with its messages. */
export const supportConversationSchema = z.object({
  id: z.string(),
  channel: z.string().nullish(),
  status: z.string().nullish(),
  subject: z.string().nullish(),
  createdAt: z.string().nullish(),
  updatedAt: z.string().nullish(),
  messages: z.array(supportMessageSchema).default([]),
});
export type SupportConversation = z.infer<typeof supportConversationSchema>;

/** ConversationSummaryResponse — a thread as it appears in a list. */
export const supportConversationSummarySchema = z.object({
  id: z.string(),
  channel: z.string().nullish(),
  status: z.string().nullish(),
  subject: z.string().nullish(),
  requesterName: z.string().nullish(),
  requesterEmail: z.string().nullish(),
  requesterRole: z.string().nullish(),
  lastMessage: z.string().nullish(),
  updatedAt: z.string().nullish(),
});
export type SupportConversationSummary = z.infer<typeof supportConversationSummarySchema>;

export const supportApi = {
  /** This account's own threads, most recently updated first. */
  conversations(): Promise<SupportConversationSummary[]> {
    return apiFetch('/support/conversations').then((d) =>
      z.array(supportConversationSummarySchema).parse(d),
    );
  },

  /** Open a thread with a first message; the assistant answers in the response. */
  start(message: string, subject?: string): Promise<SupportConversation> {
    return apiFetch('/support/conversations', {
      method: 'POST',
      json: { message, subject },
      // The first reply is a model call, so the default 20 s can be tight.
      timeoutMs: 60_000,
    }).then((d) => supportConversationSchema.parse(d));
  },

  get(id: string): Promise<SupportConversation> {
    return apiFetch(`/support/conversations/${encodeURIComponent(id)}`).then((d) =>
      supportConversationSchema.parse(d),
    );
  },

  /** Post a reply. Returns the thread including the assistant's answer. */
  post(id: string, message: string): Promise<SupportConversation> {
    return apiFetch(`/support/conversations/${encodeURIComponent(id)}/messages`, {
      method: 'POST',
      json: { message },
      timeoutMs: 60_000,
    }).then((d) => supportConversationSchema.parse(d));
  },

  /** Escalate: ask for a person instead of the assistant. */
  requestHuman(id: string): Promise<SupportConversation> {
    return apiFetch(`/support/conversations/${encodeURIComponent(id)}/request-human`, {
      method: 'POST',
    }).then((d) => supportConversationSchema.parse(d));
  },
};
