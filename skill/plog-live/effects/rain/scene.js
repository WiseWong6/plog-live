/* 固定照片 + 透明纸云 + 十四次错开落滴；所有状态只取决于配置与作品时间。 */
(function () {
  'use strict';

  const config = window.PLOG_CONFIG || {};
  const canvas = document.getElementById('scene');
  const context = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2;
  const dropPath = new Path2D('M 0 -.55 C -.08 -.34 -.39 .02 -.37 .27 C -.34 .58 .31 .59 .37 .29 C .43 .04 .08 -.33 0 -.55 Z');
  let photo;
  let cloudImage;
  let rimPath;
  let placement;
  let events = [];
  const imageLoads = new Map();
  const dropImages = new Map();

  const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
  const smooth = value => { const t = clamp(value, 0, 1); return t * t * (3 - 2 * t); };
  const wrap = seconds => ((seconds % config.duration) + config.duration) % config.duration;

  function finite(name, value, low, high) {
    if (!Number.isFinite(value) || value < low || value > high) throw new Error(name + ' 配置超出可用范围。');
  }

  function point(name, value) {
    if (!Array.isArray(value) || value.length !== 2) throw new Error(name + ' 需要两个归一化坐标。');
    finite(name + '横坐标', value[0], 0, 1);
    finite(name + '纵坐标', value[1], 0, 1);
  }

  function rectangle(name, rect) {
    if (!rect) throw new Error('缺少' + name + '。');
    for (const key of ['x', 'y']) finite(name + key, rect[key], 0, 1);
    for (const key of ['width', 'height']) finite(name + key, rect[key], 0.001, 1);
    if (rect.x + rect.width > 1 || rect.y + rect.height > 1) throw new Error(name + ' 越出了照片。');
  }

  function inLiquid(pointValue) {
    const ellipse = config.cup.liquidEllipse;
    const dx = (pointValue[0] - ellipse.cx) * config.width;
    const dy = (pointValue[1] - ellipse.cy) * config.height;
    const angle = ellipse.rotation || 0;
    const x = dx * Math.cos(angle) + dy * Math.sin(angle);
    const y = -dx * Math.sin(angle) + dy * Math.cos(angle);
    return (x / (ellipse.rx * config.width)) ** 2 + (y / (ellipse.ry * config.height)) ** 2 <= 1.000001;
  }

  function validate() {
    if (!context) throw new Error('浏览器暂不支持画布绘制。');
    for (const key of ['width', 'height']) {
      finite('画布' + key, config[key], 64, 4096);
      if (!Number.isInteger(config[key]) || config[key] % 2) throw new Error('导出画布宽高必须为偶数。');
    }
    if (config.effect !== 'cup-rain') throw new Error('此场景只实现杯上小云落雨。');
    if (![3,3.6,4,5].includes(config.duration) || config.fps !== 30) throw new Error('纸雨使用三秒至五秒完整周期、每秒三十帧。');
    finite('封面时间', config.keyTime, 0, config.duration - 1 / config.fps);
    if (Math.abs(config.keyTime * config.fps - Math.round(config.keyTime * config.fps)) > 1e-7) throw new Error('封面时间需要对齐完整帧。');
    if (typeof config.photo !== 'string' || !config.photo.trim()) throw new Error('缺少原照片路径。');
    if (!config.cloud || typeof config.cloud.asset !== 'string' || !config.cloud.asset.trim()) throw new Error('缺少透明纸云素材。');
    rectangle('纸云位置', config.cloud.rect);
    const sway = config.cloud.sway || {};
    finite('云横向摆幅', sway.x ?? 0.002, 0, 0.008);
    finite('云纵向摆幅', sway.y ?? 0.0015, 0, 0.008);
    finite('云转角摆幅', sway.angle ?? 0.015, 0, 0.06);
    finite('云透明度', config.cloud.opacity ?? 1, 0.5, 1);
    if (!config.cup || !config.cup.liquidEllipse) throw new Error('缺少真实杯口位置。');
    const ellipse = config.cup.liquidEllipse;
    finite('液面中心横坐标', ellipse.cx, 0, 1);
    finite('液面中心纵坐标', ellipse.cy, 0, 1);
    finite('液面横半径', ellipse.rx, 0.002, 0.3);
    finite('液面纵半径', ellipse.ry, 0.001, 0.2);
    finite('液面角度', ellipse.rotation || 0, -Math.PI, Math.PI);
    if (Array.isArray(config.cup.frontRimPath)) {
      if (config.cup.frontRimPath.length < 3) throw new Error('杯前沿遮挡至少需要三个点。');
      config.cup.frontRimPath.forEach((value, i) => point('杯前沿点' + i, value));
      rimPath = new Path2D();
      config.cup.frontRimPath.forEach(([x, y], index) => index ? rimPath.lineTo(x, y) : rimPath.moveTo(x, y));
      rimPath.closePath();
    } else if (typeof config.cup.frontRimPath === 'string' && config.cup.frontRimPath.trim()) {
      rimPath = new Path2D(config.cup.frontRimPath);
    } else throw new Error('缺少杯前沿遮挡路径。');
    if (config.safeTextRect) rectangle('原照片文字保护区', config.safeTextRect);
    if (!Array.isArray(config.drops) || config.drops.length < 12 || config.drops.length > 14) throw new Error('此样片需要十二至十四次错开落下的纸雨。');
    events = config.drops.map((drop, index) => {
      finite('落滴开始时间', drop.start, 0, config.duration - 0.001);
      finite('落滴时长', drop.duration, 0.4, 2.4);
      point('落滴起点', drop.from);
      point('落滴终点', drop.to);
      if (drop.to[1] <= drop.from[1]) throw new Error('雨滴终点必须在起点下方。');
      if (!inLiquid(drop.to)) throw new Error('雨滴终点必须位于真实液面内。');
      finite('雨滴宽度', drop.width, 0.001, 0.08);
      finite('雨滴高度', drop.height, 0.003, 0.1);
      finite('雨滴侧移', drop.drift ?? 0, -0.02, 0.02);
      finite('雨滴旋转', drop.angle ?? 0, -0.3, 0.3);
      if (drop.asset !== undefined) {
        if (typeof drop.asset !== 'string' || !drop.asset.trim()) throw new Error('纸雨素材路径不能为空。');
      } else if (!/^#[0-9a-f]{6}$/i.test(drop.color)) throw new Error('雨滴颜色需要六位十六进制色值。');
      if (drop.flipX !== undefined && typeof drop.flipX !== 'boolean') throw new Error('纸雨水平翻转需要布尔值。');
      const event = { ...drop, id: drop.id || 'drop-' + (index + 1), drift: drop.drift || 0, angle: drop.angle || 0, flipX: drop.flipX || false };
      event.origin = releasePoint(event);
      event.entryProgress = liquidEntryProgress(event);
      return event;
    });
    // 起止点将整圈切成占用数量恒定的区间，逐区间核对，避免采样漏掉短暂重叠。
    const boundaries = [...new Set([0, config.duration, ...events.flatMap(drop => [drop.start, wrap(drop.start + drop.duration)])])].sort((a, b) => a - b);
    for (let i = 1; i < boundaries.length; i += 1) {
      const time = (boundaries[i - 1] + boundaries[i]) / 2;
      if (events.filter(drop => wrap(time - drop.start) < drop.duration).length > 7) throw new Error('同时进行中的雨滴不能超过七滴。');
    }
  }

  function cloudAt(time) {
    const phase = wrap(time) / config.duration * TAU;
    const rect = config.cloud.rect;
    const sway = config.cloud.sway || {};
    return {
      x: rect.x + rect.width / 2 + (sway.x ?? 0.002) * Math.sin(phase),
      y: rect.y + rect.height / 2 + (sway.y ?? 0.0015) * Math.sin(phase + 0.7),
      width: rect.width,
      height: rect.height,
      angle: (sway.angle ?? 0.015) * Math.sin(phase + 0.2),
      opacity: config.cloud.opacity ?? 1
    };
  }

  function releasePoint(drop) {
    const cloud = cloudAt(drop.start);
    const rect = config.cloud.rect;
    const dx = (drop.from[0] - rect.x - rect.width / 2) * config.width;
    const dy = (drop.from[1] - rect.y - rect.height / 2) * config.height;
    return [cloud.x + (dx * Math.cos(cloud.angle) - dy * Math.sin(cloud.angle)) / config.width,
      cloud.y + (dx * Math.sin(cloud.angle) + dy * Math.cos(cloud.angle)) / config.height];
  }

  function dropPosition(drop, u) {
    const fall = clamp(u / 0.88, 0, 1);
    const travel = 0.65 * fall + 0.35 * fall * fall;
    return [drop.origin[0] + (drop.to[0] - drop.origin[0]) * travel + drop.drift * Math.sin(Math.PI * fall),
      drop.origin[1] + (drop.to[1] - drop.origin[1]) * travel];
  }

  function liquidEntryProgress(drop) {
    if (inLiquid(drop.origin)) throw new Error('纸云出滴点不能位于杯内。');
    let low = 0;
    let high = 1;
    // 找到首次进入液面的连续轨迹区间，之后只在液面范围内缩小消隐。
    for (let step = 1; step <= 100; step += 1) {
      if (inLiquid(dropPosition(drop, step / 100))) { low = (step - 1) / 100; high = step / 100; break; }
    }
    for (let step = 0; step < 28; step += 1) {
      const middle = (low + high) / 2;
      if (inLiquid(dropPosition(drop, middle))) high = middle;
      else low = middle;
    }
    if (high > 0.98) throw new Error('落滴终点太贴近液面边缘，无法在杯中平顺消隐。');
    for (let sample = 1; sample <= 100; sample += 1) {
      if (!inLiquid(dropPosition(drop, high + (1 - high) * sample / 100))) throw new Error('雨滴进入液面后又离开，请调整落点或侧移。');
    }
    return high;
  }

  function getState(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('动画时间必须是有限数字。');
    const time = wrap(seconds);
    const drops = events.flatMap(drop => {
      const age = wrap(time - drop.start);
      if (age >= drop.duration) return [];
      const u = age / drop.duration;
      // 轻微加速落下；消隐只发生在连续轨迹末端，没有重置位置的可见瞬间。
      const enter = smooth(u / 0.13);
      const sinkStart = Math.max(drop.entryProgress, 0.84);
      const sink = smooth((u - sinkStart) / (1 - sinkStart));
      const position = dropPosition(drop, u);
      return [{
        id: drop.id, u,
        x: position[0], y: position[1],
        width: drop.width * (1 - 0.64 * sink),
        height: drop.height * (1 - 0.64 * sink),
        angle: drop.angle + 0.055 * Math.sin(Math.PI * u),
        opacity: enter * (1 - sink),
        color: drop.color,
        asset: drop.asset,
        flipX: drop.flipX,
        enteringCup: u >= drop.entryProgress
      }];
    });
    return { time, cloud: cloudAt(time), drops };
  }

  function overlaps(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  function validateTextClearance() {
    if (!config.safeTextRect) return;
    for (let sample = 0; sample < 360; sample += 1) {
      const state = getState(sample * config.duration / 360);
      const cloud = state.cloud;
      const cloudWidth = (Math.abs(Math.cos(cloud.angle)) * cloud.width * config.width + Math.abs(Math.sin(cloud.angle)) * cloud.height * config.height) / config.width;
      const cloudHeight = (Math.abs(Math.sin(cloud.angle)) * cloud.width * config.width + Math.abs(Math.cos(cloud.angle)) * cloud.height * config.height) / config.height;
      if (overlaps({ x: cloud.x - cloudWidth / 2, y: cloud.y - cloudHeight / 2, width: cloudWidth, height: cloudHeight }, config.safeTextRect)) throw new Error('纸云会盖住原照片英文，请调整纸云位置。');
      for (const drop of state.drops) {
        // 扩大的包围盒包含纸滴转角，留出微小空隙，文字保护不依赖透明度。
        if (overlaps({ x: drop.x - drop.width, y: drop.y - drop.height, width: drop.width * 2, height: drop.height * 2 }, config.safeTextRect)) throw new Error('落雨路线经过原照片英文，请调整起点与杯口。');
      }
    }
  }

  function paintPhoto() {
    context.drawImage(photo, 0, 0, photo.naturalWidth, photo.naturalHeight, placement.x, placement.y, placement.width, placement.height);
  }

  function paintDrop(drop) {
    if (drop.opacity <= 0) return;
    context.save();
    context.translate(placement.x + drop.x * placement.width, placement.y + drop.y * placement.height);
    context.rotate(drop.angle);
    context.scale(drop.width * placement.width * (drop.flipX ? -1 : 1), drop.height * placement.height);
    context.globalAlpha = drop.opacity;
    if (drop.asset) {
      // 整张透明素材直接缩放，含原有留白；不裁切、不改色、不拉伸。
      context.drawImage(dropImages.get(drop.asset), -0.5, -0.5, 1, 1);
    } else {
      context.fillStyle = drop.color;
      context.fill(dropPath);
    }
    context.restore();
  }

  function renderAt(seconds) {
    if (api.status !== 'ready') throw new Error('照片或纸云尚未加载成功，不能渲染。');
    const state = getState(seconds);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.fillStyle = '#111515';
    context.fillRect(0, 0, canvas.width, canvas.height);
    paintPhoto();
    state.drops.forEach(paintDrop);
    // 起滴处由纸云自身遮挡，落滴与云共享同一处释放坐标。
    context.save();
    context.translate(placement.x + state.cloud.x * placement.width, placement.y + state.cloud.y * placement.height);
    context.rotate(state.cloud.angle);
    context.globalAlpha = state.cloud.opacity;
    context.drawImage(cloudImage, -state.cloud.width * placement.width / 2, -state.cloud.height * placement.height / 2, state.cloud.width * placement.width, state.cloud.height * placement.height);
    context.restore();
    // 从完整原照片恢复杯前沿；遮挡区外保持同一帧原图，绝不补画或重新调色。
    context.save();
    context.translate(placement.x, placement.y);
    context.scale(placement.width, placement.height);
    context.clip(rimPath);
    context.setTransform(1, 0, 0, 1, 0, 0);
    paintPhoto();
    context.restore();
    return canvas;
  }

  function loadImage(path, name) {
    if (imageLoads.has(path)) return imageLoads.get(path);
    const pending = new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async function () {
        try {
          if (typeof image.decode === 'function') await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error(name + '没有有效尺寸。');
          resolve(image);
        } catch (error) { reject(error); }
      };
      image.onerror = () => reject(new Error(name + '读取失败，请确认文件存在且可打开。'));
      image.src = path;
    });
    imageLoads.set(path, pending);
    return pending;
  }

  const api = window.PlogScene = {
    canvas, width: config.width, height: config.height,
    duration: config.duration, fps: config.fps, keyTime: config.keyTime,
    status: 'loading', error: null, renderAt, getState,
    photoRect: () => photo && { x: 0, y: 0, width: photo.naturalWidth, height: photo.naturalHeight, destination: { ...placement } },
    ready: null
  };
  api.ready = Promise.resolve().then(async function () {
    validate();
    validateTextClearance();
    const dropPaths = [...new Set(events.flatMap(drop => drop.asset ? [drop.asset] : []))];
    const images = await Promise.all([loadImage(config.photo, '照片'), loadImage(config.cloud.asset, '透明纸云'), ...dropPaths.map(path => loadImage(path, '透明纸雨'))]);
    [photo, cloudImage] = images;
    dropPaths.forEach((path, index) => dropImages.set(path, images[index + 2]));
    const scale = Math.min(config.width / photo.naturalWidth, config.height / photo.naturalHeight);
    placement = { x: (config.width - photo.naturalWidth * scale) / 2, y: (config.height - photo.naturalHeight * scale) / 2, width: photo.naturalWidth * scale, height: photo.naturalHeight * scale };
    if (placement.x * 2 >= 2 || placement.y * 2 >= 2) throw new Error('画布与原照片比例不同。只能补齐不足两像素的边界，不能裁切照片。');
    const displayedCloudRatio = config.cloud.rect.width * placement.width / (config.cloud.rect.height * placement.height);
    if (Math.abs(displayedCloudRatio / (cloudImage.naturalWidth / cloudImage.naturalHeight) - 1) > 0.015) throw new Error('纸云宽高不符合素材比例，请保持纸云原有形状。');
    for (const drop of events) {
      if (!drop.asset) continue;
      const image = dropImages.get(drop.asset);
      const displayedRatio = drop.width * placement.width / (drop.height * placement.height);
      if (Math.abs(displayedRatio / (image.naturalWidth / image.naturalHeight) - 1) > 0.015) throw new Error('纸雨宽高不符合素材比例，请保持纸雨原有形状。');
    }
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.aspectRatio = config.width + ' / ' + config.height;
    api.status = 'ready';
    renderAt(config.keyTime);
    return api;
  }).catch(function (error) {
    api.status = 'error';
    api.error = error.message;
    const notice = document.getElementById('scene-error');
    if (notice) { notice.textContent = error.message; notice.hidden = false; }
    console.error('PLOG 小云落雨加载失败：', error);
    throw error;
  });
  api.ready.catch(function () {});
}());
