import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import "./globals.css";
import "./creatorlab-ux-p2a.css";
import "./creatorlab-ux-p2a-compat.css";
import "./creatorlab-ux-p2a-final.css";
import "./creatorlab-ux-p2b.css";
import "./creatorlab-ux-p2c.css";
import "./creatorlab-ux-p2d.css";
import "./creatorlab-ux-h0a.css";
import "./creatorlab-ux-i-b.css";
import "./creatorlab-ux-i-c.css";
import "./creatorlab-ux-i-d.css";
import "./creatorlab-ux-i-e.css";
import "./creatorlab-reports.css";

export const metadata: Metadata = {
  title: "Velto",
  description: "Focused AI creation platform for Storyverse and CreatorLab.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${GeistSans.variable} ${GeistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
