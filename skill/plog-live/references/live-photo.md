# 原实况处理与封装

## 原件与格式

用户提供 JPG＋MOV 时，由代理核对和合成。选择原动态版后，以原配对标识核验两份资源，文件名和拍摄时间只作辅助；缺视频、标识或封面时刻时报告缺项，配对不符时停止该分支。

原实况保留原封面时刻，接受苹果封面标记值 -1 或 0，支持标记落在可变帧率的帧显示区间。单独视频使用提取封面时记录的时刻。

连续处理支持：

- 封面：标记为八位 sRGB 或 Display P3 的 JPEG、PNG。
- 视频：15 秒以内、边长最多 4096 像素、从零开始的一条画面轨道；SDR H.264/HEVC 八位 420。
- 音频：最多一条原声音轨。

不支持的编码、高动态范围或十位素材明确报错；需要转换图片时按[图片处理](photography.md)执行。

## 连续调色

使用准备阶段选定的文案，检查整段画面，在主体旁选择整段安全的文字位置，创建布局。以下坐标仅演示格式，须按本段素材重新选择：

```json
{
 "sourceSha256":"原封面真实SHA-256",
 "reviewedWholeClip":true,
 "captionLayout":{"x":0.08,"y":0.12,"fontFraction":0.022},
 "lightRegion":{"x":0.5,"y":0.6,"radius":0.35,"ev":0.12}
}
```

坐标从左上算。`lightRegion` 是固定受光区域，仅在整段都覆盖主体时填写；主体移动较大时省略。

```sh
node scripts/plog.mjs grade --job /任务目录 --grade-layout /调色布局.json
```

`native/LiveGrade.swift` 使用苹果 Core Image 与 AVFoundation，整段均匀采样后固定参数。封面和视频使用同一调色规则与英文位置，每帧保留原时间。标准亮度的 Display P3 输入转换为 sRGB 封面、Rec.709 视频，保持显示方向和有效画面范围；编码最多补齐一像素边缘。已调色输入直接沿用。

配对 MOV 复制原音轨；浏览器预览音频转为 AAC，`--sound mute` 移除音轨。原动态版的风格与衔接使用真实视频单独验收。

参考：[苹果有效画面范围](https://developer.apple.com/documentation/avfoundation/avassetimagegenerator/aperturemode-swift.property)、[Core Image](https://developer.apple.com/documentation/coreimage/ciimage)。

## 导入照片与用户隔空投送

配对资源为 `output/live-photo/plog.jpg` 与 `plog.mov`。`preview.mp4` 用于预览。封装与独立校验命令见[苹果处理工具](../native/README.md)。

用户明确要求导入后，执行：

```sh
./scripts/live-photo.sh import --photo "/任务/output/live-photo/plog.jpg" --video "/任务/output/live-photo/plog.mov"
```

程序核验文件、请求相册权限，将两份资源作为一张实况写入 Mac“照片”，再查询结果。仅 `photos_library.status = imported_live_photo` 表示已导入并核实；若已写入但未核实，先检查相册，避免重试造成重复。

提醒用户在 Mac“照片”选中完整实况 → 分享 → 隔空投送到 iPhone，再确认实况标识、长按播放、封面衔接与声音。保留 JPG、MOV 两份资源，分开发送不能保证自动合成。

参考：[苹果实况保存方式](https://developer.apple.com/documentation/avfoundation/capturing-and-saving-live-photos)、[Mac 隔空投送](https://support.apple.com/guide/mac-help/use-airdrop-to-send-items-to-nearby-apple-devices-mh35868/mac)、[分享实况与全部照片数据](https://support.apple.com/guide/iphone/share-photos-and-videos-iphf28f17237/ios)。
