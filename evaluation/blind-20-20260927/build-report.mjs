import {readFile, writeFile} from 'node:fs/promises';
import {dirname, resolve, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const here=dirname(fileURLToPath(import.meta.url));
const load=async name=>JSON.parse(await readFile(join(here,name),'utf8'));
const [manifest,technical,visual,integrity,gallery]=await Promise.all(['manifest.lock.json','technical-results.json','visual-results.json','input-integrity.json','gallery-check.json'].map(load));
for(const list of [manifest.samples,technical,visual,integrity]) assert.equal(list.length,20);
const accepted=visual.filter(v=>v.accepted);
for(const v of visual) {
  assert.equal(v.total,Object.values(v.scores).reduce((a,b)=>a+b,0));
  assert.equal(v.accepted,v.total>=6&&v.scores.subject===2);
}
assert.equal(accepted.length,7);
assert.ok(gallery.passed);
assert.ok(technical.every(t=>t.success&&t.apple.fullResult));
assert.ok(integrity.every(t=>t.identical));
const titles=['咖啡馆窗边顾客','火山湖前的三双鞋','户外咖啡与阅读','街边石榴果汁摊','马缨丹近景','人行道背影','人物放咖啡滤纸','鸡肉拌面','旅行山谷','街头同行者','黑白砖楼仰视','居家猫','苹果花','红条马克杯','咖啡馆窗景反射','老咖啡馆室内','球兰花簇','家中丁香花束','冰咖啡与莓果蛋糕','书页近景'];
const byId=new Map(visual.map(v=>[v.id,v]));
const rows=manifest.samples.map((s,i)=>{
  const v=byId.get(s.id);
  const scores=['subject','placement','material','relation'].map(k=>v.scores[k]).join(' / ');
  return `| [${titles[i]} · ${s.id}](index.html#${s.id}) | ${scores} | ${v.total}/8 | ${v.accepted?'可接受':'未通过'} | ${v.reason} | [${s.author}](${s.source_page}) |`;
}).join('\n');
const report=`# 二十张外部照片盲测报告

测试日期：2026-09-27。**20 张技术检查全部通过，7 张封面构图可接受（35%）。默认雨帘能够稳定导出，自动构图适配尚未达到稳定可用。**

[打开二十张原图与动效对照页](index.html)。先看作品，点击“揭晓结果”查看评分、来源和下载文件；切换照片会重新隐藏结果。页面离线运行，无需服务器。这个显示方式用于避免先看结论，不是防作弊的保密工具。

## 这轮实际测了什么

被测版本为纸片雨帘首版，冻结提交为 \`${manifest.codeCommit}\`。所有照片使用同一默认配置：3 秒、30 帧/秒、1.5 秒封面；云的位置、雨帘长度、颜色和运动不做逐张调整。只让现有程序适配照片宽高，没有替换失败作品或修改技能来改善分数。

两位独立选样代理先按题材寻找公开正文照片，再锁定文件并打乱匿名编号。清单包括 **5 张真实 PLOG、15 张摄影日记照片，来自 11 个作者或账号**；9 张竖版、7 张横版、4 张方形。题材有咖啡、餐食、花草、旅行、人物、宠物、室内与书页。没有使用图库或生成图，没有带入应用界面，也没有去水印或调色。少量原作者署名保留。取样是按题材的便利样本，部分照片出自同一作者，不能据此推算所有 PLOG 的通过率。

输入资格有预筛：多图拼贴、后加大段文案以及无法正常读取的候选被排除，未通过裁图或去字补救；火山湖照片曾因此改选正文中的下一张。这些取样限制已留在来源记录中。实体书页、摊位招牌等被拍摄物上的真实文字仍保留，因此本轮并非排除所有复杂输入，也不是完全无预筛。

通过标准在输出产生前写定：主体保护、位置与尺度、可读性与材质、场景关系各 0–2 分；**总分至少 6/8 且主体保护为 2 分**，才判为构图可接受。随后两位未参与选图、制作或调参的评审代理，各看十张匿名成片封面，不提供来源、技术结果和预期结论。它是**单盲 AI 封面构图评审**，不是人类用户实验；每张只有一位评分者，未做评分者间一致性检验。

这次是默认参数压力测试。技能文档中的人工判断留白、选择位置等步骤没有执行；因此不能把结果当作完整技能逐张定制后的最高质量。其他七类效果尚未实现，未参加本轮。

## 验证结果

| 检查 | 结果 | 含义 |
| --- | --- | --- |
| 源照片保持 | 20/20 | 下载文件与场景副本逐字节一致，没有编辑源照片 |
| 视频导出 | 20/20 | 每张 3 秒、90 帧、30 帧/秒、无音轨，编码尺寸及帧数符合配置 |
| 动作时间检查 | 20/20 | 首尾画面相同、往回跳时间结果一致、独立时间采样检测到运动 |
| 苹果实况资源 | 20/20 | JPG 与 MOV 标识配对、1.5 秒封面时间轨道有效，苹果系统返回完整实况照片对象 |
| 封面构图 | 7/20 | 35% 达到预先规定的构图标准，平均 5.35/8 分 |
| 离线对照页 | 20/20 | 原图和动效加载、编号切换、揭晓与重新隐藏、资源链接均通过功能检查；桌面及 390 像素窄屏无横向溢出 |

原照片文件保持不代表输出每个像素及尺寸不变：6 张照片的奇数边长在视频中取相邻偶数，增加了 1 像素；这是冻结程序已有的编码尺寸处理。封面及视频本来就加入了动效。

**尚未验收：完整动态美感、封面与压缩视频关键帧的人工内容比对、相册导入、iPhone 长按、社交平台上传播放。** 自动检查运动存在与时间一致性，不等于动作好看。离线页功能检查使用独立后台浏览器，没有截图，也没有操作用户已打开的浏览器。

原始视频导出报告中的 \`livePhotoPackaged: false\` 表示该渲染阶段尚未封装；最终实况状态以之后生成的 \`apple\` 记录和每组苹果验证文件为准。

## 逐张结果

所有下列样本的技术检查均通过。分数顺序：主体保护 / 位置与尺度 / 可读性与材质 / 场景关系。点击照片名打开对应匿名样本。

| 照片 | 四项分数 | 总分 | 构图结论 | 画面依据 | 原作者页面 |
| --- | --- | --- | --- | --- | --- |
${rows}

## 结果说明了什么

主体保护低于满分的有 **13 张**，其中人物眼鼻、花心、书页正文出现明显遮挡；位置与尺度低于满分的有 **11 张**，可读性与材质有 **13 张**，场景关系有 **9 张**。这些问题会同时出现在一张照片上，数量不能相加。所有未通过样本都触发了主体保护限制，即使总分达到 6 分或 7 分也没有放行。

通过样本中，红条马克杯、居家猫、咖啡馆窗景反射都为 8 分：云雨与主体之间有可利用的空间，主体完整，事件关系可以理解。山谷和人行道也有明确的落雨场景，不过亮背景上的细线仍偏弱。当前模板在“恰好留白合适”的照片上有机会成立；同一固定位置无法照顾不同主体。

建议下一轮先处理以下问题，**本轮只记录结论，没有实施修复**：

1. 先避开主体、人物面部和文字；没有安全区域时停止硬套，要求换构图或效果。书页和人物眼鼻遮挡应成为必须通过的检查。
2. 根据留白决定云的位置、大小及雨帘长度，而不是只按照片宽高缩放。
3. 根据背景亮暗调整细线和水滴的可读性，保留纸片材质，避免亮背景吞线。
4. 按场景选择幻想事件。单一雨帘不能覆盖所有 PLOG；食物、书页、人物等需要不同适用条件，再逐步实现其他效果。

修复后应另建测试轮次，并加新照片验证；本轮 20 张结果保持原样，避免将已经看过的样本当作新的盲测。

## 证据、保存与重建

- [预先约定](../../evaluation/blind-20-20260927/protocol.md)、[来源与冻结清单](../../evaluation/blind-20-20260927/manifest.lock.json)。清单保留全部源图地址、作者和文件指纹。
- [逐张技术结果](../../evaluation/blind-20-20260927/technical-results.json)、[原照片一致性检查](../../evaluation/blind-20-20260927/input-integrity.json)、[匿名视觉结果](../../evaluation/blind-20-20260927/visual-results.json)、[对照页功能检查](../../evaluation/blind-20-20260927/gallery-check.json)。
- 全部 20 组原图副本、可播放场景、封面、预览视频、实况 JPG/MOV 和日志保存在本目录 \`cases/\`，用于人工验收；来源原文件在项目 \`evaluation/blind-20-20260927/sources-a/\` 与 \`sources-b/\`。素材仅作本地测试，没有对外发布。
- 本轮评估资料约 4.5 MB、交付目录约 59 MB，保留至验收完成；没有遗留逐帧图片或运行中的临时浏览器。派生作品目录 \`cases/\` 保留在本机，通过本目录的忽略规则避免重复写入 Git 历史。测试脚本、冻结清单、原图与结果记录纳入本地版本管理。
- [评估目录说明](../../evaluation/blind-20-20260927/README.md)记录检查与重建方式。单独复制此对照页不足以搬走评估包，需要同时保留本轮 \`delivery/\` 与 \`evaluation/\` 下的对应目录及相对位置。
`;
await writeFile(resolve(here,'../../delivery/blind-20-20260927/report.md'),report);
console.log(JSON.stringify({report:'已生成',technicalPassed:technical.filter(t=>t.success).length,visualAccepted:accepted.length,mean:visual.reduce((n,v)=>n+v.total,0)/20}));
