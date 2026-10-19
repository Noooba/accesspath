import { SiteHeader } from "@/components/layout/SiteHeader";
import { Explorer } from "@/components/routing/Explorer";
export default async function Explore({ searchParams }: { searchParams: Promise<{ saved?: string; mode?: string }> }) {
  const { saved, mode } = await searchParams;
  return (
    <>
      <SiteHeader />
      <Explorer savedId={typeof saved === 'string' ? saved : undefined} initialMode={mode === 'shortest' ? 'shortest' : 'confirmed'} />
    </>
  );
}
