/* 完整照片固定；三至四颗长尾流星疏落地向右下掠过，完整经过照片并从边界离开。 */
(function () {
  'use strict';
  const config = window.PLOG_CONFIG || {};
  const canvas = document.getElementById('scene');
  const context = canvas.getContext('2d', { alpha: false });
  let photo;
  let placement;
  let events = [];
  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const wrap = seconds => ((seconds % config.duration) + config.duration) % config.duration;

  function finite(name, value, low, high) {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(name + ' 配置超出可用范围。');
  }
  function point(name, value) {
    if (!Array.isArray(value) || value.length !== 2) throw new Error(name + ' 需要两个归一化坐标。');
    finite(name + '横坐标', value[0], -.5, 1.5);
    finite(name + '纵坐标', value[1], -.5, 1.5);
  }
  function rectangle(rect, index) {
    if (!rect) throw new Error('缺少照片保护区。');
    for (const key of ['x', 'y']) finite('保护区' + index + key, rect[key], 0, 1);
    for (const key of ['width', 'height']) finite('保护区' + index + key, rect[key], .001, 1);
    if (rect.x + rect.width > 1 || rect.y + rect.height > 1) throw new Error('照片保护区越出了照片。');
  }
  function validate() {
    if (!context) throw new Error('浏览器暂不支持画布绘制。');
    for (const key of ['width', 'height']) {
      finite('画布' + key, config[key], 64, 4096);
      if (!Number.isInteger(config[key]) || config[key] % 2) throw new Error('导出画布宽高必须为偶数。');
    }
    if (config.effect !== 'meteor') throw new Error('此场景只实现流星划过。');
    if(!Number.isFinite(config.duration)||config.duration<2||config.duration>12||config.fps!==30||!Number.isFinite(config.keyTime)||config.keyTime<0||config.keyTime>=config.duration||Math.abs(config.duration*30-Math.round(config.duration*30))>1e-7||Math.abs(config.keyTime*30-Math.round(config.keyTime*30))>1e-7)throw new Error('时长须为2至12秒，封面对齐三十帧时间。');
    finite('封面时间', config.keyTime, 0, config.duration - 1 / config.fps);
    if (Math.abs(config.keyTime * config.fps - Math.round(config.keyTime * config.fps)) > 1e-7) throw new Error('封面时间需要对齐完整帧。');
    if (typeof config.photo !== 'string' || !config.photo.trim()) throw new Error('缺少原照片路径。');
    if (!Array.isArray(config.safeRects) || !config.safeRects.length) throw new Error('只标出文字和必要细节的保护区。');
    config.safeRects.forEach(rectangle);
    if (!Array.isArray(config.events) || config.events.length !== 5) throw new Error('需要五条错相轨迹，以保持画面三至四颗星头。');
    config.events.forEach((event, index) => {
      finite('流星相位', event.phase, 0, config.duration);
      if (event.phase >= config.duration) throw new Error('流星相位需要小于完整周期。');
      point('流星起点', event.from); point('流星终点', event.to);
      if (event.to[0]===event.from[0]&&event.to[1]===event.from[1])throw new Error('流星起终点不可相同。');
      finite('星头直径', event.headSize, .006, .065);
      finite('尾迹长度', event.tailLength, .025, .35);
      for (const key of ['color', 'tailColor']) if (!/^#[0-9a-f]{6}$/i.test(event[key])) throw new Error('流星颜色需要六位十六进制色值。');
      if (event.id !== undefined && (typeof event.id !== 'string' || !event.id.trim())) throw new Error('流星名称不能为空。');
    });
    if (new Set(config.events.map((event, index) => event.id || 'meteor-' + (index + 1))).size !== config.events.length) throw new Error('流星名称不能重复。');
  }

  function pointSegmentDistance(p, a, b) {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const u = clamp(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy), 0, 1);
    return Math.hypot(p[0] - a[0] - dx * u, p[1] - a[1] - dy * u);
  }
  function intersectsRectangle(a, b, rect) {
    // 线段与矩形的连续相交检查，不依赖帧率或抽样间隔。
    let low = 0, high = 1;
    for (const [axis, start, end] of [[0, rect.x, rect.x + rect.width], [1, rect.y, rect.y + rect.height]]) {
      const delta = b[axis] - a[axis];
      if (Math.abs(delta) < 1e-12) { if (a[axis] < start || a[axis] > end) return false; }
      else {
        const limits = [(start - a[axis]) / delta, (end - a[axis]) / delta].sort((x, y) => x - y);
        low = Math.max(low, limits[0]); high = Math.min(high, limits[1]);
        if (low > high) return false;
      }
    }
    return true;
  }
  function segmentRectangleDistance(a, b, rect) {
    if (intersectsRectangle(a, b, rect)) return 0;
    const corners = [[rect.x, rect.y], [rect.x + rect.width, rect.y], [rect.x + rect.width, rect.y + rect.height], [rect.x, rect.y + rect.height]];
    return Math.min(...corners.map(corner => pointSegmentDistance(corner, a, b)), ...[a, b].map(p => Math.hypot(p[0] - clamp(p[0], rect.x, rect.x + rect.width), p[1] - clamp(p[1], rect.y, rect.y + rect.height))));
  }

  function compileEvents() {
    events = config.events.map((event, index) => {
      const a = [event.from[0] * placement.width, event.from[1] * placement.height];
      const b = [event.to[0] * placement.width, event.to[1] * placement.height];
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const radius = event.headSize * placement.width / 2;
      if (length < radius * 5) throw new Error('流星轨迹太短，无法形成完整掠过。');
      const direction = [(b[0] - a[0]) / length, (b[1] - a[1]) / length];
      const tailPixels = event.tailLength * placement.width;
      const envelope = radius + 1;
      const tailAt = p => [p[0] - direction[0] * tailPixels, p[1] - direction[1] * tailPixels];
      const bounds = { x: 0, y: 0, width: placement.width, height: placement.height };
      // 重置的两端必须整颗在画外，包括固定长度尾迹和抗锯齿边缘。
      for (const p of [a, b]) if (segmentRectangleDistance(tailAt(p), p, bounds) <= envelope) throw new Error('循环重置前后，星头和整条尾迹必须完全在画外。');
      if (!intersectsRectangle(a, b, bounds)) throw new Error('流星路径必须穿过照片。');
      const extendedStart = tailAt(a);
      for (const rect of config.safeRects) {
        const pixelRect = { x: rect.x * placement.width, y: rect.y * placement.height, width: rect.width * placement.width, height: rect.height * placement.height };
        if (segmentRectangleDistance(extendedStart, b, pixelRect) <= envelope) throw new Error('流星或尾迹会碰到照片保护区' + (rect.label ? '「' + rect.label + '」' : '') + '，请调整整条路径。');
      }
      return { ...event, id: event.id || 'meteor-' + (index + 1), length, radius, direction, angle: Math.atan2(b[1] - a[1], b[0] - a[0]) };
    });
  }

  function getState(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('动画时间必须是有限数字。');
    const time = wrap(seconds);
    const meteors = events.map(event => {
      const u = wrap(time + event.phase) / config.duration;
      const x = event.from[0] + (event.to[0] - event.from[0]) * u;
      const y = event.from[1] + (event.to[1] - event.from[1]) * u;
      const tailPixels = event.tailLength * placement.width;
      const tailX = x - event.direction[0] * tailPixels / placement.width;
      const tailY = y - event.direction[1] * tailPixels / placement.height;
      const visible = segmentRectangleDistance([tailX * placement.width, tailY * placement.height], [x * placement.width, y * placement.height], { x: 0, y: 0, width: placement.width, height: placement.height }) <= event.radius + 1;
      const headVisible = Math.hypot((x - clamp(x, 0, 1)) * placement.width, (y - clamp(y, 0, 1)) * placement.height) <= event.radius;
      const headInFrame = x >= 0 && x <= 1 && y >= 0 && y <= 1;
      return {
        id: event.id, u, x, y, opacity: 1, angle: event.angle, visible, headVisible, headInFrame,
        headSize: event.headSize, tailLength: event.tailLength,
        tailX, tailY, color: event.color, tailColor: event.tailColor,
        starRotation: -.27
      };
    });
    return { time, meteors };
  }
  function rgba(hex, alpha) {
    return 'rgba(' + [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16)).join(',') + ',' + alpha + ')';
  }
  function paintMeteor(meteor) {
    if (meteor.opacity <= 0) return;
    const radius = meteor.headSize * placement.width / 2;
    const length = meteor.tailLength * placement.width;
    const gleam = .86 + .14 * Math.cos(Math.PI * 4 * meteor.u);
    context.save();
    context.translate(placement.x + meteor.x * placement.width, placement.y + meteor.y * placement.height);
    context.rotate(meteor.angle);
    context.globalAlpha = meteor.opacity;
    context.lineCap = 'round';
    // 三层细光丝共享同一条既定长尾，亮度向头部集中，不铺整块三角形。
    const layers = [
      { width: radius * .31, stops: [[0, 0], [.26, .015], [.7, .055], [1, .16]], warm: 'rgba(255,230,174,' },
      { width: radius * .12, stops: [[0, 0], [.22, .025], [.73, .20], [1, .58]], warm: 'rgba(255,247,220,' },
      { width: Math.max(.8, radius * .062), stops: [[0, 0], [.18, .035], [.72, .42], [1, .96]], warm: 'rgba(255,253,241,' }
    ];
    for (const layer of layers) {
      const trail = context.createLinearGradient(-length, 0, 0, 0);
      layer.stops.forEach(([at, alpha]) => trail.addColorStop(at, at < .7 ? rgba(meteor.tailColor, alpha) : layer.warm + alpha + ')'));
      context.strokeStyle = trail; context.lineWidth = layer.width;
      context.beginPath(); context.moveTo(-length, 0); context.lineTo(0, 0); context.stroke();
    }
    // 极细的两束边光只出现在靠近头部的尾段，仍在旧尾迹包围范围内。
    const filament = context.createLinearGradient(-length * .58, 0, 0, 0);
    filament.addColorStop(0, 'rgba(206,223,232,0)');
    filament.addColorStop(.65, 'rgba(224,238,236,.12)');
    filament.addColorStop(1, 'rgba(255,245,215,.35)');
    context.strokeStyle = filament; context.lineWidth = Math.max(.35, radius * .029);
    for (const side of [-1, 1]) {
      context.beginPath(); context.moveTo(-length * .58, side * radius * .075);
      context.quadraticCurveTo(-length * .15, side * radius * .12, -radius * .08, 0); context.stroke();
    }
    // 不使用会向保护区溢出的模糊阴影。径向渐变在原星头半径内结束。
    const haloRadius = radius * .88;
    const halo = context.createRadialGradient(0, 0, 0, 0, 0, haloRadius);
    halo.addColorStop(0, 'rgba(255,253,239,.77)');
    halo.addColorStop(.12, 'rgba(255,245,213,.51)');
    halo.addColorStop(.32, 'rgba(255,224,170,.16)');
    halo.addColorStop(.65, 'rgba(245,224,190,.035)');
    halo.addColorStop(1, 'rgba(245,224,190,0)');
    context.fillStyle = halo; context.beginPath(); context.arc(0, 0, haloRadius, 0, Math.PI * 2); context.fill();
    // 尖细星芒靠近亮核，长度小于原星头半径；不再保留纸片图标的大色块。
    for (const ray of [{angle:0, reach:radius*.63, halfWidth:radius*.04}, {angle:Math.PI/2, reach:radius*.44, halfWidth:radius*.035}]) {
      context.save(); context.rotate(ray.angle); context.globalAlpha = meteor.opacity * gleam;
      const shine = context.createLinearGradient(-ray.reach, 0, ray.reach, 0);
      shine.addColorStop(0, 'rgba(255,245,216,0)'); shine.addColorStop(.36, 'rgba(255,249,232,.44)');
      shine.addColorStop(.49, 'rgba(255,255,255,.94)'); shine.addColorStop(.51, 'rgba(255,255,255,.94)');
      shine.addColorStop(.64, 'rgba(255,249,232,.44)'); shine.addColorStop(1, 'rgba(255,245,216,0)');
      context.fillStyle = shine; context.beginPath(); context.moveTo(-ray.reach, 0);
      context.quadraticCurveTo(-radius*.09, -ray.halfWidth*.24, 0, -ray.halfWidth);
      context.quadraticCurveTo(radius*.09, -ray.halfWidth*.24, ray.reach, 0);
      context.quadraticCurveTo(radius*.09, ray.halfWidth*.24, 0, ray.halfWidth);
      context.quadraticCurveTo(-radius*.09, ray.halfWidth*.24, -ray.reach, 0); context.closePath(); context.fill(); context.restore();
    }
    // 恒亮暖白核心与更小的纯白点，星头始终可见，不用全物体透明度制造闪烁。
    const coreRadius = radius * .17;
    const core = context.createRadialGradient(-coreRadius*.2, -coreRadius*.2, 0, 0, 0, coreRadius);
    core.addColorStop(0, '#ffffff'); core.addColorStop(.38, '#fffefa'); core.addColorStop(.72, '#fff5d9'); core.addColorStop(1, 'rgba(255,235,191,.12)');
    context.fillStyle = core; context.beginPath(); context.arc(0, 0, coreRadius, 0, Math.PI*2); context.fill();
    context.fillStyle = '#ffffff'; context.beginPath(); context.arc(0, 0, radius*.055, 0, Math.PI*2); context.fill();
    context.restore();
  }
  function renderAt(seconds) {
    if (api.status !== 'ready') throw new Error('照片尚未加载成功，不能渲染。');
    const state = getState(seconds);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1; context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#111515'; context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, 0, 0, photo.naturalWidth, photo.naturalHeight, placement.x, placement.y, placement.width, placement.height);
    context.save();
    context.beginPath(); context.rect(placement.x, placement.y, placement.width, placement.height); context.clip();
    state.meteors.forEach(paintMeteor);
    context.restore();
    return canvas;
  }
  function loadImage(path) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async function () {
        try {
          if (typeof image.decode === 'function') await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('照片没有有效尺寸。');
          resolve(image);
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error('照片读取失败，请确认文件存在且可打开。'));
      image.src = path;
    });
  }
  const api = window.PlogScene = {
    canvas, width: config.width, height: config.height, duration: config.duration, fps: config.fps, keyTime: config.keyTime,
    status: 'loading', error: null, renderAt, getState,
    photoRect: () => photo && { x: 0, y: 0, width: photo.naturalWidth, height: photo.naturalHeight, destination: { ...placement } },
    ready: null
  };
  api.ready = Promise.resolve().then(async function () {
    validate();
    photo = await loadImage(config.photo);
    const scale = Math.min(config.width / photo.naturalWidth, config.height / photo.naturalHeight);
    placement = { x: (config.width - photo.naturalWidth * scale) / 2, y: (config.height - photo.naturalHeight * scale) / 2, width: photo.naturalWidth * scale, height: photo.naturalHeight * scale };
    if (placement.x * 2 >= 2 || placement.y * 2 >= 2) throw new Error('画布与原照片比例不同。只能补齐不足两像素的边界，不能裁切照片。');
    compileEvents();
    canvas.width = config.width; canvas.height = config.height;
    canvas.style.aspectRatio = config.width + ' / ' + config.height;
    api.status = 'ready'; renderAt(config.keyTime);
    return api;
  }).catch(function (error) {
    api.status = 'error'; api.error = error.message;
    const notice = document.getElementById('scene-error');
    if (notice) { notice.textContent = error.message; notice.hidden = false; }
    console.error('PLOG 流星划过加载失败：', error);
    throw error;
  });
  api.ready.catch(function () {});
}());
