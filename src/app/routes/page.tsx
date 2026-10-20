import type { Metadata } from "next";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { RealWorldPlanner } from "@/components/routing/RealWorldPlanner";
import { getStorageStatus } from "@/lib/database/client";

export const metadata: Metadata = {
  title: "Real-world walking routes",
  description:
    "Find walking directions from OpenStreetMap data and open endpoints in Google Maps. Accessibility is unverified.",
};

export default async function RealRoutesPage({ searchParams }: { searchParams: Promise<{ saved?: string; access?: string }> }) {
  const { saved, access } = await searchParams;
  return (
    <>
      <SiteHeader />
      <RealWorldPlanner liveAvailable={getStorageStatus().available} savedId={typeof saved === 'string' ? saved : undefined} initialAccess={access==='1'} />
      <SiteFooter realWorld />
    </>
  );
}
