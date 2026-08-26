/** Which characters a code may contain. */
export type CodeMode = 'alphanumeric' | 'numeric';

/**
 * What one keystroke into a boxed code field produces.
 *
 * Pulled out of the component so the one thing that has already gone wrong here
 * can be tested. The bug was not in the sanitising: it was that completion was
 * signalled with a bare callback and the handler read the code back off the
 * parent's state — which, in the same tick as the change, is still one
 * character behind. Every "if the code is short, do nothing" guard then
 * swallowed the auto-submit on the final character.
 *
 * So `complete` travels WITH `value`. A caller that acts on completion has the
 * finished code in its hand and never has to go looking for it.
 */
export function codeEntry(
  raw: string,
  mode: CodeMode,
  length: number,
): { value: string; complete: boolean } {
  const stripped =
    mode === 'numeric'
      ? raw.replace(/[^0-9]/g, '')
      : raw.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const value = stripped.slice(0, length);
  return { value, complete: value.length === length };
}
