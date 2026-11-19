// Expo returns one ticket per message, in the order sent.
// https://docs.expo.dev/push-notifications/sending-notifications/#push-tickets
export interface PushTicket {
  status: 'ok' | 'error';
  id?: string;
  message?: string;
  details?: { error?: string };
}

export interface TicketSummary {
  ok: number;
  failed: number;
  /** Tokens Expo says will never work again (app uninstalled, token revoked). */
  deadTokens: string[];
  errors: { token: string; error: string; message?: string }[];
}

export function summarizeTickets(tokens: string[], tickets: PushTicket[]): TicketSummary {
  const summary: TicketSummary = { ok: 0, failed: 0, deadTokens: [], errors: [] };
  tickets.forEach((ticket, i) => {
    const token = tokens[i];
    if (ticket.status === 'ok') {
      summary.ok += 1;
      return;
    }
    summary.failed += 1;
    const error = ticket.details?.error ?? 'Unknown';
    if (error === 'DeviceNotRegistered' && token) summary.deadTokens.push(token);
    summary.errors.push({ token: token ?? '?', error, message: ticket.message });
  });
  return summary;
}
