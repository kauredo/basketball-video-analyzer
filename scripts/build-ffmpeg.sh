#!/usr/bin/env bash
# Rebuild from an extracted source archive with: bash build-ffmpeg.sh "$PWD"

set -euo pipefail

cd "$(dirname "$0")"
script="$PWD/build-ffmpeg.sh"
output="${FFMPEG_OUTPUT_DIR:-$PWD/../out/ffmpeg}"
mkdir -p "$output"
output="$(cd "$output" && pwd)"
sources="${1:-$output/sources}"
mkdir -p "$sources"
sources="$(cd "$sources" && pwd)"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

ffmpeg="ffmpeg-8.1.3"
x264="x264-31e19f92f00c7003fa115047ce50978bc98c3a0d"
zlib="zlib-1.4"
checksum=(sha256sum)
if ! command -v sha256sum >/dev/null; then
  checksum=(shasum -a 256)
fi
fetch() {
  local filename="${1##*/}"
  if [[ ! -f "$sources/$filename" ]]; then
    curl --fail --location --retry 3 "$1" -o "$sources/$filename.part"
    mv "$sources/$filename.part" "$sources/$filename"
  fi
  (cd "$sources" && printf '%s  %s\n' "$2" "$filename" | "${checksum[@]}" -c -)
  tar -xf "$sources/$filename" -C "$work"
}
fetch "https://ffmpeg.org/releases/$ffmpeg.tar.xz" \
  7138d28c96d9d3e3af4ee3d8cad72741f8ffb40da90c1112235dea3ecd3178a3
fetch "https://code.videolan.org/videolan/x264/-/archive/${x264#x264-}/$x264.tar.gz" \
  d053c9d86988d6bc78237ca5205865c5ddf99c98ef4cd9927eec8f6d388f6dd9
# zlib.net answers some CI runner addresses with a small HTML page; the
# release asset on GitHub is the same tarball.
fetch "https://github.com/madler/zlib/releases/download/v${zlib#zlib-}/$zlib.tar.gz" \
  02dd159783677a749c04adbdd02b55b8a2bcc7e054f51b76b549199a916ad584

jobs="$(getconf _NPROCESSORS_ONLN)"
prefix="$work/deps"
binary=ffmpeg
generator="Unix Makefiles"
ldflags=()
case "$(uname -s)" in
  Darwin) export MACOSX_DEPLOYMENT_TARGET=11.0 ;;
  Linux) ldflags=(--extra-ldflags=-static) ;;
  MINGW*|MSYS*)
    binary=ffmpeg.exe
    generator=Ninja
    prefix="$(cd "$work" && pwd -W)/deps"
    ldflags=(--extra-ldflags=-static)
    ;;
esac

cd "$work/$x264"
./configure --prefix="$prefix" --enable-static --disable-cli
make -j "$jobs"
make install

cmake -S "$work/$zlib" -B "$work/zlib-build" -G "$generator" \
  -DCMAKE_BUILD_TYPE=Release -DCMAKE_INSTALL_PREFIX="$prefix" -DCMAKE_INSTALL_LIBDIR=lib \
  -DZLIB_BUILD_SHARED=OFF -DZLIB_BUILD_TESTING=OFF
cmake --build "$work/zlib-build" --parallel "$jobs"
cmake --install "$work/zlib-build"
if [[ "$binary" == "ffmpeg.exe" ]]; then
  # The Windows static library is libzs.a, but zlib.pc asks for -lz.
  /bin/cp -f "$prefix/lib/libzs.a" "$prefix/lib/libz.a"
fi

cd "$work/$ffmpeg"
PKG_CONFIG_LIBDIR="$prefix/lib/pkgconfig" ./configure \
  --disable-autodetect --enable-gpl --enable-version3 --enable-libx264 --enable-zlib \
  --disable-doc --disable-debug --disable-ffplay --disable-ffprobe \
  --pkg-config-flags=--static ${ldflags[@]+"${ldflags[@]}"}
make -j "$jobs"
"./$binary" -hide_banner -f lavfi -i testsrc2=size=64x64:rate=5 \
  -frames:v 2 -c:v libx264 -y "$work/fixture.mp4"
"./$binary" -hide_banner -i "$work/fixture.mp4" -frames:v 1 -y "$work/overlay.png"
"./$binary" -hide_banner -i "$work/fixture.mp4" -i "$work/overlay.png" \
  -filter_complex overlay -frames:v 1 -y "$work/composited.png"
"./$binary" -hide_banner -i "$work/fixture.mp4" -c copy -f null -

/bin/cp -f "$binary" "$output/$binary"
/bin/cp -f COPYING.GPLv3 "$output/FFmpeg-COPYING"
/bin/cp -f "$work/$x264/COPYING" "$output/x264-COPYING"
/bin/cp -f "$work/$zlib/LICENSE" "$output/zlib-LICENSE"
/bin/cp -f LICENSE.md "$output/FFmpeg-LICENSE.md"
tar -czf "$output/ffmpeg-source.tar.gz" -C "$sources" "$ffmpeg.tar.xz" "$x264.tar.gz" "$zlib.tar.gz" \
  -C "$(dirname "$script")" build-ffmpeg.sh -C "$output" FFmpeg-COPYING x264-COPYING zlib-LICENSE FFmpeg-LICENSE.md
