import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { SiteHeader, SiteFooter } from '@/components/layout/SiteHeader';
import { EvidenceDashboard } from '@/components/community/EvidenceDashboard';

export default function CommunityPage() {
  return <>
    <SiteHeader />
    <main id="main-content" tabIndex={-1} className="reading-page page-width">
      <header className="page-heading">
        <span className="eyebrow">Coverage &amp; evidence</span>
        <h1>What we know. What we still need to learn.</h1>
        <p className="muted">A working prototype and a verified campus are different milestones. This record keeps them separate.</p>
      </header>
      <aside className="data-note"><strong>AccessPath Demo Campus.</strong> Illustrative demo data — not a verified real-world accessibility survey. Counts below describe the application’s graph and reporting workflow, not people helped or barriers found in the community.</aside>

      <section aria-labelledby="evidence-current">
        <h2 id="evidence-current">Inside the current prototype.</h2>
        <EvidenceDashboard />
      </section>

      <section aria-labelledby="evidence-needed">
        <h2 id="evidence-needed">Real evidence has to come from real people and places.</h2>
        <div className="table-scroll"><table>
          <caption>Community validation status</caption>
          <thead><tr><th scope="col">Evidence</th><th scope="col">Current status</th><th scope="col">Next step</th></tr></thead>
          <tbody>
            <tr><th scope="row">Real pathway survey</th><td><span className="status-badge">Not yet collected</span></td><td>Gather permitted observations, measurements, sources, and review dates.</td></tr>
            <tr><th scope="row">Community conversations</th><td><span className="status-badge">Not yet collected</span></td><td>Ask willing participants what route information is missing.</td></tr>
            <tr><th scope="row">Participant usability testing</th><td><span className="status-badge">Not yet conducted</span></td><td>Observe essential tasks with people using a range of access methods.</td></tr>
            <tr><th scope="row">Measured community impact</th><td><span className="status-badge">Not established</span></td><td>Define a small pilot evaluation before making outcome claims.</td></tr>
          </tbody>
        </table></div>
        <p>Palos Verdes Peninsula is a potential pilot context only. No school partnership or surveyed routes are claimed. Software tests check behavior on fixtures; they do not verify physical paths or replace participant feedback.</p>
      </section>

      <section aria-labelledby="evidence-process">
        <h2 id="evidence-process">A responsible path to a pilot.</h2>
        <ol>
          <li><strong>Listen.</strong> Invite voluntary conversations about routes and information needs without asking for diagnoses or private details.</li>
          <li><strong>Document.</strong> With site permission, record actual pathway attributes and leave missing details unknown.</li>
          <li><strong>Review.</strong> Check sources, connectivity, and freshness before labeling attributes verified.</li>
          <li><strong>Test and maintain.</strong> Evaluate the interface with participants, record limitations, and agree who keeps pathway conditions current.</li>
        </ol>
        <Link href="/report" className="button primary">Try a demo report <ArrowRight size={17} aria-hidden="true" /></Link>
        {' '}<Link href="/about" className="button secondary">Read the methodology</Link>
      </section>
    </main>
    <SiteFooter />
  </>;
}
