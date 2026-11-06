/* About hero video: a seamless loop that fades to black and back between plays. Fades run on
   requestAnimationFrame (no CSS transitions), always start from the current opacity, and each
   new fade cancels the one before it. Under reduced motion the first frame simply stays. */
(() => {
  const video = document.querySelector('[data-hero-video]');
  if (!video) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const FADE = 500;
  const TAIL = 0.55;
  let frame = 0;
  let fadingOut = false;
  let started = false;

  function fade(to) {
    cancelAnimationFrame(frame);
    const from = parseFloat(video.style.opacity) || 0;
    const begin = performance.now();
    const step = now => {
      const t = Math.min(1, (now - begin) / FADE);
      video.style.opacity = String(from + (to - from) * t);
      frame = t < 1 ? requestAnimationFrame(step) : 0;
    };
    frame = requestAnimationFrame(step);
  }
  const play = () => video.play().catch(() => {});

  video.style.opacity = '0';
  if (reduce.matches) {
    video.removeAttribute('autoplay');
    video.pause();
    if (video.readyState >= 2) video.style.opacity = '1';
    else video.addEventListener('loadeddata', () => { video.style.opacity = '1'; }, {once: true});
    return;
  }

  function begin() {
    if (started) return;
    started = true;
    play();
    fade(1);
  }
  video.addEventListener('canplay', begin);
  // The video may already be playable by the time this deferred script runs.
  if (video.readyState >= 3) begin();
  // Start fading out just before the end, once per play.
  video.addEventListener('timeupdate', () => {
    if (fadingOut || !video.duration) return;
    if (video.duration - video.currentTime <= TAIL) {
      fadingOut = true;
      fade(0);
    }
  });
  video.addEventListener('ended', () => {
    cancelAnimationFrame(frame);
    video.style.opacity = '0';
    setTimeout(() => {
      video.currentTime = 0;
      fadingOut = false;
      play();
      fade(1);
    }, 100);
  });

  // Pause while the hero is scrolled away, so a long read stays light.
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      if (!started) return;
      if (entry.isIntersecting) play();
      else video.pause();
    }).observe(video);
  }
})();
