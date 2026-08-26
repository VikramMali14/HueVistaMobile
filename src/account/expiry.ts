/**
 * "in 4 days" / "today" / "expired" for an access window.
 *
 * Lives on its own because four screens want the phrase and none of them want
 * the card it used to be attached to — importing a React component to borrow a
 * date helper is how a bundle grows for no reason.
 */
export function expiryText(iso?: string | null): string | null {
  if (!iso) return null;
  const end = new Date(iso).getTime();
  if (Number.isNaN(end)) return null;
  const days = Math.ceil((end - Date.now()) / 86_400_000);
  if (days < 0) return 'expired';
  if (days === 0) return 'today';
  return `in ${days} day${days === 1 ? '' : 's'}`;
}
