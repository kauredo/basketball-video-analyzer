#!/usr/bin/env bash
# Downloads the binaries YouTube import runs into node_modules/youtube-dl-exec/bin,
# which packaging unpacks from the asar. CI runs it with RUNNER_OS and RUNNER_ARCH set.
#
# Both tools are pinned to a version and to the SHA-256 GitHub records for each
# release asset. To update, bump the version and copy the new digests from the
# release's asset list.
set -euo pipefail

YTDLP_VERSION=2026.08.19
DENO_VERSION=v2.9.7

BIN=node_modules/youtube-dl-exec/bin
mkdir -p "$BIN"
AUTH=()
if [ -n "${GITHUB_TOKEN:-}" ]; then AUTH=(-H "Authorization: Bearer $GITHUB_TOKEN"); fi
fetch() { curl -fsSL --proto '=https' ${AUTH[@]+"${AUTH[@]}"} "$1" -o "$2"; }
sha256() { (sha256sum "$1" 2>/dev/null || shasum -a 256 "$1") | cut -d' ' -f1 | tr -d '\\'; }
verify() {
  if [ "$2" != "$(sha256 "$1")" ]; then
    echo "Checksum mismatch for $1"
    exit 1
  fi
}

# The plain "yt-dlp" asset is a Python zipapp that needs Python 3.10+, which
# macOS does not ship. These are standalone builds.
case "$RUNNER_OS" in
  Windows) YTDLP=yt-dlp.exe; YTDLP_SUM=66674953fe251b89f4d08c5f0e35e0728679bd67ab3d7d05c0562af101dd3e7a; EXE=.exe ;;
  macOS) YTDLP=yt-dlp_macos; YTDLP_SUM=0f192b7ec147ab6288885d6351d9ab67367640029b4377576ef46dd79cf7b202; EXE= ;;
  Linux) YTDLP=yt-dlp_linux; YTDLP_SUM=58162f9bfdc27458ea47bfcb311cf47028f17d8154a8bf7d689861d46399230a; EXE= ;;
  *) echo "No yt-dlp build for $RUNNER_OS"; exit 1 ;;
esac
fetch "https://github.com/yt-dlp/yt-dlp/releases/download/$YTDLP_VERSION/$YTDLP" "$BIN/yt-dlp$EXE"
verify "$BIN/yt-dlp$EXE" "$YTDLP_SUM"

# yt-dlp needs a JavaScript runtime to solve YouTube's challenges. Deno runs
# them with no file, network or command access.
case "$RUNNER_OS-$RUNNER_ARCH" in
  macOS-ARM64) DENO_ZIP=deno-aarch64-apple-darwin.zip; DENO_SUM=5cd46d6268f6f78f5d88bdc7159d20bd44cdaa4b3303474839f87ec6fe7ae25c ;;
  macOS-X64) DENO_ZIP=deno-x86_64-apple-darwin.zip; DENO_SUM=95daaff11c116a52ad54785e7914c8e9c9cdcaba793c5ed929c74ca2d8e6259a ;;
  Linux-X64) DENO_ZIP=deno-x86_64-unknown-linux-gnu.zip; DENO_SUM=c6527f24f4b16031d3ae4fa9f658d5f11534c8d84ce7dc8502420280919c3490 ;;
  Windows-X64) DENO_ZIP=deno-x86_64-pc-windows-msvc.zip; DENO_SUM=a0c3101b4158d1dfb7d6a78a7bf0f3de80c96bb423c152beec8beb22786f2238 ;;
  *) echo "No deno build for $RUNNER_OS-$RUNNER_ARCH"; exit 1 ;;
esac
fetch "https://github.com/denoland/deno/releases/download/$DENO_VERSION/$DENO_ZIP" deno.zip
verify deno.zip "$DENO_SUM"
# Git Bash may lack unzip, and its GNU tar cannot read zips; Windows' own
# tar.exe (bsdtar) can.
if command -v unzip >/dev/null; then
  unzip -oq deno.zip "deno$EXE" -d "$BIN"
else
  /c/Windows/System32/tar.exe -xf deno.zip -C "$BIN" "deno$EXE"
fi

chmod +x "$BIN/yt-dlp$EXE" "$BIN/deno$EXE"
rm -f deno.zip
