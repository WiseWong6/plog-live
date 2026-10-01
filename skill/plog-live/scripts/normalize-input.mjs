import {resolve,join} from 'node:path';
import {access} from 'node:fs/promises';
import {ROOT,readJSON,json,run,fileHash} from './lib.mjs';
import {fileURLToPath} from 'node:url';

export async function normalizeInput(directory,reason='输入图片格式不兼容') {
 const dir=resolve(directory),job=await readJSON(join(dir,'job.json'));
 if(job.kind!=='photo'||job.styled)throw Error('仅对尚未调色的照片输入执行格式兼容转换');
 const source=join(dir,job.input.photo),output=join(dir,'input/tool-input.png'),record=join(dir,'input/format-conversion.json');
 const originalHash=await fileHash(source);
 if(originalHash!==job.input.sha256)throw Error('原件校验不一致，不转换');
 let report;
 try { await access(record);report=await readJSON(record);if(report.sourceSha256!==originalHash||report.outputSha256!==await fileHash(output))throw Error('转换记录与文件不一致'); }
 catch(error){if(error.code!=='ENOENT')throw error;
  report=JSON.parse(run('bash',[join(ROOT,'scripts/normalize-image.sh'),source,output]));
  if(await fileHash(source)!==originalHash)throw Error('转换期间原件发生变化');
  report={...report,reason,sourceSha256:originalHash,outputSha256:await fileHash(output),createdAt:new Date().toISOString()};await json(record,report);
 }
 const request=await readJSON(join(dir,'image-tool-request.json'));
 request.referenced_image_paths[0]=output;
 request.formatConversion='input/format-conversion.json';
 await json(join(dir,'image-tool-request.json'),request);
 job.input.toolPhoto='input/tool-input.png';job.input.formatConversion='input/format-conversion.json';
 if(job.error){job.previousImageToolError=job.error;delete job.error;}
 job.status='awaiting_builtin_image_tool';await json(join(dir,'job.json'),job);
 return report;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try {if(!process.argv[2])throw Error('用法：node scripts/normalize-input.mjs /任务目录 [失败原因]');console.log(JSON.stringify(await normalizeInput(process.argv[2],process.argv[3]),null,2));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
