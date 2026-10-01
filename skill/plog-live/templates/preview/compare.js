(() => {
  const items = window.PLOG_COMPARISONS;
  const before = document.querySelector('#before');
  const photo = document.querySelector('#after-photo');
  const video = document.querySelector('#after-video');
  const nav = document.querySelector('nav');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let index = 0, wantsPlay = !reduced.matches;

  nav.hidden = items.length < 2;
  document.body.classList.toggle('single', items.length < 2);

  function play() {
    if (!video.hidden && wantsPlay && !document.hidden && video.readyState >= 2) {
      video.play().catch(() => {});
    }
  }

  function select(next, updateHash = true) {
    index = (next + items.length) % items.length;
    const item = items[index];
    video.pause();
    video.removeAttribute('src');
    video.load();
    before.src = item.before;
    wantsPlay = !reduced.matches;
    const moving = item.type === 'video';
    video.hidden = !moving;
    photo.hidden = moving;
    if (moving) {
      video.poster = item.poster || '';
      video.src = item.after;
      video.muted = true;
      video.load();
      play();
    } else {
      photo.src = item.after;
    }
    if (updateHash && items.length > 1) {
      const hash = '#' + encodeURIComponent(item.id);
      try { history.replaceState(null, '', hash); }
      catch { if (location.hash !== hash) location.hash = hash; }
    }
  }

  function fromHash() {
    let id;
    try { id = decodeURIComponent(location.hash.slice(1)); } catch {}
    const selected = items.findIndex(item => item.id === id);
    select(selected < 0 ? 0 : selected, false);
  }

  function togglePlay() {
    if (video.hidden) return;
    wantsPlay = !wantsPlay;
    if (wantsPlay) play(); else video.pause();
  }

  document.querySelector('#previous').onclick = () => select(index - 1);
  document.querySelector('#next').onclick = () => select(index + 1);
  video.addEventListener('loadeddata', play);
  video.addEventListener('click', togglePlay);
  video.addEventListener('error', () => {
    if (video.getAttribute('src')) console.warn('成片未能加载：', video.getAttribute('src'));
  });
  document.addEventListener('visibilitychange', () => document.hidden ? video.pause() : play());
  addEventListener('pagehide', () => video.pause());
  addEventListener('hashchange', fromHash);
  addEventListener('keydown', event => {
    if (event.altKey || event.ctrlKey || event.metaKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName)) return;
    if (event.key === 'ArrowLeft' && items.length > 1) { event.preventDefault(); select(index - 1); }
    if (event.key === 'ArrowRight' && items.length > 1) { event.preventDefault(); select(index + 1); }
    if (event.code === 'Space' && document.activeElement.tagName !== 'BUTTON') { event.preventDefault(); togglePlay(); }
  });
  reduced.addEventListener('change', () => { wantsPlay = !reduced.matches; if (wantsPlay) play(); else video.pause(); });
  fromHash();
})();
