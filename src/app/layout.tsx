import type { Metadata, Viewport } from "next";
import { Creepster, Fredoka, Patrick_Hand } from "next/font/google";
import "./globals.css";
import { SITE_URL, X_HANDLE } from "@/lib/site";

const spooky = Creepster({
  variable: "--font-spooky",
  weight: "400",
  subsets: ["latin"],
});

const hand = Patrick_Hand({
  variable: "--font-hand",
  weight: "400",
  subsets: ["latin"],
});

// Rounded heavy face that sits close to the HAUNT wordmark in the banner.
const round = Fredoka({
  variable: "--font-round",
  weight: "700",
  subsets: ["latin"],
});

const TITLE = "HAUNT";
const DESCRIPTION =
  "HAUNT rises on October 31. Enter the haunted mansion, solve the room and escape before the candles die.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: "%s | HAUNT" },
  description: DESCRIPTION,
  applicationName: "HAUNT",
  openGraph: { type: "website", title: TITLE, description: DESCRIPTION, siteName: "HAUNT" },
  twitter: { card: "summary_large_image", title: TITLE, description: DESCRIPTION, site: X_HANDLE },
};

export const viewport: Viewport = {
  themeColor: "#151515",
  colorScheme: "dark",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${spooky.variable} ${hand.variable} ${round.variable}`}>
      <body>{children}</body>
    </html>
  );
}
