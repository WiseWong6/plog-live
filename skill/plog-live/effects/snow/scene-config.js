window.PLOG_CONFIG = {
  effect: 'snow', width: 1086, height: 1448, duration: 3, fps: 30, keyTime: 1.5,
  photo: 'assets/photo.png', autoplay: true,
  safeRects: [{x:.695,y:.408,width:.155,height:.026,label:'英文小字'}],
  // 重新绘出酥皮与手部原像素；雪落到顶沿以后由真实食物挡住。
  foregroundPath: 'M .249 .516 C .276 .451 .337 .417 .452 .421 C .580 .416 .655 .453 .683 .518 L .704 .595 L .679 .647 L .632 .668 L .543 .668 L .515 .733 L .446 .904 L .376 1 L 0 1 L .099 .794 L .164 .663 Z',
  flakes: [
    {id:'snow-1',phase:0,from:[.322,-.025],to:[.355,.535],radius:.012,drift:.008,opacity:.77,depth:'near',rotation:.2},
    {id:'snow-2',phase:.375,from:[.426,-.03],to:[.473,.53],radius:.007,drift:.014,opacity:.44,depth:'far',rotation:1.3},
    {id:'snow-3',phase:.75,from:[.537,-.027],to:[.562,.535],radius:.010,drift:-.010,opacity:.68,depth:'near',rotation:2.0},
    {id:'snow-4',phase:1.125,from:[.369,-.03],to:[.403,.53],radius:.009,drift:.012,opacity:.53,depth:'far',rotation:.5},
    {id:'snow-5',phase:1.5,from:[.577,-.027],to:[.593,.535],radius:.013,drift:-.011,opacity:.81,depth:'near',rotation:1.8},
    {id:'snow-6',phase:1.875,from:[.473,-.03],to:[.514,.53],radius:.006,drift:.015,opacity:.46,depth:'far',rotation:.8},
    {id:'snow-7',phase:2.25,from:[.316,-.028],to:[.372,.535],radius:.009,drift:.010,opacity:.64,depth:'near',rotation:2.5},
    {id:'snow-8',phase:2.625,from:[.506,-.025],to:[.539,.53],radius:.008,drift:-.012,opacity:.56,depth:'far',rotation:1.1}
  ]
};
