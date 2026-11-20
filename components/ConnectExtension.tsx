'use client';
// "Connect the extension" card on /id: one click sends the scorecard to the Hack the Lease browser extension.
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { C, SHADOW } from './ui';
import { useApp } from '@/lib/store';
import { pingExtension, sendScorecard } from '@/lib/extension';

export function ConnectExtension() {
  const { profile, name } = useApp();
  const [state, setState] = useState<'checking' | 'missing' | 'ready' | 'connected'>('checking');
  const [saved, setSaved] = useState(0);
  useEffect(() => {
    let live = true;
    pingExtension().then(r => { if (!live) return; setState(!r ? 'missing' : r.connected ? 'connected' : 'ready'); setSaved(r?.saved ?? 0); });
    return () => { live = false; };
  }, []);
  async function connect() { const r = await sendScorecard(profile, name); setState(r?.ok ? 'connected' : 'missing'); }

  return (
    <div className="flex flex-col gap-2.5 rounded-[18px] bg-white p-5" style={{ boxShadow: SHADOW }}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[17px] font-semibold">Browser extension</span>
        {state === 'connected' && <span className="flex h-[26px] items-center rounded-full px-2.5 text-[13px] font-semibold" style={{ background: C.lime, color: C.forest }}>Connected ✓</span>}
      </div>
      <span className="text-[15px] leading-[1.45]" style={{ color: C.muted }}>
        Score any listing you’re looking at — Zillow, Apartments.com, a landlord’s site — against your priorities, in one click. It stays on your device.
        {state === 'connected' && saved ? ` ${saved} saved place${saved > 1 ? 's' : ''}.` : ''}
      </span>
      {state === 'missing' && <Link href="/extension" className="lift-sm flex h-11 items-center justify-center rounded-full text-[15px] font-semibold text-white no-underline" style={{ background: C.indigo }}>Get the extension</Link>}
      {(state === 'ready' || state === 'connected') && <button onClick={connect} className="lift-sm h-11 cursor-pointer rounded-full border-0 text-[15px] font-semibold" style={state === 'connected' ? { background: C.soft, color: C.ink } : { background: C.indigo, color: '#FFFFFF' }}>{state === 'connected' ? 'Send my latest priorities' : 'Connect the extension'}</button>}
      {state === 'checking' && <span className="h-11 animate-pulse rounded-full" style={{ background: C.soft }} />}
    </div>
  );
}
