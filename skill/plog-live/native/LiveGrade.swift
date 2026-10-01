import Foundation
import AVFoundation
import CoreImage
import AppKit
import ImageIO
import UniformTypeIdentifiers

func problem(_ s:String)->NSError{NSError(domain:"PlogLive",code:1,userInfo:[NSLocalizedDescriptionKey:s])}
let context=CIContext(options:[.workingColorSpace:CGColorSpace(name:CGColorSpace.sRGB)!,.outputColorSpace:CGColorSpace(name:CGColorSpace.sRGB)!])
func output(_ o:[String:Any])throws{FileHandle.standardOutput.write(try JSONSerialization.data(withJSONObject:o,options:[.prettyPrinted,.sortedKeys]));print("")}
func captionImage(_ text:String,_ size:CGSize,_ spec:[String:Any])throws->CIImage{
 let x=spec["x"] as? Double ?? -1,y=spec["y"] as? Double ?? -1,f=spec["fontFraction"] as? Double ?? 0.022
 guard x>=0 && x<1 && y>=0 && y<1 && f>=0.008 && f<=0.04 else{throw problem("文案位置需使用0–1坐标，字号比例0.008–0.04")}
 let attributes:[NSAttributedString.Key:Any]=[.font:NSFont(name:"Times New Roman",size:size.width*f) ?? NSFont.systemFont(ofSize:size.width*f),.foregroundColor:NSColor.white]
 let s=text as NSString,measure=s.size(withAttributes:attributes)
 guard x*size.width+measure.width<=size.width && y*size.height+measure.height<=size.height else{throw problem("英文文案超出完整画面")}
 let bitmap=NSBitmapImageRep(bitmapDataPlanes:nil,pixelsWide:Int(size.width),pixelsHigh:Int(size.height),bitsPerSample:8,samplesPerPixel:4,hasAlpha:true,isPlanar:false,colorSpaceName:.deviceRGB,bytesPerRow:0,bitsPerPixel:0)!
 NSGraphicsContext.saveGraphicsState();NSGraphicsContext.current=NSGraphicsContext(bitmapImageRep:bitmap)
 s.draw(at:NSPoint(x:x*size.width,y:size.height-y*size.height-measure.height),withAttributes:attributes)
 NSGraphicsContext.restoreGraphicsState();return CIImage(cgImage:bitmap.cgImage!)
}
func fixedGrade(_ image:CIImage,_ exposure:Double,_ region:[String:Any]?)->CIImage{
 var result=image.applyingFilter("CIExposureAdjust",parameters:[kCIInputEVKey:exposure])
 result=result.applyingFilter("CIToneCurve",parameters:["inputPoint0":CIVector(x:0,y:0),"inputPoint1":CIVector(x:0.25,y:0.15),"inputPoint2":CIVector(x:0.5,y:0.41),"inputPoint3":CIVector(x:0.75,y:0.73),"inputPoint4":CIVector(x:1,y:0.99)])
 result=result.applyingFilter("CIColorControls",parameters:[kCIInputSaturationKey:0.90])
 result=result.applyingFilter("CITemperatureAndTint",parameters:["inputNeutral":CIVector(x:6500,y:0),"inputTargetNeutral":CIVector(x:6250,y:0)])
 // A single fixed broad light region; never re-detect or move exposure per frame.
 if let r=region,let x=r["x"] as? Double,let y=r["y"] as? Double,let radius=r["radius"] as? Double,let gain=r["ev"] as? Double{
 let e=image.extent,center=CIVector(x:e.minX+x*e.width,y:e.minY+(1-y)*e.height)
 let mask=CIFilter(name:"CIRadialGradient",parameters:["inputCenter":center,"inputRadius0":radius*e.width*0.25,"inputRadius1":radius*e.width,"inputColor0":CIColor.white,"inputColor1":CIColor.clear])!.outputImage!.cropped(to:e)
 result=result.applyingFilter("CIExposureAdjust",parameters:[kCIInputEVKey:gain]).applyingFilter("CIBlendWithMask",parameters:[kCIInputBackgroundImageKey:result,kCIInputMaskImageKey:mask])
 }
 return result
}
@main struct Main{
 static func main()async{do{try await work()}catch{fputs("\(error.localizedDescription)\n",stderr);exit(1)}}
 static func work()async throws{
 if CommandLine.arguments.count==3 && CommandLine.arguments[1]=="image-info" {
 let url=URL(fileURLWithPath:CommandLine.arguments[2])
 guard let src=CGImageSourceCreateWithURL(url as CFURL,nil),let props=CGImageSourceCopyPropertiesAtIndex(src,0,nil) as? [CFString:Any],let w=props[kCGImagePropertyPixelWidth] as? Int,let h=props[kCGImagePropertyPixelHeight] as? Int else{throw problem("图片无法读取")}
 let o=props[kCGImagePropertyOrientation] as? Int ?? 1
 try output(["width":[5,6,7,8].contains(o) ? h:w,"height":[5,6,7,8].contains(o) ? w:h,"orientation":o]);return
 }
 if CommandLine.arguments.count==5 && CommandLine.arguments[1]=="frame" {
 let asset=AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[2])),g=AVAssetImageGenerator(asset:AVURLAsset(url:URL(fileURLWithPath:CommandLine.arguments[2])))
 g.appliesPreferredTrackTransform=true;g.apertureMode = .cleanAperture;g.requestedTimeToleranceBefore = .zero;g.requestedTimeToleranceAfter = .zero
 let t=Double(CommandLine.arguments[3]) ?? 0,frame=try await g.image(at:CMTime(seconds:t,preferredTimescale:60000))
 let dest=URL(fileURLWithPath:CommandLine.arguments[4]);guard !FileManager.default.fileExists(atPath:dest.path) else{throw problem("输出已存在")}
 try context.writePNGRepresentation(of:CIImage(cgImage:frame.image),to:dest,format:.RGBA8,colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!)
 try output(["keyTime":frame.actualTime.seconds,"width":frame.image.width,"height":frame.image.height,"duration":try await asset.load(.duration).seconds]);return
 }

 if CommandLine.arguments.count==5 && CommandLine.arguments[1]=="overlay-cover"{
 guard let cover=CIImage(contentsOf:URL(fileURLWithPath:CommandLine.arguments[2]),options:[.applyOrientationProperty:true]),let overlay=CIImage(contentsOf:URL(fileURLWithPath:CommandLine.arguments[3])) else{throw problem("原实况封面或装饰层无法解码")}
 let scale=min(cover.extent.width/overlay.extent.width,cover.extent.height/overlay.extent.height)
 let layer=overlay.transformed(by:CGAffineTransform(scaleX:scale,y:scale))
 let aligned=layer.transformed(by:CGAffineTransform(translationX:(cover.extent.width-layer.extent.width)/2,y:(cover.extent.height-layer.extent.height)/2))
 let dest=URL(fileURLWithPath:CommandLine.arguments[4]);guard !FileManager.default.fileExists(atPath:dest.path) else{throw problem("输出已经存在")}
 try context.writePNGRepresentation(of:aligned.composited(over:cover),to:dest,format:.RGBA8,colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!);return
 }
 guard CommandLine.arguments.count==3 else{throw problem("用法：live-grade 配置.json 新输出目录")}
 let spec=try JSONSerialization.jsonObject(with:Data(contentsOf:URL(fileURLWithPath:CommandLine.arguments[1]))) as! [String:Any]
 let dir=URL(fileURLWithPath:CommandLine.arguments[2],isDirectory:true)
 guard !FileManager.default.fileExists(atPath:dir.path) else{throw problem("输出目录已存在")}
 guard let video=spec["video"] as? String,let photo=spec["photo"] as? String,let text=spec["caption"] as? String,let label=spec["captionLayout"] as? [String:Any],spec["reviewedWholeClip"] as? Bool == true else{throw problem("缺少原实况资源、文案和整段留白确认")}
 if let r=spec["lightRegion"] as? [String:Any]{
 guard let x=r["x"] as? Double,let y=r["y"] as? Double,let radius=r["radius"] as? Double,let gain=r["ev"] as? Double,
 x.isFinite && y.isFinite && radius.isFinite && gain.isFinite && x>=0 && x<=1 && y>=0 && y<=1 && radius>0 && radius<=1 && gain>=0 && gain<=0.5 else{throw problem("固定受光区域参数无效；位置0–1、半径0–1、提亮0–0.5")}
 }
 let asset=AVURLAsset(url:URL(fileURLWithPath:video));guard let track=try await asset.loadTracks(withMediaType:.video).first else{throw problem("没有视频轨道")}
 let duration=try await asset.load(.duration),natural=try await track.load(.naturalSize),transform=try await track.load(.preferredTransform)
 let display=CGRect(origin:.zero,size:natural).applying(transform),width=abs(display.width),height=abs(display.height)
 guard width>=64 && height>=64 && width<=4096 && height<=4096 else{throw problem("暂不支持这组视频尺寸")}
 // No resizing or reframing. Odd sizes are padded by at most one pixel.
 let size=CGSize(width:ceil(width/2)*2,height:ceil(height/2)*2)
 let generator=AVAssetImageGenerator(asset:asset);generator.appliesPreferredTrackTransform=true;generator.apertureMode = .cleanAperture;generator.requestedTimeToleranceBefore = .zero;generator.requestedTimeToleranceAfter = .zero
 var lumas:[Double]=[]
 let sampleCount=max(5,min(120,Int(ceil(duration.seconds*10))))
 for i in 0..<sampleCount{
 let time=CMTime(seconds:duration.seconds*Double(i)/Double(sampleCount),preferredTimescale:60000)
 let frame=try await generator.image(at:time).image,ci=CIImage(cgImage:frame)
 let average=ci.applyingFilter("CIAreaAverage",parameters:[kCIInputExtentKey:CIVector(cgRect:ci.extent)])
 var px=[UInt8](repeating:0,count:4);context.render(average,toBitmap:&px,rowBytes:4,bounds:CGRect(x:0,y:0,width:1,height:1),format:.RGBA8,colorSpace:CGColorSpace(name:CGColorSpace.sRGB))
 lumas.append((0.2126*Double(px[0])+0.7152*Double(px[1])+0.0722*Double(px[2]))/255)
 }
 let median=lumas.sorted()[lumas.count/2],exposure=max(-0.15,min(0.25,(0.32-median)*0.7)),region=spec["lightRegion"] as? [String:Any]
 let skip=spec["alreadyStyled"] as? Bool ?? false
 let labelImage=try captionImage(text,size,label)
 let reader=try AVAssetReader(asset:asset),readerOutput=AVAssetReaderTrackOutput(track:track,outputSettings:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA])
 readerOutput.alwaysCopiesSampleData=false;reader.add(readerOutput)
 try FileManager.default.createDirectory(at:dir,withIntermediateDirectories:false)
 let writer=try AVAssetWriter(outputURL:dir.appendingPathComponent("graded-silent.mov"),fileType:.mov)
 let input=AVAssetWriterInput(mediaType:.video,outputSettings:[AVVideoCodecKey:AVVideoCodecType.h264,AVVideoWidthKey:Int(size.width),AVVideoHeightKey:Int(size.height),AVVideoColorPropertiesKey:[AVVideoColorPrimariesKey:AVVideoColorPrimaries_ITU_R_709_2,AVVideoTransferFunctionKey:AVVideoTransferFunction_ITU_R_709_2,AVVideoYCbCrMatrixKey:AVVideoYCbCrMatrix_ITU_R_709_2]])
 let adaptor=AVAssetWriterInputPixelBufferAdaptor(assetWriterInput:input,sourcePixelBufferAttributes:[kCVPixelBufferPixelFormatTypeKey as String:kCVPixelFormatType_32BGRA,kCVPixelBufferWidthKey as String:Int(size.width),kCVPixelBufferHeightKey as String:Int(size.height),kCVPixelBufferIOSurfacePropertiesKey as String:[:]])
 writer.add(input);guard writer.startWriting(),reader.startReading()else{throw writer.error ?? reader.error ?? problem("无法启动苹果视频处理")};writer.startSession(atSourceTime:.zero)
 var timestamps:[Double]=[]
 while let sample=readerOutput.copyNextSampleBuffer(){
 guard CMSampleBufferGetImageBuffer(sample) != nil,let pool=adaptor.pixelBufferPool else{throw problem("无法解码像素")}
 let t=CMSampleBufferGetPresentationTimeStamp(sample)
 let decoded=try await generator.image(at:t)
 guard abs(decoded.actualTime.seconds-t.seconds)<0.002 else{throw problem("原帧时间不一致，停止而不是重复画面")}
 var image=CIImage(cgImage:decoded.image)
 guard abs(image.extent.width-width)<2 && abs(image.extent.height-height)<2 else{throw problem("苹果显示尺寸不一致，停止而不是裁边")}
 image=image.transformed(by:CGAffineTransform(translationX:-image.extent.minX,y:-image.extent.minY))
 if !skip{image=fixedGrade(image,exposure,region);image=labelImage.composited(over:image)}
 image=image.composited(over:CIImage(color:.black).cropped(to:CGRect(origin:.zero,size:size)))
 var dest:CVPixelBuffer?;guard CVPixelBufferPoolCreatePixelBuffer(nil,pool,&dest)==kCVReturnSuccess,let dest else{throw problem("无法创建输出像素")}
 context.render(image,to:dest,bounds:CGRect(origin:.zero,size:size),colorSpace:CGColorSpace(name:CGColorSpace.sRGB))
 var spins=0;while !input.isReadyForMoreMediaData{if writer.status == .failed || spins>10000{throw writer.error ?? problem("视频写入等待超时")};try await Task.sleep(nanoseconds:1_000_000);spins+=1}
 guard adaptor.append(dest,withPresentationTime:t) else{throw writer.error ?? problem("视频帧写入失败")};timestamps.append(t.seconds)
 }
 guard reader.status == .completed else{throw reader.error ?? problem("原视频未完整解码")}
 input.markAsFinished();writer.endSession(atSourceTime:duration);await writer.finishWriting();guard writer.status == .completed else{throw writer.error ?? problem("视频未完整输出")}
 guard var cover=CIImage(contentsOf:URL(fileURLWithPath:photo),options:[.applyOrientationProperty:true]) else{throw problem("原封面无法解码")}
 cover=cover.transformed(by:CGAffineTransform(translationX:-cover.extent.minX,y:-cover.extent.minY))
 if !skip{cover=fixedGrade(cover,exposure,region);cover=try captionImage(text,cover.extent.size,label).composited(over:cover)}
 try context.writePNGRepresentation(of:cover,to:dir.appendingPathComponent("cover.png"),format:.RGBA8,colorSpace:CGColorSpace(name:CGColorSpace.sRGB)!)
 let report:[String:Any]=["duration":duration.seconds,"width":Int(size.width),"height":Int(size.height),"timestamps":timestamps,"sampledLuminance":lumas,"fixedExposure":exposure,"alreadyStyled":skip,"profile":"quiet-video-sdr-v2", "colorManagement":"Apple decoded source profile (Display P3 or Rec709) to sRGB/Rec709 SDR", "displayAperture":"source clean aperture and preferred orientation preserved","fullFrame":true,"originalCameraMotionPreserved":true,"fixedGradeAllFrames":true,"styleMatch":"待真实原Live与静态风格对照验收","iphone":"未验证"]
 try JSONSerialization.data(withJSONObject:report,options:[.prettyPrinted,.sortedKeys]).write(to:dir.appendingPathComponent("native-report.json"));try output(report)
 }
}
