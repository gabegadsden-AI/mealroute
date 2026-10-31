import type { MetadataRoute } from "next";

// Web app manifest — makes MealRoute an installable PWA ("Add to Home Screen").
// Prerequisite for both the PWA launch funnel and the Google Play Trusted Web
// Activity wrapper (PWABuilder/Bubblewrap validates against this file).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "MealRoute — Plan your meals. Track your way.",
    short_name: "MealRoute",
    description:
      "AI meal planning, photo and barcode food logging, and one-tap re-logging. Plan your meals. Track your way.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    // Matches the app's own surface so the installed-app launch screen blends
    // into the first painted frame instead of flashing stark white.
    background_color: "#f9fafb",
    theme_color: "#5db04d",
    categories: ["health", "fitness", "food", "lifestyle"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
