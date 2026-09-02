"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

const MerchantSearchContext = createContext<{
  query: string;
  setQuery: (q: string) => void;
}>({ query: "", setQuery: () => {} });

export function MerchantSearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState("");
  return (
    <MerchantSearchContext.Provider value={{ query, setQuery }}>
      {children}
    </MerchantSearchContext.Provider>
  );
}

export function useMerchantSearch() {
  return useContext(MerchantSearchContext);
}
