/* 坐标相对于整张照片；保留原照片比例，修改位置时只移动幻想元素。 */
window.PLOG_CONFIG = {
  width: 1440,
  height: 1920,
  duration: 3,
  fps: 30,
  keyTime: 1.5,
  photo: 'photo.png',
  photoPosition: { x: 0.5, y: 0.5 },
  effect: 'paper-rain',
  cloud: { x: 0.515, y: 0.19, width: 0.30, color: '#284b82' },
  curtain: { length: 0.28, strings: 12, sway: 0.020 },
  palette: ['#91b3c1', '#bfd1d4', '#f0efdf', '#335d96', '#b87366'],
  seed: 2719,
  autoplay: true
};

// 由创建场景程序添加；原图原样复制，按需调整位置。
(function () {
  const overrides = {
  "width": 1440,
  "height": 1920,
  "duration": 3,
  "fps": 30,
  "keyTime": 1.5,
  "cloud": {
    "x": 0.515,
    "y": 0.19,
    "width": 0.3
  },
  "curtain": {
    "length": 0.28,
    "strings": 12,
    "sway": 0.02
  },
  "photo": "photo.png"
};
  const original = window.PLOG_CONFIG;
  window.PLOG_CONFIG = { ...original, ...overrides, cloud: { ...original.cloud, ...overrides.cloud }, curtain: { ...original.curtain, ...overrides.curtain }, photoPosition: { ...original.photoPosition, ...overrides.photoPosition } };
})();
