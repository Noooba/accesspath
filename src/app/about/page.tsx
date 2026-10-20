import Link from "next/link";
import { ArrowRight, GitFork, ListOrdered, ShieldCheck } from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { DEMO_GRAPH } from "@/data/demo-campus";
import { AccessModel } from '@/components/ui/AccessModel';

export default function AboutPage() {
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1} className="reading-page page-width">
        <header className="page-heading">
          <span className="eyebrow">The methodology</span>
          <h1>A route is only as useful as the information behind it.</h1>
          <p className="muted">
            AccessPath makes route choices explainable. It keeps a known
            barrier, an unknown condition, and a documented pathway separate.
          </p>
        </header>
        <AccessModel compact/>

        <aside className="data-note">
          <strong>A demonstration, clearly labeled.</strong> AccessPath Demo
          Campus has {DEMO_GRAPH.nodes.length} invented locations and{" "}
          {DEMO_GRAPH.edges.length} synthetic pathway segments. It is not a
          survey of a real school and must not be used for travel.
        </aside>

        <section aria-labelledby="route-method">
          <h2 id="route-method">
            <GitFork size={23} aria-hidden="true" /> Connected paths. Calculated
            choices.
          </h2>
          <p>
            We represent a site as a graph: intersections, entrances, ramps, and
            destinations are nodes; documented paths between them are edges.
            Each edge records a distance and access information. Dijkstra’s
            algorithm finds the shortest qualifying connection by adding segment
            distances. It respects one-way paths and cannot invent a missing
            connection.
          </p>
          <p>
            The schematic positions and distances in this demo are synthetic.
            Distances are calculated from its invented geometry and stored with
            each edge, rather than measured from screen pixels. They are
            demonstration values, not field measurements.
          </p>
        </section>
        <section aria-labelledby="real-route-method">
          <h2 id="real-route-method">Routes between real places.</h2>
          <p>
            The real-world planner searches places with Photon and requests
            walking routes from FOSSGIS’s OSRM foot-routing dataset, both using
            OpenStreetMap data. Distances, geometry and directions come from the
            provider; the demonstration graph is not substituted if a request
            fails.
          </p>
          <p>Wheelchair / mobility access uses a connected wheelchair-routing profile with steps and ferries excluded, requested mapped slope, width, kerb and surface limits, and reviewed obstacle-avoidance areas. Returned paths are also checked against those reviewed areas. Ramps can be included. The provider does not return complete per-segment ramp or missing-data coverage, so the interface does not invent zero counts or offer unsupported complete-data/no-ramp controls. An optional local OSM graph engine supports finer checks when its data service is available. This beta covers endpoints up to 3 km apart; unmapped endpoint gaps and current field conditions remain unverified.</p>
          <p>Opt-in foreground GPS guidance shows your moving position and next step, with optional browser speech and controlled off-route recalculation. It is not a replacement for a maintained, field-verified mobility-navigation service. Driving, cycling and bus/transit options open the corresponding Google Maps directions; live transit coverage and vehicle accessibility must be checked with the provider.</p>
          <p>
            These are ordinary walking directions. They can include steps or
            inaccessible sections. The provider response does not verify slopes,
            curb ramps, widths, live closures or individual suitability, so
            AccessPath does not call these routes confirmed step-free. Dashed
            links between a selected point and a nearby routed street are
            explicitly labeled un-routed gaps.
          </p>
          <Link className="button secondary" href="/routes">
            Find a real-world walking route <ArrowRight size={16} />
          </Link>
        </section>

        <section aria-labelledby="route-modes">
          <h2 id="route-modes">Three ways to ask a different question.</h2>
          <div className="table-scroll">
            <table>
              <caption>What each route mode includes</caption>
              <thead>
                <tr>
                  <th scope="col">Mode</th>
                  <th scope="col">Route question</th>
                  <th scope="col">What to watch for</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Shortest Walk</th>
                  <td>
                    Which available path is shortest under the selected
                    preferences?
                  </td>
                  <td>
                    It can contain stairs or other documented barriers. Check
                    the explanation.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Confirmed Step-Free</th>
                  <td>Which path meets the documented step-free rules?</td>
                  <td>
                    Incomplete or unverified access records are excluded. Demo
                    records only demonstrate those rules.
                  </td>
                </tr>
                <tr>
                  <th scope="row">Exploratory Step-Free</th>
                  <td>
                    What potential path remains if incomplete information is
                    allowed?
                  </td>
                  <td>
                    Known stairs and blocked paths remain excluded. Unknown
                    details require confirmation before travel.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p>
            Strict mode checks the site, endpoints, step-free status, operating
            status, surface, slope, width, and curb information. Slope and width
            preferences are product rules, not a legal accessibility assessment
            or a guarantee of individual suitability.
          </p>
        </section>

        <section aria-labelledby="unknown-method">
          <h2 id="unknown-method">
            <ShieldCheck size={23} aria-hidden="true" /> Unknown never means
            confirmed.
          </h2>
          <p>
            If no strict route qualifies, AccessPath says so. Choosing an
            exploratory result is a separate action, and uncertain segments stay
            visible. The app does not silently substitute a route with missing
            evidence.
          </p>
          <p>
            A “demonstration” record is an authored fixture. “Unverified” means
            review or information is missing. “Verified” describes reviewed
            attributes and their source, not live conditions or a blanket
            statement that a route works for everyone.
          </p>
          <p>
            Reported obstacles start as pending. Moderator approval and a
            justified operating-status update do not automatically verify a
            segment’s slope, width, or other access details.
          </p>
        </section>

        <section aria-labelledby="text-method">
          <h2 id="text-method">
            <ListOrdered size={23} aria-hidden="true" /> The route exists beyond
            the map.
          </h2>
          <p>
            Start and destination controls, segment details, and an ordered
            itinerary provide a text route experience. The map and itinerary use
            the same calculated sequence. Simulations change a copy of the
            synthetic graph and are labeled so they cannot be mistaken for a new
            field report.
          </p>
        </section>

        <section aria-labelledby="coverage-method">
          <h2 id="coverage-method">A small, honest starting point.</h2>
          <p>
            The campus workspace uses fictional data; street planning uses OpenStreetMap with the limits described above. Palos Verdes
            Peninsula is only a potential campus pilot: no real school paths,
            observations, partnership, or impact result have been supplied. A
            real pilot needs permitted measurements, documented review,
            participant testing, and a process for keeping conditions current.
          </p>
          <p>
            AccessPath does not replace official site guidance, professional
            mobility assessments, or emergency instructions. Conditions and
            individual requirements can extend beyond its recorded fields.
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
