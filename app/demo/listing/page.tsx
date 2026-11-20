// Demo page for the "Bring any listing" live demo: a realistic rental listing on a FICTIONAL listing site.
// Open it, press Cmd/Ctrl + A, copy, and paste into /bring — or use the screenshot of it (/demo/listing-screenshot.png).
// Every fact here is Example data. The contact details are fake and get redacted by the reader.
import type { Metadata } from 'next';

export const metadata: Metadata = { title: '418 Detroit St · 3 bed flat in Kerrytown — TreeTown Listings (Example)', robots: { index: false } };

const ink = '#1B1D21', muted = '#5F6368', line = '#E4E1DA', brand = '#0F5F4C';
const FACTS: [string, string][] = [['Rent', '$2,850 / mo'], ['Bedrooms', '3'], ['Bathrooms', '2'], ['Size', '1,150 sq ft'], ['Available', 'Aug 15, 2027'], ['Lease', '12 months']];
const AMENITIES = ['Washer and dryer in unit', 'Central air', 'Dishwasher', 'One off-street parking spot', 'Cats welcome', 'Hardwood floors', 'Bike storage'];

export default function DemoListing() {
  return (
    <div style={{ background: '#FFFFFF', color: ink, minHeight: '100vh', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif' }}>
      <header style={{ borderBottom: `1px solid ${line}` }}>
        <div className="mx-auto flex max-w-[1040px] items-center justify-between gap-4 px-5 py-3.5">
          <span className="text-[20px] font-bold tracking-[-0.02em]" style={{ color: brand }}>TreeTown Listings</span>
          <nav className="hidden gap-5 text-[14px] font-medium sm:flex" style={{ color: muted }}><span>Apartments</span><span>Houses</span><span>Sublets</span><span>For landlords</span></nav>
        </div>
      </header>

      <main className="mx-auto flex max-w-[1040px] flex-col gap-6 px-5 py-6">
        <div className="text-[13px]" style={{ color: muted }}>Ann Arbor, MI › Kerrytown › 418 Detroit St</div>

        <div className="grid gap-2" style={{ gridTemplateColumns: '2fr 1fr', gridTemplateRows: '170px 170px' }}>
          <img src="/photos/ext-10.jpg" alt="Front of the house" className="row-span-2 h-full w-full rounded-l-[12px] object-cover" />
          <img src="/photos/living-3.jpg" alt="Living room" className="h-full w-full rounded-tr-[12px] object-cover" />
          <img src="/photos/kitchen-4.jpg" alt="Kitchen" className="h-full w-full rounded-br-[12px] object-cover" />
        </div>

        <div className="flex flex-wrap gap-8">
          <div className="flex min-w-0 flex-[1_1_520px] flex-col gap-5">
            <div className="flex flex-col gap-1">
              <h1 className="m-0 text-[28px] font-bold tracking-[-0.02em]">Bright 3 bedroom flat in Kerrytown</h1>
              <p className="m-0 text-[16px]" style={{ color: muted }}>418 Detroit St, Ann Arbor, MI 48104</p>
            </div>
            <p className="m-0 text-[30px] font-bold">$2,850<span className="text-[16px] font-medium" style={{ color: muted }}> / month</span></p>

            <div className="grid grid-cols-3 gap-px overflow-hidden rounded-[12px]" style={{ background: line, border: `1px solid ${line}` }}>
              {FACTS.map(([k, v]) => <div key={k} className="flex flex-col gap-0.5 bg-white px-4 py-3"><span className="text-[12px] uppercase tracking-[0.04em]" style={{ color: muted }}>{k}</span><span className="text-[16px] font-semibold">{v}</span></div>)}
            </div>

            <section className="flex flex-col gap-2.5 text-[16px] leading-[1.55]">
              <h2 className="m-0 text-[19px] font-bold">About this place</h2>
              <p className="m-0">Bright 3 bedroom, 2 bathroom upper flat in a quiet Victorian house, two blocks from the Kerrytown Market and a 12-minute walk to the Diag.</p>
              <p className="m-0">Rent is $2,850 per month for the whole apartment, shared however your group likes.</p>
              <p className="m-0">Heat, water and trash are included; tenants pay electric and internet.</p>
              <p className="m-0">Required amenity fee of $35 per month covers snow removal and the shared bike room.</p>
              <p className="m-0">Washer and dryer in the unit.</p>
              <p className="m-0">One off-street parking spot is included with the lease.</p>
              <p className="m-0">Cats welcome, sorry no dogs.</p>
              <p className="m-0">Central air conditioning and new windows keep it cool in summer.</p>
              <p className="m-0">The flat is 1,150 sq ft with hardwood floors throughout.</p>
              <p className="m-0">Available August 15, 2027 on a 12-month lease.</p>
              <p className="m-0">Security deposit is $2,850.</p>
              <p className="m-0">Application fee is $40, refunded if you are not offered the unit.</p>
            </section>

            <section className="flex flex-col gap-2">
              <h2 className="m-0 text-[19px] font-bold">Amenities</h2>
              <ul className="m-0 grid grid-cols-2 gap-x-6 gap-y-1.5 pl-5 text-[15px]">{AMENITIES.map(a => <li key={a}>{a}</li>)}</ul>
            </section>
          </div>

          <aside className="flex h-fit flex-[0_1_300px] flex-col gap-3 rounded-[14px] p-5" style={{ border: `1px solid ${line}` }}>
            <span className="text-[17px] font-bold">Kerry Lane Homes</span>
            <span className="text-[14px]" style={{ color: muted }}>Listed 3 days ago · Responds within a day</span>
            <span className="text-[14px]">Call (734) 555-0142 or email leasing@kerrylane.example.test to book a tour.</span>
            <span className="flex h-11 items-center justify-center rounded-full text-[15px] font-semibold text-white" style={{ background: brand }}>Request a tour</span>
          </aside>
        </div>

        <footer className="border-t pt-4 text-[12px]" style={{ borderColor: line, color: muted }}>
          TreeTown Listings is a made-up site for the Hack the Lease demo. This is an Example listing, not a real place for rent.
        </footer>
      </main>
    </div>
  );
}
