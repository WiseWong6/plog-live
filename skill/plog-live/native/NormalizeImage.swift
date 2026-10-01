import Foundation
import ImageIO
import CoreGraphics
import UniformTypeIdentifiers

// Compatibility conversion only: full pixels, orientation and source colour space.
// No grading, resize, crop, exposure change or metadata copy from the original.
func fail(_ message: String) throws -> Never { throw NSError(domain: "PLOGFormat", code: 1, userInfo: [NSLocalizedDescriptionKey: message]) }
func rgba(_ image: CGImage) throws -> Data {
    guard let space = image.colorSpace, let ctx = CGContext(data: nil, width: image.width, height: image.height, bitsPerComponent: 8, bytesPerRow: image.width * 4, space: space, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue), let bytes = ctx.data else { try fail("无法验证转换前后像素") }
    ctx.draw(image, in: CGRect(x: 0, y: 0, width: image.width, height: image.height))
    return Data(bytes: bytes, count: image.width * image.height * 4)
}
do {
    let args = CommandLine.arguments
    guard args.count == 3 else { try fail("用法：normalize-image 输入文件 输出.png") }
    let src = URL(fileURLWithPath: args[1]), dst = URL(fileURLWithPath: args[2])
    guard src.standardizedFileURL != dst.standardizedFileURL, !FileManager.default.fileExists(atPath: dst.path) else { try fail("不覆盖原件或已有转换文件") }
    guard dst.pathExtension.lowercased() == "png", let source = CGImageSourceCreateWithURL(src as CFURL, nil), let original = CGImageSourceCreateImageAtIndex(source, 0, nil), let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any] else { try fail("苹果解码器无法读取输入图片") }
    guard CGImageSourceGetCount(source) == 1 else { try fail("多帧图片需要保留全部帧，不能静默转换成一帧") }
    guard original.bitsPerComponent <= 8, original.colorSpace?.model == .rgb else { try fail("当前兼容转换只处理八位 RGB；高动态范围或其他色彩空间需另行处理，不能静默降级") }
    let orientation = (properties[kCGImagePropertyOrientation] as? NSNumber)?.intValue ?? 1
    let rotated = [5,6,7,8].contains(orientation)
    let expectedWidth = rotated ? original.height : original.width
    let expectedHeight = rotated ? original.width : original.height
    let options: [CFString: Any] = [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: max(original.width, original.height), kCGImageSourceShouldCacheImmediately: true]
    guard let pixels = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary), pixels.width == expectedWidth, pixels.height == expectedHeight, pixels.colorSpace?.name == original.colorSpace?.name else { try fail("转换改变了尺寸或颜色空间，已停止") }
    guard let output = CGImageDestinationCreateWithURL(dst as CFURL, UTType.png.identifier as CFString, 1, nil) else { try fail("无法创建 PNG") }
    CGImageDestinationAddImage(output, pixels, [kCGImagePropertyOrientation: 1] as CFDictionary)
    guard CGImageDestinationFinalize(output), let check = CGImageSourceCreateWithURL(dst as CFURL, nil), let decoded = CGImageSourceCreateImageAtIndex(check, 0, nil) else { try fail("转换后图片不可解码") }
    guard decoded.width == expectedWidth, decoded.height == expectedHeight, decoded.colorSpace?.name == pixels.colorSpace?.name, try rgba(decoded) == rgba(pixels) else { try fail("转换后像素或颜色空间与原图不一致") }
    let report: [String: Any] = ["operation": "lossless-format-normalization", "source": src.path, "output": dst.path, "width": expectedWidth, "height": expectedHeight, "inputOrientation": orientation, "outputOrientation": 1, "colourSpace": (pixels.colorSpace?.name as String?) ?? "unknown", "decodedPixelsIdentical": true, "sourcePreserved": true, "resized": false, "graded": false]
    print(String(data: try JSONSerialization.data(withJSONObject: report, options: [.prettyPrinted, .sortedKeys]), encoding: .utf8)!)
} catch { fputs("\(error.localizedDescription)\n", stderr); exit(1) }
