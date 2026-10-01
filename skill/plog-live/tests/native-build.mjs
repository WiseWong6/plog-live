import assert from 'node:assert/strict';
import {mkdtemp,mkdir,cp,writeFile,readFile,readdir,utimes,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
const directory=await mkdtemp(join(tmpdir(),'plog-native-check-'));
const executable=async(path,contents)=>writeFile(path,contents,{mode:0o755});
try {
 const bin=join(directory,'fake-tools');await mkdir(bin);
 await executable(join(bin,'compiler'),`#!/bin/sh
while [ "$#" -gt 0 ]; do
 if [ "$1" = '-o' ]; then shift; output="$1"; break; fi
 shift
done
printf 'partial program' > "$output"
if [ "$PLOG_TEST_FAIL" = '1' ]; then exit 27; fi
printf '#!/bin/sh\nprintf "new-program\\n"\n' > "$output"
chmod +x "$output"
`);
 await executable(join(bin,'xcrun'),`#!/bin/sh
case "$1" in
 --find) printf '%s\n' "$PLOG_TEST_TOOLS/compiler" ;;
 --show-sdk-path) printf '/test-sdk\n' ;;
 swiftc) shift; exec "$PLOG_TEST_TOOLS/compiler" "$@" ;;
 *) exit 3 ;;
esac
`);
 await executable(join(bin,'sw_vers'),'#!/bin/sh\nprintf "26.0\\n"\n');
 await executable(join(bin,'codesign'),'#!/bin/sh\nexit 0\n');
 for(const [script,source,target] of [['live-grade.sh','LiveGrade.swift','live-grade'],['normalize-image.sh','NormalizeImage.swift','normalize-image'],['live-photo.sh','LivePhotoTool.swift','LivePhotoTool.app/Contents/MacOS/live-photo']]){
  const fixture=join(directory,script),native=join(fixture,'native'),program=join(native,'.build',target);
  await mkdir(join(fixture,'scripts'),{recursive:true});
  await mkdir(join(program,'..'),{recursive:true});
  await cp(new URL('../scripts/'+script,import.meta.url),join(fixture,'scripts',script));
  await writeFile(join(native,source),'// test source');
  await writeFile(join(native,'Info.plist'),'new-info');
  await executable(program,'#!/bin/sh\nprintf "old-program\\n"\n');
  await utimes(program,new Date(0),new Date(0));
  const info=join(native,'.build/LivePhotoTool.app/Contents/Info.plist');
  if(script==='live-photo.sh')await writeFile(info,'old-info');
  const old=await readFile(program);
  const env={...process.env,PATH:bin+':'+process.env.PATH,PLOG_TEST_TOOLS:bin,PLOG_NATIVE_DEVELOPER_DIR:fixture};
  const failed=spawnSync('bash',[join(fixture,'scripts',script),'--help'],{env:{...env,PLOG_TEST_FAIL:'1'},encoding:'utf8'});
  assert.equal(failed.status,27,failed.stderr);
  assert.deepEqual(await readFile(program),old,'失败后原程序必须保留');
  if(script==='live-photo.sh')assert.equal(await readFile(info,'utf8'),'old-info');
  assert(!(await readdir(join(native,'.build'))).some(name=>name.startsWith('compile.')));
  const passed=spawnSync('bash',[join(fixture,'scripts',script),'--help'],{env:{...env,PLOG_TEST_FAIL:'0'},encoding:'utf8'});
  assert.equal(passed.status,0,passed.stderr);
  assert.match(passed.stdout,/new-program/);
  assert(!(await readdir(join(native,'.build'))).some(name=>name.startsWith('compile.')));
 }
 console.log('通过：三个原生工具编译失败时保留旧程序，成功后替换，并清理临时目录（模拟编译器）。');
} finally {await rm(directory,{recursive:true,force:true});}
