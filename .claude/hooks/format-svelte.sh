#!/bin/bash
set -euo pipefail

INPUT="$(cat)"
FILE_PATH="$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')"

# Only format .svelte files
if [[ -n "$FILE_PATH" && "$FILE_PATH" == *.svelte && -f "$FILE_PATH" ]]; then
  npx prettier --write "$FILE_PATH" 2>/dev/null || true
fi

exit 0
