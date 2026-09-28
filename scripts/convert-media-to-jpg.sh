#!/usr/bin/env bash
# Migration step 1 — convert media masters to JPEG on disk, plus a verification pass. Kept for future batches.
#
#   bash scripts/convert-media-to-jpg.sh
#
# - Source  /mnt/Big_D/LGL Project Media/   (originals are never modified or deleted)
# - Output  /mnt/Big_D/LGL JPG/             (mirrors the subfolder names, .png -> .jpg, other files copied)
# - Skips   Logo/ (brand assets live in the repo's public/)
# - Recipe  magick <in> -auto-orient -colorspace sRGB -depth 8 -strip -quality 95 -interlace Plane <out>
# - Writes  /tmp/lgl-convert.log (progress + summary) and /tmp/lgl-convert.csv (per-file results)
#
# Idempotent: re-running overwrites outputs; nothing here touches R2 or the database.

set -uo pipefail

SRC="/mnt/Big_D/LGL Project Media"
OUT="/mnt/Big_D/LGL JPG"
LOG="/tmp/lgl-convert.log"
CSV="/tmp/lgl-convert.csv"
SKIP_DIR="Logo"
JOBS=4

: > "$LOG"
echo "src,out,status,src_bytes,out_bytes,src_dims,out_dims" > "$CSV"

dims() { magick identify -format '%wx%h' "$1" 2>/dev/null; }
nbytes() { stat -c%s "$1"; }

convert_one() {
  local src="$1"
  local rel="${src#"$SRC"/}"
  local dir out is_png=0
  dir="$(dirname "$rel")"
  case "${rel%%/*}" in "$SKIP_DIR") return 0 ;; esac
  mkdir -p "$OUT/$dir"
  case "${src,,}" in
    *.png) out="$OUT/${rel%.*}.jpg"; is_png=1 ;;
    *)     out="$OUT/$rel" ;;
  esac
  if [ -e "$out" ]; then
    echo "skip  $rel" >> "$LOG"
    return 0
  fi
  if [ "$is_png" = 1 ]; then
    if magick "$src" -auto-orient -colorspace sRGB -depth 8 -strip -quality 95 -interlace Plane "$out" 2>>"$LOG"; then
      local sd od
      sd="$(dims "$src")"; od="$(dims "$out")"
      if [ "$sd" = "$od" ]; then
        printf '%s,%s,converted,%s,%s,%s,%s\n' "$rel" "${out#"$OUT"/}" "$(nbytes "$src")" "$(nbytes "$out")" "$sd" "$od" >> "$CSV"
        echo "ok    $rel -> ${out#"$OUT"/}  $sd" >> "$LOG"
      else
        printf '%s,%s,DIM_MISMATCH,%s,%s,%s,%s\n' "$rel" "${out#"$OUT"/}" "$(nbytes "$src")" "$(nbytes "$out")" "$sd" "$od" >> "$CSV"
        echo "DIM   $rel  $sd -> $od" >> "$LOG"
      fi
    else
      printf '%s,%s,FAILED,%s,,,\n' "$rel" "${out#"$OUT"/}" "$(nbytes "$src")" >> "$CSV"
      echo "FAIL  $rel" >> "$LOG"
    fi
  else
    if cp -p "$src" "$out"; then
      printf '%s,%s,copied,%s,%s,%s,%s\n' "$rel" "${out#"$OUT"/}" "$(nbytes "$src")" "$(nbytes "$out")" "$(dims "$src")" "$(dims "$out")" >> "$CSV"
      echo "copy  $rel" >> "$LOG"
    else
      printf '%s,%s,COPY_FAILED,%s,,,\n' "$rel" "${out#"$OUT"/}" "$(nbytes "$src")" >> "$CSV"
      echo "CFAIL $rel" >> "$LOG"
    fi
  fi
}
export -f convert_one dims nbytes
export SRC OUT LOG CSV SKIP_DIR

echo "converting $(find "$SRC" -type f -iname '*.png' -not -path "$SRC/$SKIP_DIR/*" | wc -l) PNGs into $OUT ..."
find "$SRC" -type f -not -path "$SRC/$SKIP_DIR/*" -print0 |
  xargs -0 -P "$JOBS" -n 1 bash -c 'convert_one "$1"' _ 2>>"$LOG"

echo "=== summary ==="
python3 - "$CSV" "$SRC" "$OUT" "$SKIP_DIR" <<'PY'
import csv, os, sys
csv_path, src, out, skip = sys.argv[1], sys.argv[2], sys.argv[3], sys.argv[4]
rows = list(csv.DictReader(open(csv_path)))
by = {}
for r in rows:
    by.setdefault(r["status"], []).append(r)
print("per status:", {k: len(v) for k, v in sorted(by.items())})
src_b = sum(int(r["src_bytes"]) for r in rows if r["src_bytes"])
out_b = sum(int(r["out_bytes"]) for r in rows if r["out_bytes"])
mb = lambda b: f"{b/1048576:.1f} MB"
print(f"bytes in {mb(src_b)} -> out {mb(out_b)}  ({100*out_b/src_b:.1f}%)")
bad = by.get("FAILED", []) + by.get("DIM_MISMATCH", []) + by.get("COPY_FAILED", [])
for r in bad[:15]:
    print("  !", r["src"], r["status"], r["src_dims"], "->", r["out_dims"])

def count(root):
    n = 0
    for base, _dirs, files in os.walk(root):
        first = os.path.relpath(base, root).split(os.sep)[0]
        if first == skip:
            continue
        n += len(files)
    return n

print(f"files: source {count(src)} (excl. {skip}/) -> output {count(out)}")
print("per-dir converted bytes (top 6):")
conv = {}
for r in rows:
    top = r["src"].split("/")[0]
    conv[top] = conv.get(top, 0) + int(r["out_bytes"] or 0)
for k, v in sorted(conv.items(), key=lambda kv: -kv[1])[:6]:
    print(f"  {k:<22} {mb(v)}")
PY
