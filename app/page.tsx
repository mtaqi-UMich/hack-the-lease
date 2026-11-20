import Link from 'next/link';
import { Page } from '@/components/ui';

export default function Home() {
  return (
    <Page>
      <section className="relative mx-auto flex max-w-[640px] flex-col items-center gap-5 pt-[72px] text-center">
        <span className="rounded-full px-3.5 py-1.5 text-[13px] font-semibold" style={{ background: '#EEEDFE', color: '#3F35E0' }}>Ann Arbor · for U-M students</span>
        <h1 className="m-0 text-[40px] font-bold leading-[1.05] tracking-[-0.035em] sm:text-[48px]">Find your place<br />in 5 taps.</h1>
        <p className="m-0 max-w-[460px] text-[17px] leading-[1.5]" style={{ color: '#666666' }}>The real monthly cost, the real commute, and what you might regret — before you sign.</p>
        <div className="mt-2 flex w-full max-w-[360px] flex-col gap-2.5">
          <Link href="/onboarding?fresh=1" className="flex h-[52px] items-center justify-center rounded-full text-[17px] font-semibold text-white no-underline" style={{ background: '#5046F5' }}>Get started</Link>
          <Link href="/bring" className="flex h-[52px] items-center justify-center rounded-full bg-white text-[17px] font-semibold no-underline" style={{ color: '#1D1F1A', boxShadow: '0 0.5px 1px rgba(29,31,26,.06), 0 3px 10px rgba(29,31,26,.08)' }}>I already found a listing</Link>
        </div>
        <div className="mt-6 flex flex-wrap justify-center gap-2 text-[13px]" style={{ color: '#666666' }}>
          <Link href="/landlord" className="underline">I’m a landlord</Link><span>·</span>
          <Link href="/evidence" className="underline">How we know it works</Link><span>·</span>
          <Link href="/analysis" className="underline">The math</Link>
        </div>
      </section>
    </Page>
  );
}
