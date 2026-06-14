import type { FlowStatus } from "@/lib/flows";

export type DashboardMessages = {
  languageSwitch: {
    label: string;
    tr: string;
    en: string;
  };
};

export const dashboardMessages: Record<"tr" | "en", DashboardMessages> = {
  tr: {
    languageSwitch: {
      label: "Arayüz dili",
      tr: "TR",
      en: "EN",
    },
  },
  en: {
    languageSwitch: {
      label: "UI language",
      tr: "TR",
      en: "EN",
    },
  },
};

export const dashboardStatusOrder: FlowStatus[] = ["active"];
