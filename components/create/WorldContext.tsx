"use client";

import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export type ActiveWorld =
  | "storyverse"
  | "creatorlab"
  | "careerlab";

type WorldContextType = {
  activeWorld: ActiveWorld;
  setActiveWorld: (world: ActiveWorld) => void;
};

const fallbackWorldContext: WorldContextType = {
  activeWorld: "storyverse",
  setActiveWorld: () => {
    // Runtime-safe fallback until CreatePage is wrapped with WorldProvider.
  },
};

const WorldContext =
  createContext<WorldContextType | null>(null);

export function WorldProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activeWorld, setActiveWorld] =
    useState<ActiveWorld>("storyverse");

  const value = useMemo(
    () => ({
      activeWorld,
      setActiveWorld,
    }),
    [activeWorld],
  );

  return (
    <WorldContext.Provider value={value}>
      {children}
    </WorldContext.Provider>
  );
}

export function useWorldState() {
  return useContext(WorldContext) ?? fallbackWorldContext;
}
