# 苹果实况照片封装工具

把一张封面和一段已完成的短片封装为配对的 JPEG、MOV，并检查苹果系统能否解码为完整实况照片。工具不制作动效、不改变构图；`pack`、`verify` 均不读取或写入用户相册。

需要 macOS 26 或更新版本，以及已有的 Apple 命令行开发工具 26 或更新版本。使用 ImageIO、AVFoundation 和 PhotoKit，不依赖第三方转换服务。编译脚本优先使用独立命令行开发工具，不改变系统的 Xcode 选择，不接受许可证或安装依赖。可用 `PLOG_NATIVE_DEVELOPER_DIR` 指定另一套已安装的开发工具。

## 使用

从技能目录运行；路径含空格时保留引号。

```sh
./scripts/live-photo.sh pack \
  --photo "/绝对路径/cover.png" \
  --video "/绝对路径/motion.mp4" \
  --output "/绝对路径/delivery" \
  --name "plog-cloud" \
  --key-time 1.5

./scripts/live-photo.sh verify \
  --photo "/绝对路径/delivery/plog-cloud.jpg" \
  --video "/绝对路径/delivery/plog-cloud.mov"
```

`pack` 输出 `plog-cloud.jpg`、`plog-cloud.mov`、`plog-cloud.validation.json`。已有同名文件时拒绝覆盖。视频画面与音频直接复制编码数据；不二次压缩视频。封面用 ImageIO 写入高质量 JPEG 及配对标识，保留可写入的源图片元数据。

输入要求：单张可解码的封面；恰好一条画面轨道；时间从零开始；不少于两帧；封面与视频显示比例一致。建议输入 H.264 视频。关键照片时间必须处于视频内，默认对齐最近实际帧。处理原实况时使用 `--preserve-key-time true` 保留原标记，原标记可位于实际视频帧的显示区间内，不要求等于帧起始时刻；使用实际帧时长检查，兼容原实况的可变帧率；报告同时记录请求时间和实际时间。封面应由同一次渲染的这个时刻导出。

`verify` 会读出图片配对标识、MOV 配对标识、带时间位置的关键照片标记、实际视频帧时间，并请求完整的 `PHLivePhoto` 解码结果。仅静态占位结果不算成功；30 秒没有完整结果会报告超时并取消请求。

## 只有明确执行导入命令才写相册

```sh
./scripts/live-photo.sh import \
  --photo "/绝对路径/delivery/plog-cloud.jpg" \
  --video "/绝对路径/delivery/plog-cloud.mov"
```

脚本先把所选的两份文件复制到系统临时目录，再通过本地应用包发起相册权限请求。应用只读取这对副本，无需额外访问整个“文稿”目录。只有文件检查与系统解码均通过后，才请求读写权限；读权限用于确认新资产具有实况照片类型。两份资源会在同一个相册创建操作里添加。导入完成后报告相册资产标识和识别结果；报告中的资源路径是临时副本，程序结束后清理；重复运行会重复添加，不自动覆盖或删除相册内容。

拒绝权限时不会导入。若系统完成写入后无法查询新资产，报告会明确写为“已导入但未核实”；此时先检查相册，再决定是否重试。工具从不自动打开同步功能、发送隔空投送或发布到社交平台。

## 如何读检查结果

| 字段 | 通过意味着什么 |
| --- | --- |
| `file_pair.status` | 图片和视频标识一致，关键照片时间轨道有效且位于实际帧显示区间，比例一致 |
| `system_decode.status` | 苹果系统返回了完整、非静态占位的实况照片对象 |
| `photos_library.status` | 只有显式导入后，才可能是 `imported_live_photo`；`pack` 和 `verify` 始终为 `not_imported` |
| `iphone_playback.status` | 本机工具无法代替 iPhone 验收，始终为 `not_tested` |
| `platform_upload.status` | 本机工具没有验收社交平台上传，始终为 `not_tested` |

`success: true` 仅表示本条命令范围内的检查通过。退出码 `0` 表示通过，`2` 表示参数、输入、权限或运行错误，`3` 表示生成/解码/导入识别未通过。`pack` 解码不通过时仍保留生成文件和检查报告，方便定位问题；它不会冒称已得到经过真机验收的实况照片。`--result-json <路径>` 是应用包装器使用的结果输出参数。

人工最终验收：沿用已启用的 iCloud 照片同步，或在 Mac“照片”中共享完整资产到 iPhone；在 iPhone“实况照片”分类中确认只有一张资产，长按能播放；检查封面和短片的衔接、方向与画面观感。封面内容是否和关键帧一致由制作流程保证并人工复核，当前文件检查不做像素相似度评分。平台上传后是否保留动态要在目标平台另行验收；相册播放成功不代表可用作动态锁屏。

## 文件与清理

三个原生工具均先在 `native/.build/compile.*` 临时目录中编译，成功后才替换正式程序；编译失败保留已有程序，成功或失败都清理本次临时目录。

编译产物在 `native/.build/LivePhotoTool.app`，Swift 模块缓存也在 `native/.build/`，均不进入 Git。需要时可以删除整个 `native/.build/`，下一次调用会重新编译。封装中间目录 `.plog-live-<随机标识>` 位于指定输出目录，命令结束时自动清除；显式导入的临时结果文件位于系统临时目录，脚本结束时自动清除。交付目录里的配对文件和检查报告不自动删除。

## 依据与实现边界

- 苹果 [PHLivePhoto 加载接口](https://developer.apple.com/documentation/photos/phlivephoto/request(withresourcefileurls:placeholderimage:targetsize:contentmode:resulthandler:)) 会校验资源及其元数据；官方描述主要面向既有实况照片导出的资源，合成资产仍以当前系统和真机验证为准。
- 苹果 [相册创建接口](https://developer.apple.com/documentation/photos/phassetcreationrequest) 使用同一个请求添加图片与 [配对视频](https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo)。
- 标识及关键照片时间轨道参考 [LimitPoint 一手实现](https://github.com/LimitPoint/LivePhoto)，本工具独立使用本机 SDK 的新异步读写接口，没有复制其旧适配器代码。
- 苹果 [iCloud 照片说明](https://support.apple.com/en-us/108782) 明确支持实况照片及原始格式同步。


## 原实况连续调色

`LiveGrade.swift` 通过 `../scripts/live-grade.sh` 编译运行，由统一入口调用。整段采样后固定曝光、曲线、暖色及可选受光区域；保存原视频每帧时刻，封面与视频使用同一规则和英文位置。输出原声由统一流程复制，明确静音时移除。此程序处理原实况与单独视频；照片调色使用主技能指定的图片工具。

格式限制、原件检查和布局见 `../references/live-photo.md`。

交付入口与隔空投送提醒遵循 `../references/live-photo.md` 的“导入照片与用户隔空投送”。默认照片装饰版与可选原动态版使用相同配对封装；导入后由用户在 Mac“照片”分享完整实况到 iPhone，不把单独 MP4 当成实况，也不保证分开发送两份资源会自动合成。

## 图片格式兼容转换

`NormalizeImage.swift` 和 `scripts/normalize-input.mjs` 在输入图片不兼容时生成标准 PNG，仅修正格式与显示方向；八位 RGB 保持原尺寸、颜色空间和解码像素，核对原件未变。转换记录保存在任务 `input/format-conversion.json`，内置图片工具请求自动指向兼容副本。不得把转换用作静态调色，多帧及高动态范围不静默降级。
