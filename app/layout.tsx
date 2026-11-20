import './globals.css';
import type { Metadata, Viewport } from 'next';

export const metadata: Metadata = {
  title: 'Hack the Lease',
  description: 'A student-first rental marketplace for Ann Arbor. All listings shown are Example (synthetic) data.',
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-bg text-ink">{children}</body>
    </html>
  );
}
