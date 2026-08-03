import { useEffect, useState } from 'react';

/**
 * A value that lags behind, so a search box does not fire a request per
 * keystroke. Shared by the picker sheet and the docked colour panel — they
 * search the same catalogue and had grown their own copies of this.
 */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
