# 公共材质来源

[公共材质程序](../../shared/charms-material.js)包含星、月、小花、菱形、四角碎光和蝶翼的绘制方法，供效果目录中的 `sharedFiles` 映射复制到成品。

程序中的来源标注对应以下本地作品与函数：

- 「星月来信」`animation.js`：`makeShape` 的月牙、小花和菱形轮廓，`glintTexture` 的亮核与光芒，`butterflySpread` 的非对称拍翼。
- 「花落成蝶」`august-night-osmanthus/scene.js`：`symbolPath`、`wingPath`、`buildWingAtlas`、`drawButterfly` 的形状和蝶翼绘制。

适配内容包括金色与银色配色、有限尺寸的内存画布缓存，以及按传入时刻绘制。运行时使用包内实现，不读取原作目录。
