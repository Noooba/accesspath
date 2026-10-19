import type { Metadata } from "next";
import localFont from "next/font/local";
import "leaflet/dist/leaflet.css";
import "./globals.css";
import { getStorageStatus } from "@/lib/database/client";
const heading = localFont({
  src: "../../public/fonts/manrope.ttf",
  variable: "--font-heading",
  display: "swap",
});
const body = localFont({
  src: "../../public/fonts/inter.ttf",
  variable: "--font-body",
  display: "swap",
});
export const metadata: Metadata = {
  title: {
    default: "AccessPath — Every route should be accessible",
    template: "%s · AccessPath",
  },
  description:
    "Compare pathway accessibility with transparent graph-based routing. Explore a clearly labeled synthetic campus and report barriers for review.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${heading.variable} ${body.variable}`}>
      <body>
        {!getStorageStatus().available && (
          <aside
            className="deployment-notice"
            aria-label="Deployment availability"
          >
            <strong>Limited preview</strong>
            <span>
              The synthetic campus works. Reports and in-app place
              search/routing need a connected database. You can still choose map
              points and open walking directions in Google Maps.
            </span>
          </aside>
        )}
        {children}
      </body>
    </html>
  );
}
