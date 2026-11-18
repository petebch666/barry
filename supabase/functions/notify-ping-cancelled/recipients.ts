// created_by is null once the ping's creator has deleted their account; a
// .neq('user_id', null) filter would match nobody, so filter in code.
export function recipientIds(rsvpUserIds: string[], createdBy: string | null): string[] {
  return rsvpUserIds.filter((id) => id !== createdBy);
}
