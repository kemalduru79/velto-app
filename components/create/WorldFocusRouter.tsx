"use client";

import { useEffect } from "react";

import { useWorldState } from "@/components/create/WorldContext";

const worldIds = {
  storyverse: "storyverse-workspace",
  creatorlab: "creatorlab-workspace",
  careerlab: "careerlab-workspace",
} as const;

export default function WorldFocusRouter() {
  const { activeWorld } = useWorldState();

  useEffect(() => {
    const targetId = worldIds[activeWorld];
    const target = document.getElementById(targetId);

    if (!target) return;

    target.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }, [activeWorld]);

  return null;
}
