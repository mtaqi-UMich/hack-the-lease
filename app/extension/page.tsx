import type { Metadata } from 'next';
import Link from 'next/link';
import { Page } from '@/components/ui';

export const metadata: Metadata = { title: 'Get the extension — Hack the Lease' };

const card = { boxShadow: '0 0.5px 1px rgba(29,31,26,.06), 0 3px 10px rgba(29,31,26,.08)' };

export default function ExtensionPage() {
  return (
    <Page width={720}>
      <h1 className="m-0 text-[34px] font-bold tracking-[-0.03em]">Hack the Lease for Chrome</h1>
      <p className="m-0 text-[17px] leading-[1.55]" style={{ color: '#666' }}>Looking at a place on Zillow, Apartments.com or a landlord’s site? Click once and see its true monthly cost, commute and must-haves against your priorities — then put it next to your top picks.</p>
      <div className="flex flex-col gap-3 rounded-[18px] bg-white p-6 text-[16px] leading-[1.6]" style={card}>
        <span className="text-[17px] font-semibold">Install (developer preview)</span>
        <p className="m-0" style={{ color: '#666' }}>The Chrome Web Store version is in review. Until then, load it yourself:</p>
        <ol className="m-0 flex flex-col gap-1.5 pl-6">
          <li>Get the code: <code>git clone</code> the repository, then run <code>npm install</code> and <code>npm run ext:build</code>.</li>
          <li>Open <code>chrome://extensions</code> and turn on <b>Developer mode</b> (top right).</li>
          <li>Click <b>Load unpacked</b> and choose the <code>extension/dist</code> folder.</li>
          <li>Pin Hack the Lease to the toolbar, then come back to <Link href="/id">your housing ID</Link> and click <b>Connect the extension</b>.</li>
        </ol>
      </div>
      <div className="flex flex-col gap-2 rounded-[18px] bg-white p-6 text-[16px] leading-[1.6]" style={card}>
        <span className="text-[17px] font-semibold">What it can and can’t see</span>
        <p className="m-0">It reads only the page you’re on, only when you click. Saved places stay on your device. <Link href="/privacy">Read the privacy page</Link>.</p>
      </div>
    </Page>
  );
}
