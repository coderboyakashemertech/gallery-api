#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<EOF
Usage: ./scan.sh [-v] <root_folder> [output.json]

Options:
  -v    Verbose mode (shows progress bar, percentage, folder, and file)
  -h    Help
EOF
}

verbose=false
while getopts ":vh" opt; do
    case "$opt" in
        v) verbose=true ;;
        h) usage; exit 0 ;;
        *) usage; exit 1 ;;
    esac
done
shift $((OPTIND - 1))

if [[ $# -lt 1 ]]; then
    usage
    exit 1
fi

ROOT="$1"
OUTPUT="${2:-media_albums.json}"

if [[ ! -d "$ROOT" ]]; then
    echo "Error: Directory '$ROOT' does not exist." >&2
    exit 1
fi

json_escape() {
    local s="$1"
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\n'/\\n}
    s=${s//$'\r'/\\r}
    s=${s//$'\t'/\\t}
    s=${s//$'\f'/\\f}
    s=${s//$'\b'/\\b}
    printf '%s' "$s"
}

draw_progress() {
    local current="$1"
    local total="$2"
    local folder="$3"
    local file="$4"

    local width=40
    local percent=0
    local filled=0
    local empty=0
    local bar

    if (( total > 0 )); then
        percent=$(( current * 100 / total ))
        filled=$(( current * width / total ))
    fi
    empty=$(( width - filled ))

    bar=$(printf '%*s' "$filled" '' | tr ' ' '#')
    bar+=$(printf '%*s' "$empty" '' | tr ' ' '-')

    printf "\r\033[K[%s] %3d%% (%d/%d) Dir: %s | File: %s" \
        "$bar" "$percent" "$current" "$total" "$folder" "$file" >&2
}

TMP_LIST=$(mktemp)

cleanup() {
    rm -f "$TMP_LIST"
}
trap cleanup EXIT

find "$ROOT" \
    \( -type d -name ".*" -prune \) -o \
    \( -type f ! -name ".*" \( \
        -iname "*.jpg"  -o -iname "*.jpeg" -o -iname "*.png"  -o \
        -iname "*.gif"  -o -iname "*.bmp"  -o -iname "*.webp" \
    \) -printf '%h\037%f\037%s\037%Ts\037%p\0' \) > "$TMP_LIST"

total_files=$(tr -cd '\0' < "$TMP_LIST" | wc -c | awk '{print $1}')

if [[ "$verbose" == false ]]; then
    echo "Scanning: $ROOT" >&2
    echo "Total matching files found: $total_files" >&2
fi

declare -A album_items
declare -A album_name
declare -A album_item_count
declare -A album_images_count
declare -A album_videos_count
declare -A album_thumbnail
declare -A album_last_updated
declare -A album_seen

count=0

while IFS= read -r -d '' record; do
    IFS=$'\x1f' read -r folder name size mtime fullpath <<< "$record"

    count=$((count + 1))

    if [[ "$verbose" == true ]]; then
        draw_progress "$count" "$total_files" "$folder" "$name"
    fi

    ext="${name##*.}"
    ext="${ext,,}"

    type="image"
    case "$ext" in
        mp4|mkv|mov) type="video" ;;
        *) type="image" ;;
    esac

    base_album_name="${folder##*/}"

    if [[ -z "${album_seen["$folder"]+x}" ]]; then
        album_seen["$folder"]=1
        album_name["$folder"]="$base_album_name"
        album_item_count["$folder"]=0
        album_images_count["$folder"]=0
        album_videos_count["$folder"]=0
        album_thumbnail["$folder"]=""
        album_last_updated["$folder"]="$mtime"
        album_items["$folder"]=""
    fi

    album_item_count["$folder"]=$(( album_item_count["$folder"] + 1 ))

    if [[ "$type" == "image" ]]; then
        album_images_count["$folder"]=$(( album_images_count["$folder"] + 1 ))
        if [[ -z "${album_thumbnail["$folder"]}" ]]; then
            album_thumbnail["$folder"]="$fullpath"
        fi
    else
        album_videos_count["$folder"]=$(( album_videos_count["$folder"] + 1 ))
        if [[ -z "${album_thumbnail["$folder"]}" ]]; then
            album_thumbnail["$folder"]="$fullpath"
        fi
    fi

    if (( mtime > album_last_updated["$folder"] )); then
        album_last_updated["$folder"]="$mtime"
    fi

    item_json=$(cat <<EOF
        {
          "name": "$(json_escape "$name")",
          "path": "$(json_escape "$fullpath")",
          "size_bytes": $size,
          "mtime": $mtime,
          "type": "$type"
        }
EOF
)

    if [[ -n "${album_items["$folder"]}" ]]; then
        album_items["$folder"]+=","
        album_items["$folder"]+=$'\n'
    fi
    album_items["$folder"]+="$item_json"

done < "$TMP_LIST"

if [[ "$verbose" == true ]]; then
    printf "\r\033[K" >&2
fi

album_count=0
for folder in "${!album_seen[@]}"; do
    album_count=$((album_count + 1))
done

{
    echo "{"
    echo "  \"root\": \"$(json_escape "$(realpath "$ROOT")")\","
    echo "  \"generated_at\": $(date +%s),"
    echo "  \"total_albums\": $album_count,"
    echo "  \"total_files\": $count,"
    echo "  \"albums\": ["

    first_album=true
    for folder in "${!album_seen[@]}"; do
        if [[ "$first_album" == true ]]; then
            first_album=false
        else
            echo ","
        fi

        cat <<EOF
    {
      "album_name": "$(json_escape "${album_name["$folder"]}")",
      "folder": "$(json_escape "$folder")",
      "item_count": ${album_item_count["$folder"]},
      "thumbnail": "$(json_escape "${album_thumbnail["$folder"]}")",
      "images_count": ${album_images_count["$folder"]},
      "videos_count": ${album_videos_count["$folder"]},
      "last_updated": ${album_last_updated["$folder"]},
      "items": [
${album_items["$folder"]}
      ]
    }
EOF
    done

    echo
    echo "  ]"
    echo "}"
} > "$OUTPUT"

echo "Done! Indexed $count files into $album_count albums -> $OUTPUT" >&2
echo "Output file: $(realpath "$OUTPUT")" >&2% 