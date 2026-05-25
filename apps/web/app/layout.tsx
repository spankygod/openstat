import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenStat",
  description: "Decision-to-trade observability for AI trading agents",
  icons: {
    icon: [{ url: "/icon.png", type: "image/png" }],
    shortcut: [{ url: "/favicon.ico", type: "image/x-icon" }],
    apple: [{ url: "/icon.png", type: "image/png" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="light" data-theme="light" lang="en">
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
