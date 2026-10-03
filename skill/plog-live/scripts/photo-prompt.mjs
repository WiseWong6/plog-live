import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {ROOT,readJSON,sha} from './lib.mjs';

export async function checkPhotoTemplate() {
 const template=await readFile(join(ROOT,'prompts/quiet-plog.md'),'utf8');
 const manifest=await readJSON(join(ROOT,'prompts/manifest.json'));
 if(sha(template)!==manifest.sha256||(template.match(/\{\{CAPTION\}\}/g)||[]).length!==1)throw Error('调色提示词与清单不一致');
 return {template,manifest};
}

export async function photoPrompt(caption) {
 const {template,manifest}=await checkPhotoTemplate();
 return {prompt:template.replace('{{CAPTION}}',caption),style:manifest.id,templateSha256:manifest.sha256};
}

export async function photoRequest(photo,caption,provider) {
 const style=await photoPrompt(caption);
 return {...style,host:provider.host,tool:provider.tool,promptFile:'prompt.txt',referenced_image_paths:[photo],transparent_background:false,requirements:'查看请求所指原图，使用所选图片编辑工具，原样提交 prompt.txt 的完整提示词和这一张原图。'};
}
