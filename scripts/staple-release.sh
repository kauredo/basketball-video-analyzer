#!/usr/bin/env bash
set -euo pipefail

cd "$1"
shopt -s nullglob
dmgs=(./dmg/*/*.dmg)
zips=(./zip/darwin/*/*.zip)
if [[ ${#dmgs[@]} -ne 1 || ${#zips[@]} -ne 1 ]]; then
  echo "Expected one DMG and one ZIP in the macOS artifact" >&2
  exit 1
fi

submission=$(jq -er '.id | strings | select(test("^[a-fA-F0-9-]{36}$"))' notarization.json)
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT
key="$work/AuthKey.p8"
(umask 077; printf '%s' "$APPLE_API_KEY_BASE64" | base64 -d > "$key")
auth=(--key "$key" --key-id "$APPLE_API_KEY_ID" --issuer "$APPLE_API_ISSUER")
if ! xcrun notarytool wait "$submission" "${auth[@]}" --timeout 55m; then
  echo "The notarization wait did not finish successfully." >&2
fi
status=$(xcrun notarytool info "$submission" "${auth[@]}" --output-format json | jq -er .status)
if [[ "$status" != Accepted ]]; then
  echo "Notarization status: $status. Rerun failed jobs if Apple is still processing." >&2
  if [[ "$status" == Invalid || "$status" == Rejected ]]; then
    xcrun notarytool log "$submission" "${auth[@]}"
  fi
  exit 1
fi

xcrun stapler staple "${dmgs[0]}"
xcrun stapler validate "${dmgs[0]}"
ditto -x -k "${zips[0]}" "$work/app"
apps=("$work"/app/*.app)
if [[ ${#apps[@]} -ne 1 ]]; then
  echo "Expected one app bundle in the macOS ZIP" >&2
  exit 1
fi
xcrun stapler staple "${apps[0]}"
xcrun stapler validate "${apps[0]}"
ditto -c -k --sequesterRsrc --keepParent "${apps[0]}" "$work/stapled.zip"
mv "$work/stapled.zip" "${zips[0]}"
rm notarization.json
