# 文件完整性检查

在技能目录运行 `node scripts/plog.mjs verify`，按 `bundle-manifest.json` 检查全部技能文件，发现缺失、内容变化或清单外文件时失败；运行时编译缓存和系统生成的 `.DS_Store` 不参与检查。

`scripts/verify-visual-baseline.mjs` 是同一完整性检查的兼容入口。

校验通过只证明文件完整，不代表画面观感、手机播放或平台验收。
