---
name: plog-live
description: 用户明确调用 plog-live 或选择 PLOG·日常奇遇时使用。为咖啡、食物与日常照片调色、添加英文小字和装饰动效，输出对比页与苹果实况照片。
---

# PLOG·日常奇遇

## 1. 建立任务

**默认用照片调色、加字，再生成装饰动效。** 接收照片、JPG＋MOV 或单独视频：配对资源使用照片，视频留存；单独视频提取中点封面。每次新建任务目录，保留输入原件。

准备任务前查看照片或视频中点封面，根据画面主体、状态和气氛逐图生成一句 2–5 词的自然英文，填入 `--caption`；留白较窄时选更短的句子。文案须贴合本图含义，不套固定句子或编造时间、地点与故事。用户指定文案时优先使用，无需逐句确认。已调色输入沿用已有文字，可省略文案参数。

命令在本技能目录执行，输入和输出填绝对路径。完整流程需要 Node.js 22 或更新版本、FFmpeg、Chrome、macOS 26 及 Apple 命令行开发工具；图片尺寸识别与实况封装从第一步起就使用苹果解码器（见 [README](README.md)）。运行环境缺项时先如实说明缺什么、不能继续哪一步，不假称完成，也不自动安装依赖。

```sh
node scripts/plog.mjs prepare --photo /原图.jpg --effect falling-stars --caption '<按本图语义生成的英文短句>' --out /任务目录
```

按用户要求调整参数：

| 情况 | 参数 |
| --- | --- |
| 默认照片装饰版 | `--motion-source photo --mode motion`，用 `--effect` 选择一个主要效果 |
| JPG＋MOV | 另加 `--video /原视频.mov --input-kind live` |
| 单独视频 | 用 `--video /原视频.mp4` 替代 `--photo` |
| 只要静态照片 | `--mode style` |
| 保留原拍摄动作 | `--motion-source original`；仅调色时再加 `--mode style` |
| 已完成调色 | `--already-styled true` |

原动态版使用新任务目录，按[原实况处理](references/live-photo.md)核验视频、配对与封面时刻。默认 `--sound original` 保留成片来源的原声：照片版静音，原动态版保留原声；用户要求全程静音时用 `--sound mute`。

## 2. 调色与英文

- **保持完整构图、原图比例和物件大小，不裁切、放大或添加镜头推进；编码只等比缩小。** 适度提高清晰度，让主体轮廓和原图已有的材质细节更清楚。
- 读取 [quiet-plog.md](prompts/quiet-plog.md)，使用准备阶段选定的文案；字体、字号及主体旁的文字位置按该提示词执行。
- 图片调色工具随宿主环境判定：Codex 内仅允许内置 `image_gen.imagegen`；其他环境默认按平台自带图片能力处理，先确认实际可用、支持输入照片编辑的工具，`prepare` 时加 `--image-host other --image-tool 实际工具名`，没有可用工具时如实说明。仅传待编辑原图，按 `image-tool-request.json` 调用。工具配置、格式转换与来源文件见[图片处理](references/photography.md)。

```sh
node scripts/plog.mjs grade --job /任务目录 --result /调色结果.png --provenance /来源.json
```

已调色输入直接执行 `grade --job /任务目录`。原动态版改用 `--grade-layout /调色布局.json`：整段采样后固定参数，以苹果原生程序处理封面和每一帧，英文位置固定。

## 3. 布置装饰

从 `effects/catalog.json` 选择效果，读取对应 `scene-config.js`。保留素材造型，按当前画面重新确定尺寸、密度、速度、路径和遮挡。装饰可以经过主体，只局部避让文字和人脸关键细节。

飘落元素先按当前照片摆路径，再用 `scripts/motion-layout.mjs` 的 `scatterFalling(config, sourceSha256)` 打散起始时间并保存完整配置；禁止按横坐标依次等间隔下落。鸟蝶必须按构图选择 `flightDirection`，可用同文件的 `redirectFlight(config, direction)` 转动完整飞行曲线，左右上下均可。同批照片逐张说明方向依据，不照搬同一方向与同一上沿队列。首帧、封面和中途的分布都要检查，不能只检查“会动”。

按[动线规范](references/motion-layout.md)设计，再按[布局格式](references/effects.md)生成 `/动效布局.json`。原动态使用全幅飘落、掠过等屏幕装饰；需要杯口、盘沿跟随的贴附效果暂不支持。

可选食物表情从 `faces/catalog.json` 选取，在 `grade` 加 `--face-layout /表情布局.json`；表情保持静态，布丁和芝士蛋糕用白色。食物香气按[香气制作](extensions/aroma/README.md)执行。

## 4. 导出与检查

```sh
node scripts/plog.mjs finish --job /任务目录 --layout /动效布局.json
```

仅调色模式省略 `--layout`。照片调色输出图片；动态输出封面、预览视频及 `output/live-photo/` 内的 JPG＋MOV 配对资源。

执行 `node scripts/plog.mjs verify` 检查文件完整性，按[验收清单](references/acceptance.md)核对 `output/receipt.json` 和成片。报错时保留原件并处理失败阶段，通过后交付 `output/index.html`。

## 5. 对比页与交付

复用 `scripts/delivery.mjs` 的 `comparisonGallery()`：**左原图、右成片，按完整比例并排显示，窄屏也保持左右布局。画面外仅留上一组、下一组两个箭头，单组隐藏箭头。** 不放标题、标签、说明、下载区或进度条。

动态预览静音循环；点击成片或按空格暂停，左右键切换。后台暂停，系统减少动态时初始暂停。页面离线直开，控件不进入成片。

回复提供对比页链接。动态交付时提醒：导入 Mac“照片”后，由用户在照片应用中分享完整实况，隔空投送到 iPhone。用户明确要求导入时执行[实况导入](references/live-photo.md#导入照片与用户隔空投送)；不自动投送或发布。

完成照片装饰版后询问一次：“是否另做保留原拍摄动作和原声的版本？”缺少原视频时说明需要补充；用户已指定原动态时直接制作。
