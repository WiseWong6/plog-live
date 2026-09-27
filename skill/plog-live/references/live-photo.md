# 苹果实况照片：资源制作与边界

实况照片由静态照片与配对视频共同构成。普通短视频、一个封面图片，或把两份文件改成相同名字，都不足以证明配对成立。

## 本项目采用的路径

1. 将静止照片和独立装饰按作品时间渲染为短视频。
2. 从同一场景的指定时刻生成对应静态封面。
3. 使用原生工具准备苹果可识别的照片与配对视频，写入关联信息及静态封面所对应的时间。
4. 分层验证文件结构、系统解码、照片应用表现以及手机表现。

配对元数据的具体制作参考 [LimitPoint 的 LivePhoto 实现](https://github.com/LimitPoint/LivePhoto)。这是第三方开源实现参考，不是苹果对所有导出方法的保证。照片中的资源关联信息、视频中的内容标识与静态照片时间标记必须协调；实际可用性仍以苹果系统解码和目标设备验收为准。

苹果官方将配对视频定义为照片资源类型，相关接口见 [pairedVideo](https://developer.apple.com/documentation/photos/phassetresourcetype/pairedvideo)。使用资源请求构建实况照片见 [PHLivePhoto.request](https://developer.apple.com/documentation/photos/phlivephoto/request(withresourcefileurls:placeholderimage:targetsize:contentmode:resulthandler:))。

## 推荐起点

| 项目 | 本项目的创作建议 | 限定 |
| --- | --- | --- |
| 时长 | 3 秒 | 是短循环默认值，不是所有实况照片的强制格式上限 |
| 帧率 | 每秒 30 帧 | 为当前制作路径选择；改变后应重新核查时间与封面 |
| 画幅 | 新主题可从 3:4 竖幅起步 | 原照片默认匹配其比例；显式指定画布双边尺寸才采用对应显示取景 |
| 封面时刻 | 1.5 秒 | 只适用于示例；必须落在实际视频时长内 |
| 声音 | 默认无声 | 本项目的审美选择，不代表格式不支持声音 |

静态照片和视频的方向、构图、色彩应一致，封面切换到运动时不应明显跳变。默认值不应冒充苹果系统的公开硬限制。

## 场景创建与渲染

首版创建脚本接受 PNG、JPEG 和 WebP。HEIC 等其他格式不自动转换或重绘；需要更改照片文件时，遵守宿主图像编辑工具限定。

以下命令以 `SKILL.md` 所在的技能根目录为工作目录，路径以实际位置替换。技能包内含自己的 `scripts/`、`templates/scene/` 与 `native/`；复制安装后按安装位置解析，不依赖开发仓库。若从开发项目根目录运行，则给脚本路径加上 `skill/plog-live/` 前缀。

```sh
node scripts/create-scene.mjs --photo /绝对路径/原照片.jpg --out /绝对路径/场景目录
node scripts/render-scene.mjs --scene /绝对路径/场景目录 --out /绝对路径/渲染目录
```

创建场景时可另传 `--config /绝对路径/配置文件.json`。配置字段以模板的实际接口为准。

渲染通过 Chrome 的专用后台实例读取本场景的 `file://` 页面，帧数据直接送往 FFmpeg，不启动 HTTP 服务，不操作用户原有窗口，不生成落盘的逐帧截图。任务结束后关闭本次创建的实例。

保留可供复查的静态封面与视频。不要为了把普通图片伪装成原始照片而虚构相机、拍摄地点或拍摄时间。

## 资源配对

```sh
scripts/live-photo.sh pack --photo /绝对路径/渲染目录/cover.png --video /绝对路径/渲染目录/preview.mp4 --output /绝对路径/配对目录 --name plog-paper-rain --key-time 1.5
```

输入封面 `cover.png` 与预览视频 `preview.mp4` 是制作素材。当前原生工具以指定名称输出 JPEG 照片、MOV 影片与验证报告，例如 `plog-paper-rain.jpg`、`plog-paper-rain.mov` 和 `plog-paper-rain.validation.json`。不能仅因文件存在就声称实况照片已可用。

`pack` 内置文件检查与苹果系统解码检查；首先读取报告中 `file_pair`、`system_decode` 和 `success` 的实际结果。相册与手机状态分别记录，不能因为系统解码成功就提升它们的状态。

对于外部配对资源、改变后的文件，或仍有疑点需要单独复核时，可运行：

```sh
scripts/live-photo.sh verify --photo /绝对路径/plog-paper-rain.jpg --video /绝对路径/plog-paper-rain.mov
```

验证应指向此次实际资源，不能验证另一组旧文件。打包时检查已经通过且文件未改变时，不重复执行。

当前原生工具需要 macOS 26 或更高版本、可用的苹果 Swift 编译器和 macOS 开发工具包。首次调用会在技能的 `native/.build/` 下构建本机工具，这是可再生成的编译产物；不会自动安装工具、切换系统默认工具链或接受系统协议。环境不满足时说明具体阻塞，不把这一实现要求泛化为实况照片的系统要求。

## 相册导入

苹果照片库写入接口见 [PHAssetCreationRequest](https://developer.apple.com/documentation/photos/phassetcreationrequest)。导入动作会创建用户相册中的新项目；只有用户明确要求加入相册，才调用本项目原生工具的 `import` 子命令。

不得把导入当作每次运行的默认测试，也不得在用户尚未授权时为了“验证成功”自动写入照片库。授权后，系统仍可能要求照片权限；需要用户操作时说明具体原因。

用户明确要求加入相册之后，才可运行：

```sh
scripts/live-photo.sh import --photo /绝对路径/plog-paper-rain.jpg --video /绝对路径/plog-paper-rain.mov
```

每次导入都会新增相册项目。结果不明确时先核对相册，不能连续重试造成重复内容。

文件配对成功、系统可以解码、照片应用内能识别和播放、手机上能长按播放，是四个不同结论。报告时分别说明，不互相替代。

## 传到手机与平台兼容性

手机端操作参考苹果的 [拍摄和编辑实况照片](https://support.apple.com/zh-cn/104966) 与 [使用 AirDrop 共享内容](https://support.apple.com/zh-cn/108782)。共享方式或接收应用可能影响动态资源是否保留；传输后要在手机照片应用中检查实况标识及长按播放。

小红书或其他发布平台能否读取动态照片，应以当前版本的真实上传测试为准，不由配对文件或苹果照片应用测试推导。没有执行发布测试，就说明“发布平台兼容性未验证”，不要自动上传内容。

## 失败时怎样交付

工具链、系统权限或苹果资源解码失败时，保留已成功生成的静态封面、视频和场景页面，说明失败层级、错误依据以及下一步需要的操作。不得通过安装第三方生图工具、自动接受系统协议或自动导入用户相册来掩盖阻塞。
