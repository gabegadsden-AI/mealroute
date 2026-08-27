import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MealRoute — Plan your meals. Track your way.",
  description: "Simple meal planning, food tracking and AI-assisted nutrition estimates.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
  themeColor: "#11251a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <meta httpEquiv="Content-Language" content="en" />
      </head>
      <body>{children}</body>
    </html>
  );
}
