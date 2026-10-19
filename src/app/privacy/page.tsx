import Link from "next/link";
import { ArrowRight, Database, MapPinOff, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";

export default function PrivacyPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="reading-page page-width">
        <header className="page-heading">
          <span className="eyebrow">Privacy and data</span>
          <h1>Useful route information. Fewer personal details.</h1>
          <p className="muted">
            You do not need an account to explore the demo or submit a pathway
            report. Please keep personal information out of report descriptions.
          </p>
        </header>
        <section aria-labelledby="privacy-collect">
          <h2 id="privacy-collect">
            <Database size={23} aria-hidden="true" /> What a report contains.
          </h2>
          <p>
            A report stores the selected site and pathway segment, a barrier
            category, your plain-text description, a generated reference, a
            timestamp, and its review status. A moderator can add internal
            review notes and a review timestamp.
          </p>
          <p>
            Report descriptions and statuses may be displayed publicly.
            Moderator notes and authentication secrets are not part of the
            public report view. Do not submit names, contact details, diagnoses,
            home addresses, school IDs, or information about another person.
          </p>
        </section>
        <section aria-labelledby="privacy-location">
          <h2 id="privacy-location">
            <MapPinOff size={23} aria-hidden="true" /> No live location or photo
            collection.
          </h2>
          <p>
            The app does not request GPS, camera, microphone, or photo uploads.
            The demo uses a schematic map with no external tile requests. There
            is no advertising tracker or visitor analytics integration in the
            application.
          </p>
          <p>
            The hosting provider may process request and infrastructure logs
            under its own policies. This app’s report and rate-limit records do
            not store visitor IP addresses or device identifiers.
          </p>
        </section>
        <section aria-labelledby="privacy-map-services">
          <h2 id="privacy-map-services">When you use real-world routing.</h2>
          <p>
            The real-world planner loads street tiles from OpenStreetMap, which
            receives your network request and the map area being viewed.
            Pressing Search sends the entered place name or address through this
            server to Photon. Calculating a walking route sends the two selected
            coordinates to FOSSGIS’s routing server. These providers can log
            requests under their own policies.
          </p>
          <p>
            Searches are sent only when submitted, with no automatic
            search-as-you-type requests. This application uses bounded temporary
            server-memory caches (up to ten minutes for place results and five
            minutes for routes), but does not save your search text or journey
            in the reports database. Shared quota records store only provider
            names and counters. Server and provider infrastructure logs are
            separate from these application records.
          </p>
          <p>
            Opening the Google Maps link shares the selected endpoints with
            Google, which calculates its own walking directions. Google is not
            contacted by that link until you open it. No Google account, paid
            API key, or GPS access is required by AccessPath.
          </p>
          <p>
            <a
              href="https://github.com/komoot/photon#demo-server"
              target="_blank"
              rel="noopener noreferrer"
            >
              Photon service information
            </a>{" "}
            ·{" "}
            <a
              href="https://routing.openstreetmap.de/about.html"
              target="_blank"
              rel="noopener noreferrer"
            >
              FOSSGIS routing and privacy information
            </a>{" "}
            ·{" "}
            <a
              href="https://osmfoundation.org/wiki/Privacy_Policy"
              target="_blank"
              rel="noopener noreferrer"
            >
              OpenStreetMap Foundation privacy policy
            </a>
          </p>
        </section>
        <section aria-labelledby="privacy-storage">
          <h2 id="privacy-storage">
            <ShieldCheck size={23} aria-hidden="true" /> Storage and review.
          </h2>
          <p>
            Local development stores reports in a SQLite database. A serverless
            deployment needs configured remote persistent storage. If storage is
            unavailable, the app must say the report was not saved rather than
            give a false confirmation.
          </p>
          <p>
            Anonymous reports start pending. Administrator review uses a
            server-checked session cookie; this cookie is required only for
            moderation. Approving a report is not a complete accessibility
            verification.
          </p>
          <p>
            The prototype has no automatic report-deletion schedule or public
            deletion portal. Reports remain until the operator removes them from
            the database. Before collecting real community reports, the operator
            needs a published contact and retention/removal process. The current
            environment is for synthetic demonstration reports.
          </p>
        </section>
        <aside className="data-note">
          <strong>For the demo, describe a fictional obstacle.</strong> Do not
          include private details. Rate limits and duplicate checks reduce
          misuse; they do not establish that an anonymous report is accurate.
        </aside>
        <section aria-labelledby="privacy-next">
          <h2 id="privacy-next">Check what the prototype actually knows.</h2>
          <p>
            Our evidence record separates synthetic pathway data and stored
            reports from real surveys or impact research. Real campus data is
            not yet supplied.
          </p>
          <Link href="/community" className="button secondary">
            View the evidence record <ArrowRight size={17} aria-hidden="true" />
          </Link>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
