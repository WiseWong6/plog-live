import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ROOT,readJSON,sha} from './lib.mjs';

export async function photoPrompt(caption) {
 const template=await readFile(join(ROOT,'prompts/quiet-plog.md'),'utf8');
 const manifest=await readJSON(join(ROOT,'prompts/manifest.json'));
 if(sha(template)!==manifest.sha256||(template.match(/\{\{CAPTION\}\}/g)||[]).length!==1)throw Error('调色提示词与清单不一致');
 return {prompt:template.replace('{{CAPTION}}',caption),style:manifest.id,templateSha256:manifest.sha256};
}

export async function photoRequest(photo,caption,provider) {
 const style=await photoPrompt(caption);
 return {...style,host:provider.host,tool:provider.tool,promptFile:'prompt.txt',referenced_image_paths:[photo],transparent_background:false,requirements:'只传待编辑原图，不附风格参考。查看原图后使用所选图片编辑工具；仅替换模板中的英文；保持完整构图，不以本地调色代替生图。'};
}
