// Optional floating pill on Zillow / Apartments.com (only if the student turned it on and granted those sites).
// It does nothing until clicked; clicking opens the side panel, which then reads this one page.
(() => {
  if (document.getElementById('htl-pill')) return;
  const b = document.createElement('button');
  b.id = 'htl-pill'; b.type = 'button'; b.textContent = '+ Add to Hack the Lease';
  Object.assign(b.style, {
    position: 'fixed', right: '20px', bottom: '20px', zIndex: '2147483647', height: '44px', padding: '0 18px', border: '0', borderRadius: '999px',
    background: '#5046F5', color: '#fff', font: '600 15px -apple-system,BlinkMacSystemFont,Helvetica,Arial,sans-serif', cursor: 'pointer',
    boxShadow: '0 1px 2px rgba(29,31,26,.2), 0 10px 24px -8px rgba(80,70,245,.55)', transition: 'transform 420ms cubic-bezier(.2,.8,.2,1)',
  } as CSSStyleDeclaration);
  b.addEventListener('mouseenter', () => { b.style.transform = 'translateY(-3px)'; });
  b.addEventListener('mouseleave', () => { b.style.transform = ''; });
  b.addEventListener('click', () => chrome.runtime.sendMessage({ type: 'OPEN_PANEL' }));
  document.documentElement.appendChild(b);
})();
