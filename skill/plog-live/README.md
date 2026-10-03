# PLOG·日常奇遇

默认保留完整照片构图，用纯文字提示词调色；英文短句按每张照片的实际含义生成，放在主体旁边的自然留白，再布置一个装饰效果，输出静音短片、封面及苹果实况配对文件。按用户要求也可只输出静态照片，或另做保留原拍摄动作与原声的版本。操作流程见 [SKILL.md](SKILL.md)。

## 包内内容

- [prompts/quiet-plog.md](prompts/quiet-plog.md)：调色提示词。
- [effects/catalog.json](effects/catalog.json)：动效目录。
- [faces/catalog.json](faces/catalog.json)：五种可选静态食物表情；[extensions/aroma/README.md](extensions/aroma/README.md) 提供可选食物香气。
- [scripts/plog.mjs](scripts/plog.mjs)：准备、接收图片工具结果、制作、导出及校验。
- [native/README.md](native/README.md)：格式转换、原动态连续调色与苹果实况封装的源码、运行条件和权限边界。
- [references/effects.md](references/effects.md)、[references/acceptance.md](references/acceptance.md)：布局与验收；[references/visual-baseline.md](references/visual-baseline.md)：发行包完整性校验。

## 运行条件

Node.js 22 或更新版本、FFmpeg 与 Chrome；苹果媒体处理还需要 macOS 26 及 Apple 命令行开发工具。当前程序连图片尺寸识别也使用苹果解码器，完整制作流程应在该环境运行。其他宿主可用其实际可用且支持输入照片编辑的图片工具完成提示词调色，但若没有上述本地运行条件，必须说明无法继续运行本包的合成与实况封装，不能假称完成。不自动安装依赖或接入新服务。

## 本地检查

在本目录执行 `node scripts/plog.mjs verify` 和 `npm test`。完整操作命令与输入输出见主技能。校验清单由程序实际读取；校验一致不等于用户观感、手机播放或平台审核已通过。

`npm test` 覆盖宿主识别、布局规则、完整包校验和编译失败保护。需要核对十三种效果生成后的文件时，执行 `node tests/scene-files.mjs /已有照片的绝对路径`；它使用已有原图，仅检查复制及资源完整性，不启动浏览器、不生成新图像，结束后清理临时场景。香气边界检查支持 `node extensions/aroma/test.mjs /已有照片 /对应布局.json /新的检查路径`。

`bundle-manifest.json` 记录技能文件及校验值；修改文件后须更新清单，再运行完整性校验。

`node tests/motion-scenes.mjs /已有照片的绝对路径` 在独立浏览器中检查五种飘落及鸟蝶各四个方向的循环、重播、位移和身体朝向，不保存截图、不修改原照片，完成后关闭浏览器并清理临时场景。首帧分布规则和确定性种子另由 `npm test` 检查；这些检查不等于观感验收。

## 数据与权限

只读取用户选择的文件，输出到新的指定目录。默认不写相册、不开同步、不隔空投送、不上传发布。调用图片工具时只提交该用户指定照片及提示词，并记录实际调用来源。导入苹果照片需要用户明确要求；投送由用户自己从照片应用发起。
