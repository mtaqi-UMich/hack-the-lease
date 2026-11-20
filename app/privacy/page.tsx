import type { Metadata } from 'next';
import { Page } from '@/components/ui';

export const metadata: Metadata = { title: 'Privacy — Hack the Lease' };

const H = ({ children }: { children: React.ReactNode }) => <h2 className="m-0 mt-2 text-[20px] font-bold tracking-[-0.02em]">{children}</h2>;

export default function Privacy() {
  return (
    <Page width={720}>
      <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Privacy</h1>
      <p className="m-0 text-[17px] leading-[1.55]" style={{ color: '#666' }}>Plain words, no surprises. Last updated November 20, 2026.</p>
      <div className="flex flex-col gap-3 rounded-[18px] bg-white p-6 text-[16px] leading-[1.6]" style={{ boxShadow: '0 0.5px 1px rgba(29,31,26,.06), 0 3px 10px rgba(29,31,26,.08)' }}>
        <H>The website</H>
        <p className="m-0">Your onboarding answers (your “priorities”) are kept in your own browser. We use them to rank Example listings each time you load a page; we don’t keep an account or a copy on our server.</p>

        <H>The browser extension</H>
        <p className="m-0"><b>What it reads.</b> Only the page you are on, and only after you click the Hack the Lease button (or the “Add to Hack the Lease” button on Zillow or Apartments.com, if you turned it on). It never opens pages, clicks, scrolls, or reads other tabs.</p>
        <p className="m-0"><b>What it keeps.</b> Facts about a listing — rent, bedrooms, fees, utilities, laundry, address, lease dates — plus the sentence each fact came from and the page address. No photos, no full descriptions. Everything is stored on your device (Chrome’s local extension storage). “Delete all my saved places” removes it; “Export JSON” gives you a copy.</p>
        <p className="m-0"><b>What leaves your device.</b></p>
        <ul className="m-0 flex flex-col gap-1 pl-6">
          <li>If the page doesn’t state the rent or bedrooms in a form we can read, the visible text of that page — with emails, phone numbers and links removed, and capped at about 12,000 characters — is sent to our <code>/api/listings/extract</code> route, which asks Claude (Anthropic) to pull out the facts. Our route does not log or store the text. Anthropic processes it under its commercial API terms.</li>
          <li>The listing’s street address is sent to OpenStreetMap Nominatim to find it on the map (for commute times). The result is cached on your device.</li>
          <li>When you open Compare on our site, your browser hands your saved places to our page so it can put them in a column. They are used for that one request and not stored.</li>
        </ul>
        <p className="m-0"><b>What we never do.</b> Places you save are private to you. They never enter our search, rankings, training data, or anything a landlord sees. Landlords are never an input to ranking. We don’t sell data, show ads, or track you across sites.</p>

        <H>Example data</H>
        <p className="m-0">Listings, landlords and student profiles on this site are Example (synthetic) data for a hackathon demo. Commute times are Estimated. Nothing here is legal advice.</p>

        <H>Contact</H>
        <p className="m-0">Questions or deletion requests: open an issue on the project’s GitHub repository.</p>
      </div>
    </Page>
  );
}
