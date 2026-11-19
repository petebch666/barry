export type RsvpStatus = 'in' | 'maybe' | 'out';

export interface PingerUpdate {
  name: string;
  status: RsvpStatus;
  previousStatus: RsvpStatus | null;
  pingMessage: string;
  /** Answers from everyone but the pinger, this one included. */
  counts: Record<RsvpStatus, number>;
  /** Group members other than the pinger. */
  othersInGroup: number;
}

export function describeAnswer(status: RsvpStatus, previous: RsvpStatus | null): string {
  if (status === 'in') return previous && previous !== 'in' ? 'is in after all' : 'is in';
  if (status === 'maybe') return previous === 'in' ? 'is now a maybe' : 'might come';
  return previous === 'in' ? "can't make it anymore" : "can't make it";
}

export function buildPingerMessage(u: PingerUpdate): { title: string; body: string } | null {
  if (u.previousStatus === u.status) return null;

  let body = `${u.name} ${describeAnswer(u.status, u.previousStatus)}.`;
  const answered = u.counts.in + u.counts.maybe + u.counts.out;
  // Only on the answer that completes the round, not on later changes.
  if (u.previousStatus === null && u.othersInGroup > 0 && answered >= u.othersInGroup) {
    body += ` Everyone has answered: ${u.counts.in} in, ${u.counts.maybe} maybe, ${u.counts.out} out.`;
  }

  const ping = u.pingMessage.length > 40 ? `${u.pingMessage.slice(0, 39)}…` : u.pingMessage;
  return { title: `“${ping}”`, body };
}
