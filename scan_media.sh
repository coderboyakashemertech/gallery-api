#!/usr/bin/env bash
set -euo pipefail

usage() {
    cat <<'EOF'
Usage:
  ./scan_media.sh [-v] <root_folder> [output.json]

Options:
  -v    Verbose mode
  -h    Help

What it does:
  - Scans media folders under root_folder
  - Writes final JSON to output.json
EOF
}

verbose=false

log() {
    if [[ "$verbose" == true ]]; then
        printf '[INFO] %s\n' "$*" >&2
    fi
}

json_escape() {
    local s=$1
    s=${s//\\/\\\\}
    s=${s//\"/\\\"}
    s=${s//$'\n'/\\n}
    s=${s//$'\r'/\\r}
    s=${s//$'\t'/\\t}
    s=${s//$'\f'/\\f}
    s=${s//$'\b'/\\b}
    printf '%s' "$s"
}

url_encode_path() {
    local path_value=$1
    local encoded=""
    local i
    local char

    for ((i = 0; i < ${#path_value}; i++)); do
        char=${path_value:i:1}
        case "$char" in
            [a-zA-Z0-9.~_-])
                encoded+="$char"
                ;;
            *)
                printf -v encoded '%s%%%02X' "$encoded" "'$char"
                ;;
        esac
    done

    printf '%s' "$encoded"
}

format_duration() {
    local total=$1
    local h=$((total / 3600))
    local m=$(((total % 3600) / 60))
    local s=$((total % 60))

    if (( h > 0 )); then
        printf '%dh %dm %ds' "$h" "$m" "$s"
    elif (( m > 0 )); then
        printf '%dm %ds' "$m" "$s"
    else
        printf '%ds' "$s"
    fi
}

append_folder_output() {
    if [[ "$first_output_folder" == true ]]; then
        first_output_folder=false
    else
        printf ',\n' >> "$OUTPUT_TMP"
    fi

    cat "$curr_folder_tmp" >> "$OUTPUT_TMP"
    ((folder_count += 1))
}

process_folder() {
    local folder=$1

    curr_folder="$folder"
    curr_count=0
    curr_size=0
    curr_mtime=0
    curr_files_tmp=$(mktemp)
    curr_folder_tmp=$(mktemp)
    curr_first_file=true

    while IFS=$'\x1f' read -r -d '' name size mtime fullpath; do
        ((curr_count += 1))
        ((curr_size += size))
        if (( mtime > curr_mtime )); then
            curr_mtime=$mtime
        fi

        if [[ "$curr_first_file" == true ]]; then
            curr_first_file=false
        else
            printf ',\n' >> "$curr_files_tmp"
        fi

        printf '        {"name": "%s", "path": "%s", "size": %d, "thumbnail": "", "date": %d, "mimetype": "%s"}' \
            "$(json_escape "$name")" \
            "$(json_escape "$(url_encode_path "$fullpath")")" \
            "$size" \
            "$mtime" \
            "$(file --mime-type -b "$fullpath")" >> "$curr_files_tmp"
    done < <(
        find "$curr_folder" -maxdepth 1 -type f \( \
            -iname "*.jpg"  -o -iname "*.jpeg" -o -iname "*.png"  -o \
            -iname "*.gif"  -o -iname "*.bmp"  -o -iname "*.webp" -o \
            -iname "*.tiff" -o -iname "*.mp4" \
        \) -printf '%f\037%s\037%Ts\037%p\0' \
        | sort -z -t $'\x1f' -k4,4
    )

    if (( curr_count == 0 )); then
        rm -f "$curr_files_tmp" "$curr_folder_tmp"
        curr_files_tmp=""
        curr_folder_tmp=""
        curr_folder=""
        return 0
    fi

    {
        printf '    {\n'
        printf '      "folder_name": "%s",\n' "$(json_escape "$(basename "$curr_folder")")"
        printf '      "folder_path": "%s",\n' "$(json_escape "$(url_encode_path "$curr_folder")")"
        printf '      "file_count": %d,\n' "$curr_count"
        printf '      "folder_size_bytes": %d,\n' "$curr_size"
        printf '      "latest_mtime": %d,\n' "$curr_mtime"
        printf '      "files": [\n'
        cat "$curr_files_tmp"
        printf '\n'
        printf '      ]\n'
        printf '    }\n'
    } > "$curr_folder_tmp"

    rm -f "$curr_files_tmp"
    curr_files_tmp=""
    append_folder_output
    rm -f "$curr_folder_tmp"
    curr_folder_tmp=""
    curr_folder=""

    log "Scanned: $folder"
}

while getopts ":vh" opt; do
    case "$opt" in
        v) verbose=true ;;
        h)
            usage
            exit 0
            ;;
        \?)
            echo "Unknown option: -$OPTARG" >&2
            usage >&2
            exit 1
            ;;
    esac
done

shift $((OPTIND - 1))

if [[ $# -lt 1 || $# -gt 2 ]]; then
    usage >&2
    exit 1
fi

ROOT=$1
if [[ ! -d "$ROOT" ]]; then
    echo "Directory does not exist: $ROOT" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [[ $# -eq 2 ]]; then
    if [[ "$2" = /* ]]; then
        OUTPUT="$2"
    else
        OUTPUT="$(pwd)/$2"
    fi
else
    OUTPUT="$SCRIPT_DIR/media_index.json"
fi

mkdir -p "$(dirname "$OUTPUT")"

start_time=$(date +%s)

log "Root folder: $ROOT"
log "Output JSON: $OUTPUT"

OUTPUT_TMP=$(mktemp)
trap 'rm -f "$OUTPUT_TMP" "${curr_files_tmp:-}" "${curr_folder_tmp:-}"' EXIT

generated_at=$(date +%s)
folder_count=0
first_output_folder=true

{
    printf '{\n'
    printf '  "root": "%s",\n' "$(json_escape "$(realpath "$ROOT")")"
    printf '  "generated_at": %d,\n' "$generated_at"
    printf '  "folders": [\n'
} > "$OUTPUT_TMP"

curr_folder=""
curr_count=0
curr_size=0
curr_mtime=0
curr_files_tmp=""
curr_folder_tmp=""
curr_first_file=true

log "Scanning media files..."

while IFS= read -r -d '' folder; do
    process_folder "$folder"
done < <(find "$ROOT" -type d -print0 | sort -z)

{
    printf '\n'
    printf '  ]\n'
    printf '}\n'
} >> "$OUTPUT_TMP"

mv "$OUTPUT_TMP" "$OUTPUT"

end_time=$(date +%s)
duration=$((end_time - start_time))

echo "Scan completed."
echo "JSON saved to $OUTPUT"
echo "Folders total: $folder_count"
echo "Execution time: $(format_duration "$duration")"
