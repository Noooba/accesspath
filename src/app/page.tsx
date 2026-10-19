import Link from "next/link";
import {
  ArrowUpRight,
  ArrowRight,
  Route,
  MapPin,
  Layers,
  MoveUpRight,
  Footprints,
  Waypoints,
  ShieldCheck,
  MessageSquareText,
  Construction,
} from "lucide-react";
import { SiteHeader, SiteFooter } from "@/components/layout/SiteHeader";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { CampusPreview } from "@/components/map/CampusPreview";
import { DEMO_GRAPH } from "@/data/demo-campus";
import { route } from "@/lib/routing";
export default function Home() {
  const strict = route(DEMO_GRAPH, "main-gate", "library", "confirmed"),
    short = route(DEMO_GRAPH, "main-gate", "library", "shortest");
  return (
    <>
      <SiteHeader />
      <main id="main-content" tabIndex={-1}>
        <section className="hero page-width">
          <div className="hero-copy">
            <span className="eyebrow">
              <span className="small-dot" /> More possibility. Fewer barriers.
            </span>
            <h1>
              Find a path that
              <br />
              works for you.
            </h1>
            <p>
              Compare pedestrian routes using documented accessibility
              information—including stairs, ramps, slopes, and obstacles.
            </p>
            <div className="hero-actions">
              <Link className="button primary" href="/explore">
                Explore routes <ArrowUpRight size={18} />
              </Link>
              <Link className="text-link" href="/about">
                See how it works <ArrowRight size={16} />
              </Link>
            </div>
            <div className="hero-trust">
              <ShieldCheck size={17} />
              <span>
                Clear information. Honest limits.
                <br />
                <small>
                  No route is called accessible without the supporting data.
                </small>
              </span>
            </div>
            <Link className="text-link real-home-link" href="/routes">
              Find routes between real places <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="hero-map-panel">
            <div className="map-preview-heading">
              <span>
                <MapPin size={14} /> AccessPath Demo Campus
              </span>
              <StatusBadge>Illustrative demo</StatusBadge>
            </div>
            <CampusPreview
              graph={DEMO_GRAPH}
              result={strict}
              secondary={short}
            />
            <div className="map-preview-label">
              <span className="legend-line teal" /> Step-free in this demo{" "}
              <span className="legend-line blue dashed" /> Shortest walk
            </div>
            <div className="preview-route-card">
              <span className="preview-route-icon">
                <Route size={20} />
              </span>
              <div>
                <strong>
                  Main gate <ArrowRight size={12} /> Library
                </strong>
                <span>
                  {Math.round(strict.distanceMeters)} m · documented demo
                  segments
                </span>
              </div>
              <Link
                href="/explore"
                aria-label="Explore the main gate to library demo route"
              >
                <ArrowUpRight size={19} />
              </Link>
            </div>
          </div>
        </section>
        <div className="transparency-strip page-width">
          <StatusBadge>Demonstration environment</StatusBadge>
          <p>
            Illustrative demo data—not a verified real-world accessibility
            survey.
          </p>
          <Link href="/about">
            Understand the data <ArrowUpRight size={14} />
          </Link>
        </div>
        <section className="approach-section page-width">
          <div className="section-heading">
            <div>
              <span className="eyebrow">A route is more than a line.</span>
              <h2>
                The shortest way isn’t
                <br />
                always the way that works.
              </h2>
            </div>
            <p>
              A stair shortcut can change a journey. AccessPath makes the
              trade-offs visible, so you can inspect the route, its barriers,
              and the information behind it.
            </p>
          </div>
          <div className="route-comparison-feature">
            <div className="feature-route-card shortest">
              <div>
                <span>
                  <Footprints size={17} /> Shortest walk
                </span>
                <b>
                  {Math.round(short.distanceMeters)} <small>m</small>
                </b>
              </div>
              <p>Follows the shortest connected path through the demo graph.</p>
              <span className="feature-warning">
                <Construction size={14} />{" "}
                {short.barriers.some((b) =>
                  b.label.toLowerCase().includes("stair"),
                )
                  ? "Contains a stair segment"
                  : "Review known barriers"}
              </span>
              <div className="mini-route-line">
                <i />
                <span />
                <i />
              </div>
            </div>
            <div className="comparison-explanation">
              <Waypoints size={28} strokeWidth={1.3} />
              <p>
                Same destination.
                <br />
                <strong>A different path.</strong>
              </p>
              <Link className="text-link" href="/explore">
                Compare the routes <ArrowRight size={15} />
              </Link>
            </div>
            <div className="feature-route-card stepfree">
              <div>
                <span>
                  <Route size={17} /> Confirmed step-free
                </span>
                <b>
                  {Math.round(strict.distanceMeters)} <small>m</small>
                </b>
              </div>
              <p>
                Uses only segments with the required accessibility information
                in this simulation.
              </p>
              <span className="feature-confirmation">
                <ShieldCheck size={14} /> Demo rules satisfied · not a real
                survey
              </span>
              <div className="mini-route-line">
                <i />
                <span />
                <i />
              </div>
            </div>
          </div>
        </section>
        <section className="how-section page-width">
          <div>
            <span className="eyebrow">
              From a question to a clearer choice.
            </span>
            <h2>
              Make the information
              <br />
              part of the journey.
            </h2>
          </div>
          <ol>
            <li>
              <span>01</span>
              <div>
                <MapPin size={21} />
                <h3>Choose your places</h3>
                <p>
                  Start with a supported site and the destinations documented in
                  its pathway graph.
                </p>
              </div>
            </li>
            <li>
              <span>02</span>
              <div>
                <Layers size={21} />
                <h3>Compare your options</h3>
                <p>
                  See the shortest walk, documented step-free path, and any
                  uncertain alternatives.
                </p>
              </div>
            </li>
            <li>
              <span>03</span>
              <div>
                <MessageSquareText size={21} />
                <h3>Help keep it current</h3>
                <p>
                  Report a barrier. Reports stay pending until a moderator
                  reviews the evidence.
                </p>
              </div>
            </li>
          </ol>
        </section>
        <section className="coverage-section page-width">
          <div>
            <StatusBadge kind="unknown">
              Real-world pilot: unverified
            </StatusBadge>
            <h2>
              Start small.
              <br />
              Document it well.
            </h2>
            <p>
              We’re exploring a Palos Verdes Peninsula school/community pilot.
              No actual campus pathways have been surveyed or verified in this
              prototype.
            </p>
            <Link href="/community" className="text-link">
              See our evidence and next steps <MoveUpRight size={15} />
            </Link>
          </div>
          <div className="coverage-data">
            <div>
              <span>Available now</span>
              <strong>AccessPath Demo Campus</strong>
              <p>
                {DEMO_GRAPH.nodes.length} synthetic nodes ·{" "}
                {DEMO_GRAPH.edges.length} pathway segments
              </p>
            </div>
            <div>
              <span>Still needed</span>
              <strong>Real observations. Real participation.</strong>
              <p>
                Field measurements, lived experience, permission to map, and
                review by people who use these paths.
              </p>
            </div>
            <Link className="button secondary" href="/report">
              Report a demo obstacle <ArrowUpRight size={16} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
