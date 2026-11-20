import cache from '@/data/extract-cache.json';

// GET → the Example listing text used by the cached "Bring any listing" demo (fictional).
export async function GET() {
  return new Response(cache.raw, { headers: { 'content-type': 'text/plain; charset=utf-8' } });
}
