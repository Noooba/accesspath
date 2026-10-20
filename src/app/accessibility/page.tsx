import Link from 'next/link';
import { ArrowRight, Keyboard, ListOrdered, ScanEye } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/layout/SiteHeader';

export default function AccessibilityPage() {
  return <>
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="reading-page page-width">
      <header className="page-heading">
        <span className="eyebrow">Interface accessibility</span>
        <h1>You should not need to use the map to use AccessPath.</h1>
        <p className="muted">Route planning should work through clear controls and readable directions, with the map as another way to inspect the same information.</p>
      </header>
      <section aria-labelledby="without-map">
        <h2 id="without-map"><ListOrdered size={23} aria-hidden="true" /> Plan a route in words.</h2>
        <ol>
          <li>Open the explorer and select a start and destination using the labeled fields.</li>
          <li>Choose a route mode and any additional preferences, then calculate.</li>
          <li>Read the route explanation, barrier and uncertainty summaries, and ordered itinerary.</li>
          <li>If no route qualifies, use the explicit alternative or change the destination. A map gesture is not required.</li>
        </ol>
      </section>
      <section aria-labelledby="keyboard-access">
        <h2 id="keyboard-access"><Keyboard size={23} aria-hidden="true" /> Keyboard and movement.</h2>
        <p>Use Tab and Shift+Tab to move between controls. Use Enter or Space to activate buttons and the arrow keys for native selection controls. The skip link goes directly to the main content. Essential tasks have alternatives to dragging or selecting small map points.</p>
        <p>Visible focus identifies the active control. The interface respects your device’s reduced-motion setting and does not require an animation to explain a route result.</p>
      </section>
      <section aria-labelledby="mobility-planning"><h2 id="mobility-planning">Walking and rolling, with your preferences.</h2><p>The street planner offers wheelchair / mobility access preferences for mapped stairs, ramps, slopes, width, kerbs and reviewed obstacles. Missing access data remains visible. Local access-aware paths are not field-verified and can still contain unmapped barriers; use strict mapped-detail mode when unknown information does not meet your needs.</p><p>Opt-in live guidance provides a moving GPS position, next-step display, optional spoken prompts and controlled rerouting. Low-accuracy fixes pause automatic decisions. A device location permission is optional; every route can still be planned with manual coordinates and labeled fields.</p><Link className="button primary" href="/routes?access=1">Open access-aware planning</Link></section>
      <section aria-labelledby="readable-access">
        <h2 id="readable-access"><ScanEye size={23} aria-hidden="true" /> More than a colored line.</h2>
        <p>Route labels, line patterns, and written summaries distinguish route types and uncertain information. A blocked segment is identified in words. Forms use labels and feedback, and the layout is designed to reflow across desktop, tablet, and mobile screens.</p>
      </section>
      <aside className="data-note"><strong>Target and verification are different.</strong> We target WCAG 2.2 AA. This prototype is not certified as conformant. Automated checks and layout reviews cannot replace screen-reader use and feedback from people with access needs; testing limits are recorded with the project.</aside>
      <section aria-labelledby="access-limits">
        <h2 id="access-limits">What still needs human review.</h2>
        <p>No community usability study or formal assistive-technology audit has been completed. Campus data is synthetic; street routes use external map data with explicit limitations. The app’s purpose should not be mistaken for proof that a real pathway is accessible.</p>
        <Link href="/explore" className="button primary">Explore routes <ArrowRight size={17} aria-hidden="true" /></Link>
        {' '}<Link href="/about" className="button secondary">Read the methodology</Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
