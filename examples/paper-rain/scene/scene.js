/* 纯时间画面：同一配置、图片与时间始终得到同一帧，不读取播放状态。 */
(function () {
  'use strict';

  const config = window.PLOG_CONFIG || {};
  const canvas = document.getElementById('scene');
  const context = canvas.getContext('2d', { alpha: false });
  const TAU = Math.PI * 2;
  let photo = null;
  let cloudStamp = null;
  let paperTexture = null;
  let strings = [];
  let sourceRect = null;
  const cloudPath = new Path2D('M -496 66 C -514 24 -479 -43 -424 -52 C -404 -114 -352 -143 -292 -135 C -278 -202 -214 -228 -160 -192 C -110 -198 -64 -172 -44 -139 C 6 -165 64 -142 87 -96 C 142 -132 203 -121 234 -76 C 300 -99 360 -64 366 -15 C 424 -20 471 18 476 60 C 525 78 521 126 484 146 C 453 165 413 160 377 152 C 327 175 291 168 252 153 C 210 182 170 177 132 161 C 82 187 41 179 5 161 C -34 187 -85 179 -125 162 C -172 175 -217 153 -241 133 C -280 158 -324 150 -355 130 C -400 146 -454 151 -481 119 C -495 103 -500 84 -496 66 Z');
  const dropPath = new Path2D('M 0 -0.52 C -0.10 -0.21 -0.52 0.19 -0.43 0.38 C -0.35 0.60 0.26 0.61 0.41 0.36 C 0.55 0.14 0.11 -0.26 0 -0.52 Z');

  function seededRandom(seed) {
    let value = seed >>> 0;
    return function () {
      value += 0x6D2B79F5;
      let n = Math.imul(value ^ value >>> 15, 1 | value);
      n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
      return ((n ^ n >>> 14) >>> 0) / 4294967296;
    };
  }

  function finite(name, value, minimum, maximum) {
    if (!Number.isFinite(value) || value < minimum || value > maximum) {
      throw new Error(name + ' 配置超出可用范围。');
    }
  }

  function validate() {
    if (!context) throw new Error('浏览器暂不支持画布绘制。');
    finite('画布宽度', config.width, 64, 8192);
    finite('画布高度', config.height, 64, 8192);
    if (!Number.isInteger(config.width) || !Number.isInteger(config.height)) throw new Error('画布尺寸需为整数。');
    finite('时长', config.duration, 0.2, 30);
    finite('帧率', config.fps, 1, 120);
    finite('封面时间', config.keyTime, 0, config.duration);
    if (config.effect !== 'paper-rain') throw new Error('当前模板仅实现纸片雨帘。');
    if (!config.cloud || !config.curtain) throw new Error('缺少纸片云或雨帘配置。');
    finite('云横坐标', config.cloud.x, 0, 1);
    finite('云纵坐标', config.cloud.y, 0, 1);
    finite('云宽度', config.cloud.width, 0.04, 0.9);
    finite('雨帘长度', config.curtain.length, 0.03, 0.8);
    finite('雨线数量', config.curtain.strings, 3, 32);
    if (!Number.isInteger(config.curtain.strings)) throw new Error('雨线数量需为整数。');
    finite('摆幅', config.curtain.sway, 0, 0.12);
    if (!Array.isArray(config.palette) || config.palette.length < 5 || config.palette.some(color => !/^#[0-9a-f]{6}$/i.test(color))) throw new Error('请提供至少五种六位十六进制纸片颜色。');
    if (!/^#[0-9a-f]{6}$/i.test(config.cloud.color)) throw new Error('云颜色需为六位十六进制颜色。');
    if (!Number.isInteger(config.seed)) throw new Error('纹理种子需为整数。');
    if (typeof config.photo !== 'string' || !config.photo.trim()) throw new Error('缺少照片路径。');
    if (config.photoPosition) {
      finite('照片横向取景', config.photoPosition.x, 0, 1);
      finite('照片纵向取景', config.photoPosition.y, 0, 1);
    }
  }

  function createPaperTexture() {
    const texture = document.createElement('canvas');
    texture.width = 512;
    texture.height = 512;
    const tex = texture.getContext('2d');
    const random = seededRandom(config.seed ^ 0x1C89);
    tex.clearRect(0, 0, 512, 512);
    for (let index = 0; index < 6500; index += 1) {
      const light = random() > 0.48;
      tex.fillStyle = light ? 'rgba(255,255,240,.045)' : 'rgba(13,29,49,.045)';
      tex.fillRect(random() * 512, random() * 512, 0.5 + random() * 1.8, 0.5 + random() * 1.4);
    }
    for (let index = 0; index < 95; index += 1) {
      const x = random() * 512;
      const y = random() * 512;
      const radius = 8 + random() * 28;
      const spot = tex.createRadialGradient(x, y, 0, x, y, radius);
      spot.addColorStop(0, 'rgba(5,20,36,.035)');
      spot.addColorStop(1, 'rgba(5,20,36,0)');
      tex.fillStyle = spot;
      tex.fillRect(x - radius, y - radius, radius * 2, radius * 2);
    }
    return texture;
  }

  function createCloudStamp() {
    const stamp = document.createElement('canvas');
    stamp.width = 1120;
    stamp.height = 520;
    const paint = stamp.getContext('2d');
    paint.translate(560, 260);
    paint.fillStyle = config.cloud.color;
    paint.fill(cloudPath);
    paint.save();
    paint.clip(cloudPath);
    const glaze = paint.createLinearGradient(-200, -220, 200, 200);
    glaze.addColorStop(0, 'rgba(105,144,202,.12)');
    glaze.addColorStop(0.55, 'rgba(45,71,112,0)');
    glaze.addColorStop(1, 'rgba(0,15,49,.14)');
    paint.fillStyle = glaze;
    paint.fillRect(-560, -260, 1120, 520);
    paint.fillStyle = paint.createPattern(paperTexture, 'repeat');
    paint.fillRect(-560, -260, 1120, 520);
    paint.restore();
    paint.lineWidth = 1.7;
    paint.strokeStyle = 'rgba(168,188,212,.23)';
    paint.stroke(cloudPath);
    return stamp;
  }

  function buildStrings() {
    const random = seededRandom(config.seed);
    const count = config.curtain.strings;
    const width = config.cloud.width * config.width;
    return Array.from({ length: count }, (_, index) => {
      const ratio = count === 1 ? 0.5 : index / (count - 1);
      const length = config.curtain.length * config.height * (0.76 + random() * 0.24);
      const dropCount = 3 + (index % 3 === 1 ? 1 : 0);
      const drops = Array.from({ length: dropCount }, (unused, dropIndex) => {
        const colorSample = random();
        const colorIndex = colorSample < 0.40 ? 0 : colorSample < 0.59 ? 1 : colorSample < 0.80 ? 2 : colorSample < 0.95 ? 3 : 4;
        return {
          u: dropIndex === dropCount - 1 ? 1 : (dropIndex + 0.58 + random() * 0.23) / dropCount,
          width: width * (0.023 + random() * 0.014),
          height: width * (0.085 + random() * 0.04),
          color: config.palette[colorIndex],
          phase: random() * TAU,
          flip: 0.65 + random() * 0.72,
          textureX: random() * 250,
          textureY: random() * 250
        };
      });
      return {
        index,
        x: (ratio - 0.5) * width * 0.80 + (random() - 0.5) * width * 0.01,
        y: width * (0.09 + 0.028 * Math.sin(ratio * Math.PI)),
        length,
        phase: ratio * 0.82 + random() * 0.25,
        amplitude: 0.8 + random() * 0.3,
        drops
      };
    });
  }

  function wrappedTime(seconds) {
    if (!Number.isFinite(seconds)) throw new TypeError('动画时间必须是有限数字。');
    return ((seconds % config.duration) + config.duration) % config.duration;
  }

  function pointOnString(string, u, phase) {
    const lag = phase - string.phase - u * 0.96;
    const amplitude = config.curtain.sway * config.width * string.amplitude;
    return {
      x: string.x + amplitude * u * u * (Math.sin(lag) + 0.16 * Math.sin(lag * 2 + string.phase)),
      y: string.y + string.length * u - amplitude * 0.13 * u * u * (1 - Math.cos(lag))
    };
  }

  function getState(seconds) {
    const time = wrappedTime(seconds);
    const phase = time / config.duration * TAU;
    const unit = config.width / 1440;
    const cloud = {
      x: config.cloud.x * config.width + 3.8 * unit * Math.sin(phase),
      y: config.cloud.y * config.height + 2.5 * unit * Math.sin(phase + 0.7),
      angle: 0.021 * Math.sin(phase + 0.2),
      width: config.cloud.width * config.width
    };
    const stringStates = strings.map(string => ({
      index: string.index,
      points: Array.from({ length: 25 }, (_, sample) => pointOnString(string, sample / 24, phase)),
      drops: string.drops.map(drop => {
        const point = pointOnString(string, drop.u, phase);
        const above = pointOnString(string, Math.max(0, drop.u - 0.015), phase);
        const yaw = drop.flip * Math.sin(phase - drop.u * 0.95 + drop.phase) + 0.12 * Math.sin(phase * 2 + drop.phase);
        return {
          ...drop,
          x: point.x,
          y: point.y,
          angle: -Math.atan2(point.x - above.x, point.y - above.y) + 0.045 * Math.sin(phase + drop.phase),
          scaleX: Math.max(0.13, Math.abs(Math.cos(yaw))),
          light: 0.5 + 0.5 * Math.sin(yaw)
        };
      })
    }));
    return { time, cloud, strings: stringStates };
  }

  function paintDrop(drop) {
    context.save();
    context.translate(drop.x, drop.y);
    context.rotate(drop.angle);
    context.scale(drop.width * drop.scaleX, drop.height);
    context.shadowColor = 'rgba(1,12,21,.23)';
    context.shadowBlur = 1.6 * config.width / 1440;
    context.shadowOffsetX = 1.0 * config.width / 1440;
    context.shadowOffsetY = 1.4 * config.width / 1440;
    context.fillStyle = drop.color;
    context.fill(dropPath);
    context.shadowColor = 'transparent';
    context.save();
    context.clip(dropPath);
    context.fillStyle = 'rgba(255,255,241,' + (0.025 + drop.light * 0.06) + ')';
    context.fillRect(-0.5, -0.55, 0.5, 1.2);
    context.scale(1 / (drop.width * drop.scaleX), 1 / drop.height);
    context.globalAlpha = 0.8;
    context.drawImage(paperTexture, drop.textureX, drop.textureY, 80, 100, -drop.width, -drop.height, drop.width * 2, drop.height * 2);
    context.restore();
    context.restore();
  }

  function renderAt(seconds) {
    if (api.status !== 'ready') throw new Error('照片尚未加载成功，不能渲染成品。');
    const state = getState(seconds);
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.globalAlpha = 1;
    context.globalCompositeOperation = 'source-over';
    context.shadowColor = 'transparent';
    context.clearRect(0, 0, canvas.width, canvas.height);
    context.drawImage(photo, sourceRect.x, sourceRect.y, sourceRect.width, sourceRect.height, 0, 0, canvas.width, canvas.height);
    context.save();
    context.translate(state.cloud.x, state.cloud.y);
    context.rotate(state.cloud.angle);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.lineWidth = Math.max(0.75, config.width / 1440 * 1.1);
    context.strokeStyle = 'rgba(187,184,162,.66)';
    context.shadowColor = 'rgba(0,8,15,.22)';
    context.shadowBlur = 1.2 * config.width / 1440;
    context.shadowOffsetX = 0.9 * config.width / 1440;
    context.shadowOffsetY = 1.1 * config.width / 1440;
    state.strings.forEach(string => {
      context.beginPath();
      string.points.forEach((point, index) => {
        if (index === 0) context.moveTo(point.x, point.y);
        else context.lineTo(point.x, point.y);
      });
      context.stroke();
    });
    context.shadowColor = 'transparent';
    state.strings.forEach(string => string.drops.forEach(paintDrop));
    const scale = state.cloud.width / 1000;
    context.shadowColor = 'rgba(0,8,20,.28)';
    context.shadowBlur = 5.0 * config.width / 1440;
    context.shadowOffsetX = 1.7 * config.width / 1440;
    context.shadowOffsetY = 3.4 * config.width / 1440;
    context.drawImage(cloudStamp, -560 * scale, -260 * scale, 1120 * scale, 520 * scale);
    context.restore();
    return canvas;
  }

  function loadPhoto() {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = async function () {
        try {
          if (typeof image.decode === 'function') await image.decode();
          if (!image.naturalWidth || !image.naturalHeight) throw new Error('照片没有有效尺寸。');
          resolve(image);
        } catch (error) { reject(error); }
      };
      image.onerror = function () { reject(new Error('照片读取失败，请确认同目录的照片文件存在且能够打开。')); };
      image.src = config.photo;
    });
  }

  const api = window.PlogScene = {
    canvas,
    width: config.width,
    height: config.height,
    duration: config.duration,
    fps: config.fps,
    keyTime: config.keyTime,
    status: 'loading',
    error: null,
    renderAt,
    getState,
    photoRect: () => sourceRect && { ...sourceRect },
    ready: null
  };
  api.ready = Promise.resolve().then(async function () {
    validate();
    canvas.width = config.width;
    canvas.height = config.height;
    canvas.style.aspectRatio = config.width + ' / ' + config.height;
    paperTexture = createPaperTexture();
    cloudStamp = createCloudStamp();
    strings = buildStrings();
    photo = await loadPhoto();
    const zoom = Math.max(config.width / photo.naturalWidth, config.height / photo.naturalHeight);
    const width = config.width / zoom;
    const height = config.height / zoom;
    const position = config.photoPosition || { x: 0.5, y: 0.5 };
    sourceRect = { x: (photo.naturalWidth - width) * position.x, y: (photo.naturalHeight - height) * position.y, width, height };
    api.status = 'ready';
    renderAt(config.keyTime);
    return api;
  }).catch(function (error) {
    api.status = 'error';
    api.error = error.message;
    const notice = document.getElementById('scene-error');
    if (notice) { notice.textContent = error.message; notice.hidden = false; }
    console.error('PLOG 画面加载失败：', error);
    throw error;
  });
  // 无播放控件的导出环境也可读取原始拒绝状态，不产生未处理的拒绝。
  api.ready.catch(function () {});
}());
