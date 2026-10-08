#!/usr/bin/env bash
# Downloads the binaries YouTube import runs into node_modules/youtube-dl-exec/bin,
# which packaging unpacks from the asar. CI runs it with RUNNER_OS and RUNNER_ARCH set.
set -euo pipefail

BIN=node_modules/youtube-dl-exec/bin
mkdir -p "$BIN"
AUTH=()
if [ -n "${GITHUB_TOKEN:-}" ]; then AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN"); fi
fetch() { curl -fsSL --proto '=https' ${AUTH[@]+"${AUTH[@]}"} "$1" -o "$2"; }
sha256() { (sha256sum "$1" 2>/dev/null || shasum -a 256 "$1") | cut -d' ' -f1 | tr -d '\\'; }

# The plain "yt-dlp" asset is a Python zipapp that needs Python 3.10+, which
# macOS does not ship. These are standalone builds.
case "$RUNNER_OS" in
  Windows) YTDLP=yt-dlp.exe; EXE=.exe ;;
  macOS) YTDLP=yt-dlp_macos; EXE= ;;
  *) YTDLP=yt-dlp_linux; EXE= ;;
esac
YTDLP_BASE=https://github.com/yt-dlp/yt-dlp/releases/latest/download
fetch "$YTDLP_BASE/$YTDLP" "$BIN/yt-dlp$EXE"
fetch "$YTDLP_BASE/SHA2-256SUMS" yt-dlp-sums.txt
EXPECTED=$(grep " $YTDLP\$" yt-dlp-sums.txt | cut -d' ' -f1)
if [ -z "$EXPECTED" ] || [ "$EXPECTED" != "$(sha256 "$BIN/yt-dlp$EXE")" ]; then
  echo "yt-dlp checksum mismatch for $YTDLP"
  exit 1
fi

# yt-dlp needs a JavaScript runtime to solve YouTube's challenges. Deno runs
# them with no file, network or command access. Pinned to the SHA-256 GitHub
# records for each release asset.
DENO_VERSION=v2.9.7
case "$RUNNER_OS-$RUNNER_ARCH" in
  macOS-ARM64) DENO_ZIP=deno-aarch64-apple-darwin.zip; DENO_SUM=5cd46d6268f6f78f5d88bdc7159d20bd44cdaa4b3303474839f87ec6fe7ae25c ;;
  macOS-X64) DENO_ZIP=deno-x86_64-apple-darwin.zip; DENO_SUM=95daaff11c116a52ad54785e7914c8e9c9cdcaba793c5ed929c74ca2d8e6259a ;;
  Linux-X64) DENO_ZIP=deno-x86_64-unknown-linux-gnu.zip; DENO_SUM=c6527f24f4b16031d3ae4fa9f658d5f11534c8d84ce7dc8502420280919c3490 ;;
  Windows-X64) DENO_ZIP=deno-x86_64-pc-windows-msvc.zip; DENO_SUM=a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238 ;;
  *) echo "No deno build for $RUNNER_OS-$RUNNER_ARCH"; exit 1 ;;
esac
fetch "https://github.com/denoland/deno/releases/download/$DENO_VERSION/$DENO_ZIP" deno.zip
if [ "$DENO_SUM" != "$(sha256 deno.zip)" ]; then
  echo "deno checksum mismatch for $DENO_ZIP"
  exit 1
fi
unzip -oq deno.zip -d "$BIN" 2>/dev/null || tar -xf deno.zip -C "$BIN"

chmod +x "$BIN/yt-dlp$EXE" "$BIN/deno$EXE"
rm -f deno.zip yt-dlp-sums.txt
