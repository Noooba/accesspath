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
      <section aria-labelledby="readable-access">
        <h2 id="readable-access"><ScanEye size={23} aria-hidden="true" /> More than a colored line.</h2>
        <p>Route labels, line patterns, and written summaries distinguish route types and uncertain information. A blocked segment is identified in words. Forms use labels and feedback, and the layout is designed to reflow across desktop, tablet, and mobile screens.</p>
      </section>
      <aside className="data-note"><strong>Target and verification are different.</strong> We target WCAG 2.2 AA. This prototype is not certified as conformant. Automated checks and layout reviews cannot replace screen-reader use and feedback from people with access needs; testing limits are recorded with the project.</aside>
      <section aria-labelledby="access-limits">
        <h2 id="access-limits">What still needs human review.</h2>
        <p>No community usability study or formal assistive-technology audit has been completed for this synthetic release. Route data is fictional, so the app’s purpose should not be mistaken for proof that a real pathway is accessible.</p>
        <Link href="/explore" className="button primary">Explore routes <ArrowRight size={17} aria-hidden="true" /></Link>
        {' '}<Link href="/about" className="button secondary">Read the methodology</Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
