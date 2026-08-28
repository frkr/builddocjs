#!/bin/bash
# MANUAL/EMERGENCY ONLY. Never call from the application, npm, or automation.
# Usage: ./kill_chrome.sh <root-pid> [--force]

set -u

if [ -n "${npm_lifecycle_event:-}" ]; then
  echo "Refusing to run from an npm lifecycle/script." >&2
  exit 64
fi

if [ ! -t 0 ]; then
  echo "Refusing non-interactive execution; an operator must confirm the target." >&2
  exit 64
fi

ROOT_PID="${1:-}"
FORCE="${2:-}"

case "$ROOT_PID" in
  ''|*[!0-9]*)
    echo "Usage: $0 <root-pid> [--force]" >&2
    exit 64
    ;;
esac

if [ "$ROOT_PID" -le 1 ] || [ "$ROOT_PID" -eq "$$" ]; then
  echo "Refusing unsafe PID: $ROOT_PID" >&2
  exit 64
fi

if [ -n "$FORCE" ] && [ "$FORCE" != "--force" ]; then
  echo "Unknown option: $FORCE" >&2
  exit 64
fi

TARGET_USER="$(ps -o user= -p "$ROOT_PID" 2>/dev/null | awk '{$1=$1};1')"
TARGET_COMMAND="$(ps -o command= -p "$ROOT_PID" 2>/dev/null)"
CURRENT_USER="$(id -un)"

if [ -z "$TARGET_USER" ] || [ -z "$TARGET_COMMAND" ]; then
  echo "PID $ROOT_PID does not exist or cannot be inspected." >&2
  exit 1
fi

if [ "$TARGET_USER" != "$CURRENT_USER" ]; then
  echo "Refusing PID owned by '$TARGET_USER'; current user is '$CURRENT_USER'." >&2
  exit 1
fi

case "$TARGET_COMMAND" in
  *"Chromium.app/Contents/MacOS/Chromium"*) ;;
  *)
    echo "Refusing target that is not the Homebrew Chromium executable." >&2
    echo "Observed command: $TARGET_COMMAND" >&2
    exit 1
    ;;
esac

collect_tree() {
  pending="$ROOT_PID"
  collected=""
  while [ -n "$pending" ]; do
    pid="${pending%% *}"
    if [ "$pending" = "$pid" ]; then pending=""; else pending="${pending#* }"; fi
    case " $collected " in *" $pid "*) continue ;; esac
    collected="$collected $pid"
    children="$(ps -axo pid=,ppid= | awk -v parent="$pid" '$2 == parent { print $1 }')"
    for child in $children; do pending="$pending $child"; done
    pending="$(printf '%s' "$pending" | awk '{$1=$1};1')"
  done
  printf '%s\n' "$collected" | awk '{$1=$1};1'
}

PIDS="$(collect_tree)"
echo "WARNING: manual emergency cleanup only."
echo "Root PID: $ROOT_PID"
echo "Command:  $TARGET_COMMAND"
echo "Owned process tree: $PIDS"
printf "Type 'KILL CHROMIUM PID %s' to send SIGTERM: " "$ROOT_PID"
IFS= read -r CONFIRM

if [ "$CONFIRM" != "KILL CHROMIUM PID $ROOT_PID" ]; then
  echo "Cancelled; no signal sent."
  exit 1
fi

# Descendants first, then the explicitly reviewed root.
REVERSED=""
for pid in $PIDS; do REVERSED="$pid $REVERSED"; done
kill -TERM $REVERSED 2>/dev/null || true

sleep 3
SURVIVORS=""
for pid in $PIDS; do
  if kill -0 "$pid" 2>/dev/null; then SURVIVORS="$SURVIVORS $pid"; fi
done
SURVIVORS="$(printf '%s' "$SURVIVORS" | awk '{$1=$1};1')"

if [ -z "$SURVIVORS" ]; then
  echo "Reviewed Chromium process tree exited after SIGTERM."
  exit 0
fi

if [ "$FORCE" != "--force" ]; then
  echo "Processes still alive: $SURVIVORS" >&2
  echo "Review again and rerun with --force only if SIGKILL is justified." >&2
  exit 1
fi

printf "Type 'FORCE KILL PID %s' to send SIGKILL to survivors: " "$ROOT_PID"
IFS= read -r FORCE_CONFIRM
if [ "$FORCE_CONFIRM" != "FORCE KILL PID $ROOT_PID" ]; then
  echo "Force step cancelled; no SIGKILL sent."
  exit 1
fi

kill -KILL $SURVIVORS 2>/dev/null || true
echo "SIGKILL sent only to surviving PIDs from the reviewed tree: $SURVIVORS"
