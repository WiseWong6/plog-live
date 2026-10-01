import {readFile,writeFile} from 'node:fs/promises';
import {resolve,join,extname} from 'node:path';
import {ROOT,readJSON,fileHash,dimensions} from './lib.mjs';
import {startChrome} from './chrome-render.mjs';
export async function renderFaces(photo,layout,out){const spec=await readJSON(layout),catalog=await readJSON(join(ROOT,'faces/catalog.json')),d=dimensions(photo);
 if(spec.sourceSha256!==await fileHash(photo)||!spec.reviewedForSource||!spec.faces?.length)throw Error('食物表情需要针对当前照片定位');
 const body=spec.faces.map(f=>{const a=catalog.find(x=>x.id===f.expression);if(!a||![f.x,f.y,f.size].every(Number.isFinite)||f.x<0||f.x>1||f.y<0||f.y>1||f.size<.01||f.size>.2||f.x-f.size/2<0||f.x+f.size/2>1||f.y-f.size*d.width/d.height*.375<0||f.y+f.size*d.width/d.height*.375>1)throw Error('表情位置/大小无效');return`<g transform="translate(${f.x*d.width} ${f.y*d.height}) scale(${f.size*d.width/128})">${a.svg}</g>`}).join('');
 const svg=`<svg xmlns="http://www.w3.org/2000/svg" width="${d.width}" height="${d.height}">${body}</svg>`,mime=({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp'})[extname(photo).toLowerCase()]||'application/octet-stream',src='data:'+mime+';base64,'+(await readFile(photo)).toString('base64');
 const b=await startChrome();try{const result=await b.evaluate(`(async()=>{const img=new Image(),deco=new Image();img.src=${JSON.stringify(src)};deco.src=${JSON.stringify('data:image/svg+xml;base64,'+Buffer.from(svg).toString('base64'))};await Promise.all([img.decode(),deco.decode()]);const c=document.createElement('canvas');c.width=${d.width};c.height=${d.height};const x=c.getContext('2d');x.drawImage(img,0,0,c.width,c.height);x.drawImage(deco,0,0);return c.toDataURL('image/png')})()`);await writeFile(out,Buffer.from(result.split(',')[1],'base64'),{flag:'wx'});}finally{await b.close()}
 return{static:true,expressions:spec.faces,sourceSha256:spec.sourceSha256,photoColorUnchanged:true};
}
