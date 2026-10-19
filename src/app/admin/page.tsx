import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { AdminReview } from "@/components/reports/AdminReview";
export default function Admin() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="admin-page page-width">
        <header className="page-heading">
          <span className="eyebrow">Moderator workspace</span>
          <h1>
            Better records.
            <br />
            More accountable decisions.
          </h1>
          <p>
            Review community observations and document justified changes to
            pathway operation.
          </p>
        </header>
        <AdminReview />
      </main>
      <SiteFooter />
    </>
  );
}
