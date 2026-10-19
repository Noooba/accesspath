import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { ReportForm } from "@/components/reports/ReportForm";
import { getStorageStatus } from "@/lib/database/client";
export default async function Report({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const query = await searchParams;
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="report-page page-width">
        <header className="page-heading">
          <span className="eyebrow">Community reporting</span>
          <h1>
            A better path starts
            <br />
            with better information.
          </h1>
          <p>
            Share an observation about a documented segment. Reports are saved
            as pending review, never automatically treated as verified facts.
          </p>
        </header>
        <ReportForm
          storageAvailable={getStorageStatus().available}
          initialSite={typeof query.site === "string" ? query.site : undefined}
          initialEdge={typeof query.edge === "string" ? query.edge : undefined}
          receipt={
            typeof query.receipt === "string" ? query.receipt : undefined
          }
        />
      </main>
      <SiteFooter />
    </>
  );
}
