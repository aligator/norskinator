#!/bin/sh
# Optional HTTP basic auth. Runs at container start via nginx's /docker-entrypoint.d.
#   BASIC_AUTH_USER + BASIC_AUTH_PASSWORD set   → login required
#   both unset                                  → open
#   only one set                                → refuse to start (fail closed)
# BASIC_AUTH_PASSWORD may be plain text or an nginx-supported hash ($apr1$…, {SHA}…, {SSHA}…).
set -eu

conf=/tmp/norskinator-auth.conf
file=/tmp/norskinator-htpasswd

user="${BASIC_AUTH_USER:-}"
password="${BASIC_AUTH_PASSWORD:-}"

if [ -z "$user" ] && [ -z "$password" ]; then
  echo 'auth_basic off;' > "$conf"
  echo "$0: basic auth off"
  exit 0
fi

if [ -z "$user" ] || [ -z "$password" ]; then
  echo "$0: set both BASIC_AUTH_USER and BASIC_AUTH_PASSWORD, or neither" >&2
  exit 1
fi

case "$user" in
  *:*)
    echo "$0: BASIC_AUTH_USER must not contain ':'" >&2
    exit 1
    ;;
esac

case "$password" in
  '$apr1$'* | '{SHA}'* | '{SSHA}'* | '{PLAIN}'*)
    entry="$password"
    ;;
  *)
    entry="{PLAIN}$password"
    ;;
esac

umask 077
printf '%s:%s\n' "$user" "$entry" > "$file"
printf 'auth_basic "Norskinator";\nauth_basic_user_file %s;\n' "$file" > "$conf"

echo "$0: basic auth on for user '$user'"
