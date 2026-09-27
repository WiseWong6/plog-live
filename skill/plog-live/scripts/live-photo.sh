#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
NATIVE_DIR="$(cd -- "$SCRIPT_DIR/../native" && pwd)"
APP="$NATIVE_DIR/.build/LivePhotoTool.app"
BINARY="$APP/Contents/MacOS/live-photo"

die() { printf '%s\n' "$1" >&2; exit 2; }
[[ "$(uname -s)" == Darwin ]] || die '苹果实况封装工具只能在 macOS 上运行。'
OS_MAJOR="$(sw_vers -productVersion | cut -d. -f1)"
(( OS_MAJOR >= 26 )) || die '此工具使用苹果新的媒体接口，需要 macOS 26 或更高版本。'

# Prefer an explicitly selected toolchain, otherwise the separately installed
# Command Line Tools. This changes neither xcode-select nor license settings.
if [[ -n "${PLOG_NATIVE_DEVELOPER_DIR:-}" ]]; then
  NATIVE_DEV="$PLOG_NATIVE_DEVELOPER_DIR"
elif [[ -n "${DEVELOPER_DIR:-}" ]]; then
  NATIVE_DEV="$DEVELOPER_DIR"
elif [[ -x /Library/Developer/CommandLineTools/usr/bin/swiftc ]]; then
  NATIVE_DEV=/Library/Developer/CommandLineTools
else
  NATIVE_DEV="$(xcode-select -p)"
fi

if [[ ! -x "$BINARY" || "$NATIVE_DIR/LivePhotoTool.swift" -nt "$BINARY" || "$NATIVE_DIR/Info.plist" -nt "$BINARY" ]]; then
  SWIFTC="$(DEVELOPER_DIR="$NATIVE_DEV" xcrun --find swiftc)" || die '找不到可用的 Apple Swift 编译器；没有安装或修改任何工具。'
  SDK="$(DEVELOPER_DIR="$NATIVE_DEV" xcrun --show-sdk-path)" || die '找不到 macOS SDK。'
  mkdir -p "$APP/Contents/MacOS" "$NATIVE_DIR/.build/module-cache"
  cp "$NATIVE_DIR/Info.plist" "$APP/Contents/Info.plist"
  DEVELOPER_DIR="$NATIVE_DEV" "$SWIFTC" -parse-as-library -swift-version 5 -O \
    -target "$(uname -m)-apple-macosx26.0" -sdk "$SDK" \
    -module-cache-path "$NATIVE_DIR/.build/module-cache" \
    "$NATIVE_DIR/LivePhotoTool.swift" -o "$BINARY"
  codesign --force --sign - "$APP" >/dev/null 2>&1
fi

if [[ "${1:-}" == import ]]; then
  # Launch the application bundle so the Photos permission prompt has a stable
  # identity and usage description. No import happens for pack or verify.
  IMPORT_WORK="$(mktemp -d "${TMPDIR:-/tmp}/plog-live-import.XXXXXX")"
  RESULT="$IMPORT_WORK/result.json"
  cleanup_import() {
    for temporary in "$IMPORT_WORK/photo.jpg" "$IMPORT_WORK/motion.mov" "$RESULT"; do
      if [[ -f "$temporary" ]]; then rm -- "$temporary"; fi
    done
    rmdir -- "$IMPORT_WORK"
  }
  trap cleanup_import EXIT
  IMPORT_ARGS=("$@")
  for (( i=0; i<${#IMPORT_ARGS[@]}; i++ )); do
    if [[ "${IMPORT_ARGS[$i]}" == --photo || "${IMPORT_ARGS[$i]}" == --video ]]; then
      (( i + 1 < ${#IMPORT_ARGS[@]} )) || die '导入参数缺少文件路径。'
      value="${IMPORT_ARGS[$((i + 1))]}"
      if [[ "$value" == '~/'* ]]; then value="$HOME/${value:2}"; fi
      if [[ "$value" != /* ]]; then value="$PWD/$value"; fi
      [[ -r "$value" && -f "$value" ]] || die "无法读取输入文件：$value"
      # The caller already has access to the selected files. Give the helper
      # only copies of this pair; it does not need access to Documents folders.
      if [[ "${IMPORT_ARGS[$i]}" == --photo ]]; then staged="$IMPORT_WORK/photo.jpg"; else staged="$IMPORT_WORK/motion.mov"; fi
      cp -- "$value" "$staged"
      IMPORT_ARGS[$((i + 1))]="$staged"
    fi
  done
  open -W -n "$APP" --args "${IMPORT_ARGS[@]}" --result-json "$RESULT"
  [[ -s "$RESULT" ]] || die '相册导入程序没有返回结果；请先检查相册，勿立即重复导入。'
  cat "$RESULT"
  # JSONSerialization emits this top-level field with stable two-space indent.
  # plutil accepts property-list input, so do not use it to parse this JSON.
  /usr/bin/grep -Eq '^  "success" : true,?$' "$RESULT" || exit 3
else
  exec "$BINARY" "$@"
fi
