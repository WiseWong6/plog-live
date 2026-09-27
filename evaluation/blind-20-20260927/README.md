# 二十张外部照片默认适配测试

这是一轮已锁定并完成的测试，不能直接覆盖或把修复后的作品写回当前编号。结论与逐张对照见 [交付报告](../../delivery/blind-20-20260927/report.md)。技能、模板及苹果封装程序与冻结提交相同。

## 文件关系

- `protocol.md` 在输出前写定范围、匿名方法和判定条件；其指纹记入 `manifest.lock.json`。
- `sources-a/`、`sources-b/` 是两位选样代理各自的原照片及来源记录；不参与本轮调参。
- `freeze.mjs` 记录原图指纹并固定打乱编号。已有清单时拒绝覆盖。
- `run.mjs` 为本轮实际运行流程，每张只创建一次目录。当前二十组已存在，再运行会拒绝重做。视频渲染阶段的报告先产生，苹果验证报告在之后另行产生。
- `technical-results.json` 保留正式运行汇总；完整验证报告和命令输出在每组交付目录中。`sourcePreserved` 在正式运行时检查复制来源元数据，随后 `check-gallery.mjs` 另做实际原文件与副本的逐字节核对，记录为 `input-integrity.json`，没有重新制作作品。
- `visual-a.json`、`visual-b.json` 是两位独立代理的匿名封面评审，合并为 `visual-results.json`，未按技术结果改分。未做完整动态观感验收。
- `build-gallery.mjs`、`build-report.mjs` 只从记录生成对照页与报告，不调整样本或作品。`check-gallery.mjs` 检查原照片一致性与离线页功能，无截图；创建的独立后台浏览器在结束或异常时关闭。

## 可安全重做的资料检查

在项目根目录运行，保留现有照片与成片：

```sh
node evaluation/blind-20-20260927/build-gallery.mjs
node --check delivery/blind-20-20260927/gallery-data.js
node evaluation/blind-20-20260927/check-gallery.mjs
node evaluation/blind-20-20260927/build-report.mjs
```

`build-gallery.mjs` 会按实际存在的文件提供下载链接；仅从 Git 恢复、没有本机 `cases/` 时，不能声称所有媒体可用。`check-gallery.mjs` 会明确失败。

若需要从源照片重新生成，应建立新的输出目录及重建标识，复用冻结版本逐张运行 `create-scene.mjs`、`render-scene.mjs` 和 `live-photo.sh pack`，参数照 `run.mjs`；不要删除这一轮目录来解除覆盖保护。苹果资源配对标识会重新产生，新产物不应冒充本轮原始文件。后续产品修复也应另建轮次。

## 本轮辅助页面修正

在交付检查中发现匿名样本链接只在首次打开时选择对应照片，同一页面内改变地址片段不会切换。只修改评估页的切换处理并复检通过，没有改被测技能、评分或生成作品。初次失败的检查没有写成通过报告。

二十组作品约 59 MB，本机保留等待验收，未纳入 Git 的派生目录；原图及记录约 4.5 MB 纳入本地 Git。没有向远程发布源照片或产物。每组日志被项目既有 `*.log` 规则排除，但保留在本机。下一步建议先开发主体避让，再以另一个轮次验证；这不属于本轮测试的已完成项。
