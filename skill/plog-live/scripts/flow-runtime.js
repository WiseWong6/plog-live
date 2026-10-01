/* 只在文字附近短暂淡出，不把主体或整条路线设成禁区。纯时间函数。 */
(function(){
 const clamp=x=>Math.max(0,Math.min(1,x)),smooth=x=>{x=clamp(x);return x*x*(3-2*x)};
 window.PlogFlow={
  alpha(p,c,aspect){
   if(c.captionProtection!=='local-fade')return 1;
   const r=p.envelope??p.radius??p.size??.02, ry=r*aspect;
   let a=1;
   for(const b of c.safeRects||[]){
    const dx=Math.max(b.x-p.x,0,p.x-b.x-b.width)-r;
    const dy=(Math.max(b.y-p.y,0,p.y-b.y-b.height)-ry)/aspect;
    a=Math.min(a,smooth(Math.max(dx,dy)/.018));
   }
   return a;
  },
  birth(u){return smooth(u/.09);},
  quadratic(a,b,c,u){const v=1-u;return [v*v*a[0]+2*v*u*b[0]+u*u*c[0],v*v*a[1]+2*v*u*b[1]+u*u*c[1]];}
 };
}());
