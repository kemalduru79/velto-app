"use client";

import { useEffect, useRef } from "react";

import { useWorldState } from "@/components/create/WorldContext";

const worldIds = {
  storyverse: "storyverse-workspace",
  creatorlab: "creatorlab-workspace",
} as const;

export default function WorldFocusRouter() {
  const { activeWorld } = useWorldState();
  const previousWorldRef = useRef(activeWorld);

  useEffect(() => {
    if (previousWorldRef.current === activeWorld) return;

    previousWorldRef.current = activeWorld;

    const target = document.getElementById(worldIds[activeWorld]);
    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeWorld]);

  return null;
}
