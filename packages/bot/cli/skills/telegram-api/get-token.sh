#!/usr/bin/env bash
set -euo pipefail

config="${XDG_CONFIG_HOME:-$HOME/.config}/openkitten/telegram.json"

if [ ! -f "$config" ]; then
  echo "Error: $config not found" >&2
  exit 1
fi

# Extract botToken using bun (available in the openkitten environment)
bun -e "const c = await Bun.file('$config').json(); process.stdout.write(c.botToken)"
