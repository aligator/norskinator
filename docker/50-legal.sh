#!/bin/sh
# Optional Impressum details, read from the container environment at start:
#   IMPRESSUM_NAME + IMPRESSUM_ADDRESS (lines separated by "|")
#   optional: IMPRESSUM_EMAIL, IMPRESSUM_NOTE (free text shown below the address)
# Written to a JSON file nginx serves as ./legal.json; without them it is `{}` and
# the app shows no Impressum link. Keeps personal data out of repo and image.
set -eu

file=/tmp/norskinator-legal.json

name="${IMPRESSUM_NAME:-}"
address="${IMPRESSUM_ADDRESS:-}"
email="${IMPRESSUM_EMAIL:-}"
note="${IMPRESSUM_NOTE:-}"

if [ -z "$name" ] && [ -z "$address" ]; then
  # An empty object instead of a 404: browsers log every failed fetch as an error.
  echo '{}' > "$file"
  echo "$0: no Impressum configured"
  exit 0
fi

if [ -z "$name" ] || [ -z "$address" ]; then
  echo "$0: set both IMPRESSUM_NAME and IMPRESSUM_ADDRESS, or neither" >&2
  exit 1
fi

# JSON string escaping for plain sh: backslash, quote, and no control characters.
json_string() {
  printf '%s' "$1" | tr -d '\000-\037' | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g'
}

printf '{"name":"%s","address":"%s","email":"%s","note":"%s"}\n' \
  "$(json_string "$name")" "$(json_string "$address")" "$(json_string "$email")" "$(json_string "$note")" > "$file"

echo "$0: Impressum configured"
