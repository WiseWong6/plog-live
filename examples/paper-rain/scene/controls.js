(function () {
  'use strict';
  const scene = window.PlogScene;
  const config = window.PLOG_CONFIG;
  const controls = document.getElementById('play-controls');
  const toggle = document.getElementById('play-toggle');
  const progress = document.getElementById('play-progress');
  const replay = document.getElementById('play-replay');
  const speedButton = document.getElementById('play-speed');
  const timeLabel = document.getElementById('play-time');
  const speeds = [0.5, 1, 1.5, 2, 3];
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const touch = window.matchMedia('(hover: none)');
  let time = 0;
  let speed = 1;
  let playing = false;
  let dragging = false;
  let pointerSeeking = false;
  let keyboardSeeking = false;
  let resumeAfterSeek = false;
  let frame = 0;
  let lastTimestamp = null;
  let hideTimer = 0;
  let pointerNearby = false;
  let loaded = false;

  function displayTime(seconds, total) {
    const rounded = total ? Math.ceil(seconds - 0.000001) : Math.floor(seconds + 0.000001);
    return String(Math.floor(rounded / 60)).padStart(2, '0') + ':' + String(rounded % 60).padStart(2, '0');
  }

  function updateUI() {
    progress.value = String(time);
    progress.style.setProperty('--progress', (time / scene.duration * 100) + '%');
    progress.setAttribute('aria-valuetext', time.toFixed(2) + ' 秒，共 ' + scene.duration + ' 秒');
    toggle.textContent = playing ? '暂停' : '播放';
    toggle.setAttribute('aria-label', playing ? '暂停动画' : '播放动画');
    speedButton.textContent = speed + '×';
    speedButton.setAttribute('aria-label', '播放速度 ' + speed + ' 倍，点击切换');
    timeLabel.textContent = displayTime(time / speed, false) + ' / ' + displayTime(scene.duration / speed, true);
  }

  function stopClock() {
    if (frame) cancelAnimationFrame(frame);
    frame = 0;
    lastTimestamp = null;
  }

  function scheduleFrame() {
    if (loaded && playing && !dragging && !document.hidden && !frame && !window.PLOG_RENDER_MODE) {
      frame = requestAnimationFrame(animate);
    }
  }

  function animate(timestamp) {
    frame = 0;
    if (!playing || dragging || document.hidden) { lastTimestamp = null; return; }
    if (lastTimestamp !== null) time = (time + (timestamp - lastTimestamp) / 1000 * speed) % scene.duration;
    lastTimestamp = timestamp;
    scene.renderAt(time);
    updateUI();
    scheduleFrame();
  }

  function setPlaying(value) {
    playing = value;
    stopClock();
    updateUI();
    scheduleFrame();
  }

  function showControls() {
    window.clearTimeout(hideTimer);
    hideTimer = 0;
    controls.classList.remove('is-hidden');
  }

  function deferHide() {
    window.clearTimeout(hideTimer);
    if (touch.matches || pointerNearby || dragging || controls.contains(document.activeElement)) return;
    hideTimer = window.setTimeout(function () {
      if (!pointerNearby && !dragging && !controls.contains(document.activeElement)) controls.classList.add('is-hidden');
    }, 950);
  }

  function beginSeek() {
    if (dragging || !loaded) return;
    resumeAfterSeek = playing;
    dragging = true;
    stopClock();
    showControls();
  }

  function endSeek() {
    if (!dragging) return;
    dragging = false;
    pointerSeeking = false;
    keyboardSeeking = false;
    setPlaying(resumeAfterSeek);
    deferHide();
  }

  function isInteractive(target) {
    return target instanceof Element && Boolean(target.closest('button, input, select, textarea, a, [contenteditable="true"], [role="button"], [role="slider"]'));
  }

  scene.ready.then(function () {
    progress.max = String(scene.duration);
    loaded = true;
    if (window.PLOG_RENDER_MODE) {
      time = config.keyTime;
      updateUI();
      return;
    }
    controls.querySelectorAll('button, input').forEach(control => { control.disabled = false; });
    time = reducedMotion.matches ? config.keyTime : 0;
    scene.renderAt(time);
    setPlaying(config.autoplay !== false && !reducedMotion.matches);
    deferHide();
  }).catch(function () {
    loaded = false;
    playing = false;
    stopClock();
    showControls();
  });

  if (window.PLOG_RENDER_MODE) return;

  toggle.addEventListener('click', function () { setPlaying(!playing); });
  replay.addEventListener('click', function () {
    time = 0;
    scene.renderAt(time);
    setPlaying(true);
  });
  speedButton.addEventListener('click', function () {
    speed = speeds[(speeds.indexOf(speed) + 1) % speeds.length];
    // 倍速改变时重新记钟，避免把上一段耗时按新速度计算。
    stopClock();
    updateUI();
    scheduleFrame();
  });
  progress.addEventListener('pointerdown', function () {
    pointerSeeking = true;
    beginSeek();
  });
  progress.addEventListener('input', function () {
    beginSeek();
    time = Math.max(0, Math.min(scene.duration, Number(progress.value)));
    scene.renderAt(time);
    updateUI();
  });
  progress.addEventListener('change', function () {
    if (!pointerSeeking && !keyboardSeeking) endSeek();
  });
  window.addEventListener('pointerup', endSeek);
  window.addEventListener('pointercancel', endSeek);
  progress.addEventListener('keydown', function (event) {
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      keyboardSeeking = true;
      beginSeek();
    }
  });
  progress.addEventListener('keyup', function () { if (keyboardSeeking) endSeek(); });
  progress.addEventListener('blur', endSeek);
  document.addEventListener('keydown', function (event) {
    if (event.code !== 'Space' || event.repeat || event.altKey || event.ctrlKey || event.metaKey || isInteractive(event.target) || !loaded) return;
    event.preventDefault();
    setPlaying(!playing);
    showControls();
    deferHide();
  });
  document.addEventListener('visibilitychange', function () {
    stopClock();
    if (document.hidden) {
      if (dragging) endSeek();
    } else scheduleFrame();
  });
  window.addEventListener('pagehide', stopClock);
  window.addEventListener('pageshow', scheduleFrame);
  reducedMotion.addEventListener('change', function () {
    if (reducedMotion.matches && loaded) {
      resumeAfterSeek = false;
      setPlaying(false);
      showControls();
    }
  });
  document.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') { showControls(); return; }
    const bounds = controls.getBoundingClientRect();
    pointerNearby = event.clientX >= bounds.left - 32 && event.clientX <= bounds.right + 32 && event.clientY >= bounds.top - 38;
    if (pointerNearby) showControls();
    else if (!hideTimer) deferHide();
  });
  document.addEventListener('pointerleave', function () { pointerNearby = false; deferHide(); });
  controls.addEventListener('focusin', showControls);
  controls.addEventListener('focusout', function () { window.setTimeout(deferHide, 0); });
}());
