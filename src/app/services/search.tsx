import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

interface SearchContextValue {
  readonly query: string;
  setQuery: (q: string) => void;
}

const SearchContext = createContext<SearchContextValue | null>(null);

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const value = useMemo(() => ({ query, setQuery }), [query]);
  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>;
}

export function useSearch(): SearchContextValue {
  const ctx = useContext(SearchContext);
  if (!ctx) throw new Error('useSearch must be used inside <SearchProvider>');
  return ctx;
}

export function matchesQuery(query: string, ...haystacks: ReadonlyArray<string | undefined>): boolean {
  if (!query.trim()) return true;
  const q = query.trim().toLowerCase();
  return haystacks.some((h) => h != null && h.toLowerCase().includes(q));
}
