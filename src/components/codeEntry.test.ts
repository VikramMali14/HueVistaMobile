import { codeEntry } from './codeEntry';

describe('codeEntry', () => {
  it('upper-cases and strips punctuation from a shop code', () => {
    // A slip from the counter gets read aloud, typed with a dash, or pasted
    // with a stray space. None of that is a different code.
    expect(codeEntry('k7m-2qa', 'alphanumeric', 6)).toEqual({ value: 'K7M2QA', complete: true });
  });

  it('keeps only digits for an emailed code', () => {
    expect(codeEntry('4 8 1 5 1 6', 'numeric', 6)).toEqual({ value: '481516', complete: true });
  });

  it('truncates a paste longer than the code', () => {
    expect(codeEntry('K7M2QAZZZZ', 'alphanumeric', 6)).toEqual({ value: 'K7M2QA', complete: true });
  });

  it('is incomplete until the last character lands', () => {
    expect(codeEntry('K7M2Q', 'alphanumeric', 6).complete).toBe(false);
  });

  it('reports the completed value alongside the flag, not just the flag', () => {
    // The regression this exists for: completion used to be signalled on its
    // own, leaving the handler to read a code the parent had not committed yet
    // — so auto-submit on the sixth character silently did nothing.
    const entry = codeEntry('K7M2QA', 'alphanumeric', 6);
    expect(entry.complete).toBe(true);
    expect(entry.value).toHaveLength(6);
  });

  it('treats an emptied field as incomplete rather than throwing', () => {
    expect(codeEntry('', 'numeric', 6)).toEqual({ value: '', complete: false });
  });
});
