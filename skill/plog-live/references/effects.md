# 装饰布局

## 动效布局

效果标识与目录见 `effects/catalog.json`。将所选效果的完整 `scene-config.js` 对象作为 `config`，按[动线规范](motion-layout.md)调整后填写：

目录中的 `sharedFiles` 指定共用的控件、样式和材质程序。使用 `create-scene.mjs` 或统一入口生成场景时，程序会把这些文件复制到输出目录，成品不跨目录读取技能包。直接复制单个效果模板目录不足以形成独立作品。纸云密雨的图片素材随包携带。

```json
{
 "sourceSha256":"处理后照片的真实SHA-256",
 "reviewedForSource":true,
 "placement":"surface",
 "subjectRegions":[{"x":0.2,"y":0.4,"width":0.6,"height":0.5}],
 "captionRegions":[{"x":0.7,"y":0.15,"width":0.2,"height":0.04}],
 "motionPlan":{"intent":"杯中冒泡","anchor":"左侧咖啡杯口","direction":"向上微弯","depth":"杯沿后方出生，上升至食物前方","overlap":"经过杯身，避让小字"},
 "config":{"说明":"替换为所选效果针对本图调整后的完整配置"}
}
```

坐标为完整照片内的 0–1 比例。`sourceSha256` 用 `shasum -a 256` 或 `scripts/lib.mjs` 的 `fileHash` 读取；看图确认布局后设置 `reviewedForSource:true`。

飘落配置用 `scripts/motion-layout.mjs` 导出的 `scatterFalling(config, sourceSha256)` 在布局阶段打散相位；返回的完整配置须保存。鸟蝶填写 `config.flightDirection` 并按照片调整曲线，方向含义和转向工具见[动线规范](motion-layout.md)。使用画外进出的飞行模板时选择 `placement:"screen"`；贴附版必须重画当前物件的遮挡，不能照搬旧图轮廓。

原动态版使用 `placement:"screen"` 和 `reviewedWholeClip:true`，清空 `foregroundPath`、`mintMask`。程序拒绝 `rain`、`glitter`、杯口起点气泡及所有 `surface` 贴附布局。

## 静态表情布局

```json
{"sourceSha256":"调色后照片的真实SHA-256","reviewedForSource":true,"faces":[{"expression":"food-faces","x":0.5,"y":0.6,"size":0.08}]}
```

`expression` 从 `faces/catalog.json` 选择。坐标按食物或瓶身位置填写，`size` 是表情宽度占照片宽度的比例。原动态版暂不支持贴附表情。
