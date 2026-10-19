import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { RealWorldPlanner } from "@/components/routing/RealWorldPlanner";
import { getStorageStatus } from "@/lib/database/client";

export const metadata: Metadata = {
  title: "Real-world walking routes",
  description:
    "Find walking directions from OpenStreetMap data and open endpoints in Google Maps. Accessibility is unverified.",
};

export default function RealRoutesPage() {
  return (
    <>
      <SiteHeader />
      <RealWorldPlanner liveAvailable={getStorageStatus().available} />
      <SiteFooter realWorld />
    </>
  );
}
