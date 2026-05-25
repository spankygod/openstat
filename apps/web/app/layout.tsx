import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OpenStat",
  description: "Decision-to-trade observability for AI trading agents",
  icons: {
    icon: [{ url: "/assets/logo.svg", type: "image/svg+xml" }],
    shortcut: [{ url: "/assets/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/assets/logo.svg", type: "image/svg+xml" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className="light" data-theme="light" lang="en">
      <body>{children}</body>
    </html>
  );
}
