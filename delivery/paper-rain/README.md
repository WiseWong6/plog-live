# 咖啡上的纸片雨帘

一张真实摄影质感的咖啡馆场景，杯子上方悬着深蓝纸云与轻摆的纸片雨帘。底图由 Codex 内置图片工具生成，未使用参考截图中的界面、字幕或文字作为画面内容。

## 查看

- [离线动效预览](../../examples/paper-rain/scene/index.html)：直接打开，无需服务器。可以暂停、拖动、重播、切换倍速。
- [三秒普通视频](preview.mp4)：用于观看效果，不是实况照片资产。
- [静态封面](cover.png)：对应动画 1.5 秒。
- [实况照片静图](live-photo/plog-paper-rain.jpg) 与 [配对短片](live-photo/plog-paper-rain.mov)：这两份文件必须配对处理，不能只把短片改名当作实况照片。

样片为 1440×1920，3 秒，每秒 30 帧，无音轨。原照片保持静止，只有纸云与串雨运动。页面操作控件不进入成片。

## 已完成的检查

[渲染报告](render-report.json)记录画面首尾一致、回拖一致、存在运动、90 帧、尺寸与无音轨检查。[苹果资源报告](live-photo/plog-paper-rain.validation.json)记录图片与短片配对标识相同，1.5 秒关键照片标记精确对齐视频帧，以及苹果系统返回完整、非占位的实况照片对象。

本轮未写入照片库，未进行 iPhone 长按和社交平台上传验收，也未代替用户做浏览器界面或观感验收。渲染报告中的 `livePhotoPackaged: false` 描述视频导出当时的状态；后续封装结果以苹果资源报告为准。

## 在苹果设备验收

先在上方离线预览中检查纸片质感、动作幅度与杯子的关系；拖动一次进度、暂停、重播并切换一次倍速。

需要加入自己的 Mac「照片」时，在终端主动执行以下命令。它会先检查资源，随后申请相册权限并新建一张资产；重复执行会重复添加。本轮没有执行这条命令，真实相册权限与写入结果尚未测试。

```sh
"/Users/wisewong/Documents/Developer/scenes/未完成/plog-live/skill/plog-live/scripts/live-photo.sh" import \
  --photo "/Users/wisewong/Documents/Developer/scenes/未完成/plog-live/delivery/paper-rain/live-photo/plog-paper-rain.jpg" \
  --video "/Users/wisewong/Documents/Developer/scenes/未完成/plog-live/delivery/paper-rain/live-photo/plog-paper-rain.mov"
```

如果已经启用 iCloud 照片，可等待这张资产同步到 iPhone；也可以从 Mac「照片」分享完整资产。到 iPhone 的实况照片分类确认只有一张资产，长按检查能否播放，封面、方向与动作是否正确。目标社交平台是否保留动态需要单独测试。

## 保留与清理

这些文件与源照片、可编辑场景保留至验收完成。检查使用的临时场景与小视频已经删除；逐帧渲染不落地，没有留下图片序列。原生工具保留可运行应用包，体积较大的临时编译模块缓存会在本轮结束前清理。技能后续重新编译时可自行重建缓存。
