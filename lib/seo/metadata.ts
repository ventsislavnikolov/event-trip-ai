import type { Metadata } from "next";

const FALLBACK_SITE_URL = "https://eventtrip.ai";

const title = "EventTrip.ai | Event-First Trip Planning";
const description =
  "EventTrip.ai is an event-first trip planning assistant that builds ranked travel packages for concerts, festivals, and live events.";
const siteUrl = process.env.NEXT_PUBLIC_APP_URL || FALLBACK_SITE_URL;

export const appMetadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title,
  description,
  keywords: [
    "event travel planner",
    "festival trip planning",
    "concert travel packages",
    "event-first travel assistant",
    "EventTrip.ai",
  ],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title,
    description,
    url: siteUrl,
    siteName: "EventTrip.ai",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/opengraph-image.png",
        width: 1200,
        height: 630,
        alt: "EventTrip.ai event-first travel planning",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
    images: ["/twitter-image.png"],
  },
  robots: {
    index: true,
    follow: true,
  },
};
