/* Article list backdrop: plays only while it is on screen, holds its first frame under reduced
   motion, and dims as the list scrolls over it. */
(() => {
  const backdrop = document.querySelector('[data-list-backdrop]');
  if (!backdrop) return;
  const video = backdrop.querySelector('video');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  let visible = true;

  const play = () => { const playing = video.play(); if (playing) playing.catch(() => {}); };
  function sync() {
    if (!video) return;
    if (reduce.matches || !visible) video.pause();
    else play();
  }
  if (video && 'IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => { visible = entry.isIntersecting; sync(); }).observe(backdrop);
  }
  reduce.addEventListener?.('change', sync);
  sync();

  let queued = false;
  const dim = () => {
    queued = false;
    backdrop.style.setProperty('--list-fade', (1 - 0.6 * Math.min(1, scrollY / innerHeight)).toFixed(3));
  };
  addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(dim); } }, {passive: true});
  dim();
})();
