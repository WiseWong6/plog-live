import Foundation
import AppKit
import AVFoundation
import Photos
import ImageIO
import UniformTypeIdentifiers

// macOS 26's async receivers avoid deprecated AVFoundation adaptor APIs.
private let contentKey = "com.apple.quicktime.content.identifier"
private let stillKey = "com.apple.quicktime.still-image-time"
private let fm = FileManager.default

private struct ToolError: LocalizedError {
    let code: String
    let message: String
    var errorDescription: String? { message }
}
private func fail(_ code: String, _ message: String) -> ToolError {
    ToolError(code: code, message: message)
}
private func fileURL(_ path: String) -> URL {
    URL(fileURLWithPath: (path as NSString).expandingTildeInPath).standardizedFileURL
}
private func requireFile(_ url: URL) throws {
    var directory: ObjCBool = false
    guard fm.fileExists(atPath: url.path, isDirectory: &directory), !directory.boolValue,
          fm.isReadableFile(atPath: url.path) else {
        throw fail("input_not_readable", "无法读取输入文件：\(url.path)")
    }
}
private func jsonData(_ object: [String: Any]) throws -> Data {
    try JSONSerialization.data(withJSONObject: object, options: [.prettyPrinted, .sortedKeys, .withoutEscapingSlashes])
}
private func output(_ object: [String: Any], to reportURL: URL?) {
    do {
        var data = try jsonData(object)
        data.append(0x0a)
        if let reportURL { try data.write(to: reportURL, options: .atomic) }
        FileHandle.standardOutput.write(data)
    } catch {
        FileHandle.standardError.write(Data("无法写入检查结果：\(error.localizedDescription)\n".utf8))
    }
}

private struct Arguments {
    let command: String
    let values: [String: String]
    init(_ raw: [String]) throws {
        guard let first = raw.first, ["pack", "verify", "import"].contains(first) else {
            throw fail("invalid_command", "用法：live-photo pack|verify|import --photo 文件 --video 文件；pack 另需 --output 目录 --name 名称 [--key-time 1.5]")
        }
        command = first
        var parsed: [String: String] = [:]
        let allowed: Set<String> = first == "pack"
            ? ["--photo", "--video", "--output", "--name", "--key-time", "--preserve-key-time", "--result-json"]
            : ["--photo", "--video", "--result-json"]
        var index = 1
        while index < raw.count {
            let key = raw[index]
            guard allowed.contains(key), index + 1 < raw.count, parsed[key] == nil else {
                throw fail("invalid_argument", "未知、重复或缺少值的参数：\(key)")
            }
            parsed[key] = raw[index + 1]
            index += 2
        }
        for key in first == "pack" ? ["--photo", "--video", "--output", "--name"] : ["--photo", "--video"] {
            guard let value = parsed[key], !value.isEmpty else { throw fail("missing_argument", "缺少参数：\(key)") }
        }
        values = parsed
    }
    subscript(_ key: String) -> String { values[key]! }
}

private struct ImageInfo {
    let identifier: String?
    let width: Int
    let height: Int
    let orientation: Int
}
private func imageInfo(_ url: URL) throws -> ImageInfo {
    try requireFile(url)
    guard let source = CGImageSourceCreateWithURL(url as CFURL, nil),
          CGImageSourceGetCount(source) == 1,
          let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any],
          let width = properties[kCGImagePropertyPixelWidth as String] as? Int,
          let height = properties[kCGImagePropertyPixelHeight as String] as? Int,
          CGImageSourceCreateImageAtIndex(source, 0, nil) != nil else {
        throw fail("invalid_image", "封面必须是可以解码的单张图片。")
    }
    let maker = properties[kCGImagePropertyMakerAppleDictionary as String] as? [String: Any]
    return ImageInfo(identifier: maker?["17"] as? String, width: width, height: height,
                     orientation: properties[kCGImagePropertyOrientation as String] as? Int ?? 1)
}
private func writePhoto(from sourceURL: URL, to target: URL, identifier: String) throws {
    guard let source = CGImageSourceCreateWithURL(sourceURL as CFURL, nil),
          let destination = CGImageDestinationCreateWithURL(target as CFURL, UTType.jpeg.identifier as CFString, 1, nil) else {
        throw fail("image_writer_failed", "无法创建 JPEG 封面。")
    }
    var properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [String: Any] ?? [:]
    var maker = properties[kCGImagePropertyMakerAppleDictionary as String] as? [String: Any] ?? [:]
    maker["17"] = identifier
    properties[kCGImagePropertyMakerAppleDictionary as String] = maker
    properties[kCGImageDestinationLossyCompressionQuality as String] = 0.98
    CGImageDestinationAddImageFromSource(destination, source, 0, properties as CFDictionary)
    guard CGImageDestinationFinalize(destination) else { throw fail("image_write_failed", "JPEG 封面写入失败。") }
}

private struct FramePoint {
    let time: CMTime
    let duration: CMTime
}
// A captured still marker can occur inside a displayed VFR frame, not only at its start.
private func frameContaining(_ time: Double, frames: [FramePoint], duration: Double) -> FramePoint? {
    guard time.isFinite, time >= 0, time < duration else { return nil }
    return frames.enumerated().first { index, frame in
        let start = frame.time.seconds
        let next = index + 1 < frames.count ? frames[index + 1].time.seconds : duration
        let end = frame.duration.isNumeric && frame.duration.seconds > 0
            ? min(next, start + frame.duration.seconds) : next
        return time >= start - 0.002 && time < min(duration, end) + 0.002
    }?.element
}
private func videoFrames(_ asset: AVAsset, track: AVAssetTrack) async throws -> [FramePoint] {
    let reader = try AVAssetReader(asset: asset)
    let trackOutput = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
    let provider = reader.outputProvider(for: trackOutput)
    try reader.start()
    var frames: [FramePoint] = []
    while let sample = try await provider.next() {
        // Compressed H.264 may carry edit-list offsets and marker-only buffers.
        // The output timestamp is the displayed timeline, not the coded PTS.
        guard sample.contentType != .markerOnly else { continue }
        let time = sample.outputPresentationTimeStamp
        if time.isNumeric { frames.append(FramePoint(time: time, duration: sample.outputDuration)) }
    }
    guard reader.status == .completed else { throw reader.error ?? fail("video_read_failed", "视频帧读取未完成。") }
    return frames.sorted { CMTimeCompare($0.time, $1.time) < 0 }
}
private func markerItem() -> AVMetadataItem {
    let item = AVMutableMetadataItem()
    item.keySpace = .quickTimeMetadata
    item.key = stillKey as NSString
    item.value = 0 as NSNumber
    item.dataType = kCMMetadataBaseDataType_SInt8 as String
    return item
}

private struct TransferPipe {
    let reader: AVAssetReader
    let provider: AVAssetReaderOutput.Provider<CMReadySampleBuffer<CMSampleBuffer.DynamicContent>>
    let receiver: AVAssetWriterInput.SampleBufferReceiver
}
private func writeMovie(asset: AVAsset, to target: URL, identifier: String, frame: FramePoint) async throws {
    let writer = try AVAssetWriter(outputURL: target, fileType: .mov)
    // Exact common clock for 44.1/48 kHz audio and Apple 600 Hz capture times.
    writer.movieTimeScale = 7_056_000
    let identity = AVMutableMetadataItem()
    identity.identifier = .quickTimeMetadataContentIdentifier
    identity.value = identifier as NSString
    identity.dataType = kCMMetadataBaseDataType_UTF8 as String
    writer.metadata = [identity]
    var pipes: [TransferPipe] = []
    for mediaType in [AVMediaType.video, AVMediaType.audio] {
        for track in try await asset.loadTracks(withMediaType: mediaType) {
            let formats = try await track.load(.formatDescriptions)
            guard let format = formats.first else { throw fail("missing_format", "视频或音频轨道缺少格式说明。") }
            let input = AVAssetWriterInput(mediaType: mediaType, outputSettings: nil, sourceFormatHint: format)
            if mediaType == .video { input.mediaTimeScale = try await track.load(.naturalTimeScale); input.transform = try await track.load(.preferredTransform) }
            guard writer.canAdd(input) else { throw fail("unsupported_codec", "此视频编码无法直接封装为 MOV。请先提供 H.264 视频。") }
            let receiver = writer.inputReceiver(for: input)
            let reader = try AVAssetReader(asset: asset)
            let source = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
            let provider = reader.outputProvider(for: source)
            pipes.append(TransferPipe(reader: reader, provider: provider, receiver: receiver))
        }
    }
    let specification: [String: Any] = [
        kCMMetadataFormatDescriptionMetadataSpecificationKey_Identifier as String: "mdta/\(stillKey)",
        kCMMetadataFormatDescriptionMetadataSpecificationKey_DataType as String: kCMMetadataBaseDataType_SInt8 as String
    ]
    var description: CMFormatDescription?
    let status = CMMetadataFormatDescriptionCreateWithMetadataSpecifications(allocator: kCFAllocatorDefault,
        metadataType: kCMMetadataFormatType_Boxed, metadataSpecifications: [specification] as CFArray,
        formatDescriptionOut: &description)
    guard status == noErr, let description else { throw fail("metadata_format_failed", "无法创建关键照片时间轨道。") }
    let metadataInput = AVAssetWriterInput(mediaType: .metadata, outputSettings: nil, sourceFormatHint: description)
    let metadataReceiver = writer.inputMetadataReceiver(for: metadataInput)
    do {
        try writer.start()
        writer.startSession(atSourceTime: .zero)
        try await metadataReceiver.append(AVTimedMetadataGroup(items: [markerItem()], timeRange: CMTimeRange(start: frame.time, duration: frame.duration)))
        metadataReceiver.finish()
        try await withThrowingTaskGroup(of: Void.self) { group in
            for pipe in pipes {
                group.addTask {
                    try pipe.reader.start()
                    while let sample = try await pipe.provider.next() { try await pipe.receiver.append(sample) }
                    guard pipe.reader.status == .completed else {
                        throw pipe.reader.error ?? fail("movie_read_failed", "封装时未完整读入轨道。")
                    }
                    pipe.receiver.finish()
                }
            }
            try await group.waitForAll()
        }
        writer.endSession(atSourceTime: try await asset.load(.duration))
        await writer.finishWriting()
        guard writer.status == .completed else { throw writer.error ?? fail("movie_write_failed", "MOV 封装失败。") }
    } catch {
        pipes.forEach { $0.reader.cancelReading() }
        writer.cancelWriting()
        throw error
    }
}

@MainActor private final class DecodeProbe {
    private var continuation: CheckedContinuation<[String: Any], Never>?
    private var requestID = PHLivePhotoRequestIDInvalid
    private var timeout: Task<Void, Never>?
    func run(photo: URL, video: URL) async -> [String: Any] {
        await withCheckedContinuation { continuation in
            self.continuation = continuation
            requestID = PHLivePhoto.request(withResourceFileURLs: [photo, video], placeholderImage: nil,
                targetSize: .zero, contentMode: .aspectFit) { livePhoto, info in
                let degraded = (info[PHLivePhotoInfoIsDegradedKey] as? NSNumber)?.boolValue ?? false
                let cancelled = (info[PHLivePhotoInfoCancelledKey] as? NSNumber)?.boolValue ?? false
                let error = (info[PHLivePhotoInfoErrorKey] as? NSError)?.localizedDescription
                let size = livePhoto?.size
                Task { @MainActor in
                    guard !degraded else { return }
                    if let size, !cancelled, error == nil {
                        self.finish(["status": "passed", "full_non_degraded_result": true,
                                     "width": Int(size.width), "height": Int(size.height)])
                    } else {
                        self.finish(["status": "failed", "full_non_degraded_result": false,
                                     "message": error ?? (cancelled ? "系统解码已取消。" : "苹果系统未能加载完整实况照片。")])
                    }
                }
            }
            timeout = Task { @MainActor in
                do { try await Task.sleep(for: .seconds(30)) } catch { return }
                guard self.continuation != nil else { return }
                self.finish(["status": "timeout", "full_non_degraded_result": false,
                             "message": "苹果系统在 30 秒内未完成解码；未认定为通过。"])
                PHLivePhoto.cancelRequest(withRequestID: self.requestID)
            }
        }
    }
    private func finish(_ result: [String: Any]) {
        guard let continuation else { return }
        self.continuation = nil
        timeout?.cancel()
        continuation.resume(returning: result)
    }
}

private func verify(photo: URL, video: URL) async throws -> [String: Any] {
    let image = try imageInfo(photo)
    try requireFile(video)
    let asset = AVURLAsset(url: video)
    let videoTracks = try await asset.loadTracks(withMediaType: .video)
    guard videoTracks.count == 1, let track = videoTracks.first else { throw fail("invalid_video_tracks", "需要恰好一条视频画面轨道。") }
    let duration = try await asset.load(.duration).seconds
    guard duration.isFinite, duration > 0 else { throw fail("invalid_duration", "视频时长无效。") }
    let frames = try await videoFrames(asset, track: track)
    let metadata = try await asset.load(.metadata)
    var identifiers: [String] = []
    for item in metadata where item.identifier == .quickTimeMetadataContentIdentifier {
        if let value = try await item.load(.stringValue) { identifiers.append(value) }
    }
    var markers: [(time: Double, duration: Double, value: Int)] = []
    for metadataTrack in try await asset.loadTracks(withMediaType: .metadata) {
        let reader = try AVAssetReader(asset: asset)
        let source = AVAssetReaderTrackOutput(track: metadataTrack, outputSettings: nil)
        let provider = reader.outputMetadataProvider(for: source)
        try reader.start()
        while let group = try await provider.next() {
            for item in group.items where item.identifier?.rawValue == "mdta/\(stillKey)" || (item.key as? String) == stillKey {
                let value = try await item.load(.numberValue)
                markers.append((group.timeRange.start.seconds, group.timeRange.duration.seconds, value?.intValue ?? -999))
            }
        }
        guard reader.status == .completed else { throw reader.error ?? fail("metadata_read_failed", "关键照片时间轨道未完整读出。") }
    }
    var issues: [String] = []
    if image.identifier == nil || image.identifier?.isEmpty == true { issues.append("图片缺少 Apple 配对标识。") }
    if identifiers.count != 1 || identifiers.first != image.identifier { issues.append("图片与视频的唯一配对标识不一致。") }
    if frames.count < 2 { issues.append("视频不足两帧。") }
    if markers.count != 1 { issues.append("视频必须有一个关键照片时间标记。") }
    let size = try await track.load(.naturalSize)
    let transform = try await track.load(.preferredTransform)
    let display = CGRect(origin: .zero, size: size).applying(transform)
    let imageWidth = [5, 6, 7, 8].contains(image.orientation) ? image.height : image.width
    let imageHeight = [5, 6, 7, 8].contains(image.orientation) ? image.width : image.height
    if abs(Double(imageWidth) / Double(imageHeight) - abs(display.width / display.height)) > 0.002 {
        issues.append("封面与视频显示比例不一致。")
    }
    var markerJSON: [String: Any] = [:]
    if let marker = markers.first {
        let nearest = frames.min { abs($0.time.seconds - marker.time) < abs($1.time.seconds - marker.time) }
        let delta = nearest.map { abs($0.time.seconds - marker.time) } ?? .infinity
        let inRange = marker.time.isFinite && marker.time >= 0 && marker.time < duration && marker.duration.isFinite && marker.duration > 0
        if !inRange { issues.append("关键照片时间不在有效视频范围内。") }
        let containing = frameContaining(marker.time, frames: frames, duration: duration)
        if containing == nil { issues.append("关键照片标记不在实际视频帧的显示区间内。") }
        if ![0, -1].contains(marker.value) { issues.append("关键照片时间标记的数据值不受本工具支持。") }
        markerJSON = ["seconds": marker.time, "duration_seconds": marker.duration,
                      "matches_video_frame": containing != nil, "match_rule": "inside_displayed_frame_interval", "tolerance_seconds": 0.002, "value": marker.value]
        if delta.isFinite { markerJSON["frame_delta_seconds"] = delta }
    }
    let pairingPassed = issues.isEmpty
    let decode: [String: Any] = pairingPassed
        ? await DecodeProbe().run(photo: photo, video: video)
        : ["status": "not_run", "message": "文件检查失败，未请求系统解码。"]
    return ["schema_version": 1, "operation": "verify",
            "success": pairingPassed && decode["status"] as? String == "passed",
            "photo": photo.path, "video": video.path,
            "file_pair": ["status": pairingPassed ? "passed" : "failed", "issues": issues,
                          "photo_identifier": image.identifier ?? NSNull(), "video_identifiers": identifiers,
                          "duration_seconds": duration, "frame_count": frames.count,
                          "photo_width": imageWidth, "photo_height": imageHeight,
                          "video_width": Int(abs(display.width)), "video_height": Int(abs(display.height)),
                          "key_photo_marker": markerJSON] as [String: Any],
            "system_decode": decode,
            "photos_library": ["status": "not_imported"],
            "iphone_playback": ["status": "not_tested"],
            "platform_upload": ["status": "not_tested"],
            "limits": ["系统解码通过不代表已写入相册或已在 iPhone 验收。", "封面内容与视频关键帧是否一致仍需人工验收。"]]
}

private func pack(_ args: Arguments) async throws -> [String: Any] {
    let photo = fileURL(args["--photo"]), video = fileURL(args["--video"])
    _ = try imageInfo(photo)
    try requireFile(video)
    let name = args["--name"]
    guard name != ".", name != "..", !name.contains("/"), !name.contains("\\"), !name.contains("\0") else {
        throw fail("invalid_name", "输出名称只能是文件名，不能包含路径。")
    }
    guard let requested = Double(args.values["--key-time"] ?? "1.5"), requested.isFinite, requested >= 0 else {
        throw fail("invalid_key_time", "关键照片时间必须是大于等于零的有限秒数。")
    }
    let directory = fileURL(args["--output"])
    try fm.createDirectory(at: directory, withIntermediateDirectories: true)
    let outputPhoto = directory.appendingPathComponent("\(name).jpg")
    let outputVideo = directory.appendingPathComponent("\(name).mov")
    let outputReport = directory.appendingPathComponent("\(name).validation.json")
    for target in [outputPhoto, outputVideo, outputReport] where fm.fileExists(atPath: target.path) {
        throw fail("output_exists", "为保护已有产物，拒绝覆盖：\(target.path)")
    }
    let asset = AVURLAsset(url: video)
    let duration = try await asset.load(.duration).seconds
    guard requested < duration else { throw fail("key_time_outside_video", "关键照片时间必须小于视频时长。") }
    let tracks = try await asset.loadTracks(withMediaType: .video)
    guard tracks.count == 1, let track = tracks.first else { throw fail("invalid_video_tracks", "需要恰好一条视频画面轨道。") }
    let frames = try await videoFrames(asset, track: track)
    guard frames.count >= 2, let first = frames.first, abs(first.time.seconds) < 0.001,
          let nearest = frames.min(by: { abs($0.time.seconds - requested) < abs($1.time.seconds - requested) }) else {
        throw fail("invalid_frame_timeline", "视频须从零开始并包含至少两帧。")
    }
    let frameDuration = nearest.duration.isNumeric && nearest.duration.seconds > 0
        ? nearest.duration : CMTime(seconds: duration / Double(frames.count), preferredTimescale: 60000)
    let preserve = args.values["--preserve-key-time"] ?? "false"
    guard ["true", "false"].contains(preserve) else { throw fail("invalid_argument", "preserve-key-time 只接受 true 或 false") }
    let markerTime = preserve == "true" ? CMTime(seconds: requested, preferredTimescale: 7_056_000) : nearest.time
    guard frameContaining(markerTime.seconds, frames: frames, duration: duration) != nil else {
        throw fail("invalid_key_time", "原封面时刻不在有效帧显示区间内，不能静默移动标记。")
    }
    let frame = FramePoint(time: markerTime, duration: frameDuration)
    let staging = directory.appendingPathComponent(".plog-live-\(UUID().uuidString)", isDirectory: true)
    try fm.createDirectory(at: staging, withIntermediateDirectories: false)
    defer { try? fm.removeItem(at: staging) }
    let stagedPhoto = staging.appendingPathComponent("\(name).jpg"), stagedVideo = staging.appendingPathComponent("\(name).mov")
    let identifier = UUID().uuidString
    try writePhoto(from: photo, to: stagedPhoto, identifier: identifier)
    try await writeMovie(asset: asset, to: stagedVideo, identifier: identifier, frame: frame)
    var report = try await verify(photo: stagedPhoto, video: stagedVideo)
    report["operation"] = "pack"
    report["photo"] = outputPhoto.path
    report["video"] = outputVideo.path
    report["validation_report"] = outputReport.path
    report["requested_key_time_seconds"] = requested
    report["actual_key_time_seconds"] = frame.time.seconds
    try fm.moveItem(at: stagedPhoto, to: outputPhoto)
    do { try fm.moveItem(at: stagedVideo, to: outputVideo) }
    catch { try? fm.removeItem(at: outputPhoto); throw error }
    try jsonData(report).write(to: outputReport, options: .atomic)
    return report
}

@MainActor private func importPair(photo: URL, video: URL, report: [String: Any]) async throws -> [String: Any] {
    guard report["success"] as? Bool == true else { throw fail("unverified_pair", "文件或系统解码检查未通过，未写入相册。") }
    // This branch is reachable only through the explicit `import` subcommand.
    let app = NSApplication.shared
    app.setActivationPolicy(.accessory)
    app.activate(ignoringOtherApps: true)
    let authorization = await PHPhotoLibrary.requestAuthorization(for: .readWrite)
    guard authorization == .authorized || authorization == .limited else {
        throw fail("photos_permission_denied", "没有相册读写权限；未导入。请在系统设置的隐私与安全性中检查“照片”权限。")
    }
    var identifier: String?
    try await PHPhotoLibrary.shared().performChanges {
        let request = PHAssetCreationRequest.forAsset()
        request.addResource(with: .photo, fileURL: photo, options: nil)
        request.addResource(with: .pairedVideo, fileURL: video, options: nil)
        identifier = request.placeholderForCreatedAsset?.localIdentifier
    }
    guard let identifier else { throw fail("import_identifier_missing", "导入操作完成，但无法取得新资产标识；请检查相册，勿立即重复导入。") }
    let created = PHAsset.fetchAssets(withLocalIdentifiers: [identifier], options: nil).firstObject
    let recognized = created?.mediaSubtypes.contains(.photoLive) == true
    var result = report
    result["operation"] = "import"
    result["success"] = recognized
    result["photos_library"] = ["status": recognized ? "imported_live_photo" : "imported_unverified",
                               "local_identifier": identifier, "photo_live_subtype": recognized,
                               "message": "本次已添加一个相册资产；重复运行 import 会再次添加。"]
    return result
}

@main struct LivePhotoTool {
    static func main() async {
        let raw = Array(CommandLine.arguments.dropFirst())
        var resultURL: URL?
        if let index = raw.firstIndex(of: "--result-json"), index + 1 < raw.count { resultURL = fileURL(raw[index + 1]) }
        if raw.isEmpty || raw == ["--help"] || raw == ["help"] {
            output(["success": true, "requires": "macOS 26+, Apple Command Line Tools 26+",
                    "commands": ["pack --photo cover.png --video motion.mp4 --output directory --name photo --key-time 1.5",
                                 "verify --photo photo.jpg --video photo.mov", "import --photo photo.jpg --video photo.mov"],
                    "note": "pack/verify 不写入相册；只有 import 会请求权限并添加资产。"], to: resultURL)
            return
        }
        do {
            let args = try Arguments(raw)
            let report: [String: Any]
            switch args.command {
            case "pack": report = try await pack(args)
            case "verify": report = try await verify(photo: fileURL(args["--photo"]), video: fileURL(args["--video"]))
            default:
                let photo = fileURL(args["--photo"]), video = fileURL(args["--video"])
                let verified = try await verify(photo: photo, video: video)
                report = try await importPair(photo: photo, video: video, report: verified)
            }
            output(report, to: resultURL)
            exit(report["success"] as? Bool == true ? 0 : 3)
        } catch {
            output(["schema_version": 1, "success": false,
                    "error_code": (error as? ToolError)?.code ?? "native_error",
                    "message": error.localizedDescription,
                    "iphone_playback": ["status": "not_tested"]], to: resultURL)
            exit(2)
        }
    }
}
