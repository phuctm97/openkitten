#!/usr/bin/env bash
set -euo pipefail

# ---------------------------------------------------------------------------
# OpenKitten installer
# Usage: curl -fsSL https://raw.githubusercontent.com/phuctm97/openkitten/main/install.sh | bash
# ---------------------------------------------------------------------------

# Colors & helpers
if [[ -t 1 ]]; then
  BOLD='\033[1m'    DIM='\033[2m'    RESET='\033[0m'
  RED='\033[0;31m'  GREEN='\033[0;32m'  YELLOW='\033[0;33m'  CYAN='\033[0;36m'
else
  BOLD='' DIM='' RESET='' RED='' GREEN='' YELLOW='' CYAN=''
fi

info()    { printf "${CYAN}info${RESET}  %s\n" "$*"; }
success() { printf "${GREEN}ok${RESET}    %s\n" "$*"; }
warn()    { printf "${YELLOW}warn${RESET}  %s\n" "$*"; }
error()   { printf "${RED}error${RESET} %s\n" "$*" >&2; }
step()    { printf "\n${BOLD}▸ %s${RESET}\n" "$*"; }

# Cleanup trap — friendly message on unexpected failure
cleanup() {
  local code=$?
  if [[ $code -ne 0 ]]; then
    echo
    error "Installation failed (exit code $code)."
    error "If this looks like a bug, please open an issue:"
    error "  https://github.com/phuctm97/openkitten/issues"
  fi
}
trap cleanup EXIT

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

REPO_URL="https://github.com/phuctm97/openkitten.git"
DEFAULT_INSTALL_DIR="${HOME}/.openkitten"
INSTALL_DIR="${OPENKITTEN_DIR:-$DEFAULT_INSTALL_DIR}"
INSTALL_DIR="${INSTALL_DIR%/}"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

has_command() { command -v "$1" &>/dev/null; }

# Prompt helper for curl-pipe-bash: reads from /dev/tty so stdin (the pipe)
# doesn't interfere with user input.
prompt_tty() {
  if [[ ! -t 0 ]] && [[ ! -e /dev/tty ]]; then
    error "Non-interactive environment detected and /dev/tty is unavailable."
    error "Please set environment variables before running the installer,"
    error "or run the script directly: bash install.sh"
    exit 1
  fi
  # $1 = prompt text, $2 = variable name
  local prompt="$1" varname="$2"
  printf "%s" "$prompt" > /dev/tty
  IFS= read -r "$varname" < /dev/tty
}

prompt_yn() {
  local prompt="$1" default="${2:-y}" reply
  if [[ "$default" == "y" ]]; then
    prompt="$prompt [Y/n] "
  else
    prompt="$prompt [y/N] "
  fi
  prompt_tty "$prompt" reply
  reply="${reply:-$default}"
  [[ "$reply" =~ ^[Yy] ]]
}

# ---------------------------------------------------------------------------
# Step 1 — Platform check
# ---------------------------------------------------------------------------

step "Checking platform"

OS="$(uname -s)"
case "$OS" in
  Darwin) success "macOS detected" ;;
  Linux)  success "Linux detected" ;;
  *)
    error "Unsupported platform: $OS"
    error "OpenKitten supports macOS and Linux only."
    exit 1
    ;;
esac

# ---------------------------------------------------------------------------
# Step 2 — Check / install Bun
# ---------------------------------------------------------------------------

step "Checking for Bun"

install_bun() {
  info "Installing Bun..."
  # Tolerate installer failure — the final check below will catch it
  curl -fsSL https://bun.sh/install | bash || true
  # Add bun to PATH for this session
  export BUN_INSTALL="${HOME}/.bun"
  export PATH="${BUN_INSTALL}/bin:${PATH}"
}

if has_command bun; then
  BUN_VERSION="$(bun --version 2>/dev/null || echo "0.0.0")"
  BUN_MAJOR="${BUN_VERSION%%.*}"
  if [[ "$BUN_MAJOR" -ge 1 ]]; then
    success "Bun v${BUN_VERSION}"
  else
    warn "Bun v${BUN_VERSION} is too old (need v1.0+)"
    install_bun
  fi
else
  info "Bun not found"
  install_bun
fi

# Final check
if ! has_command bun; then
  error "Bun installation failed. Please install manually: https://bun.sh"
  exit 1
fi

success "Bun v$(bun --version) ready"

# ---------------------------------------------------------------------------
# Step 3 — Clone repo
# ---------------------------------------------------------------------------

step "Setting up OpenKitten"

if ! has_command git; then
  error "git is required but not installed."
  error "Install it via your package manager (e.g. apt install git, brew install git)."
  exit 1
fi

if [[ -d "$INSTALL_DIR/.git" ]]; then
  info "Existing installation found at $INSTALL_DIR"
  info "To update, run: cd $INSTALL_DIR && bun self-update"
  exit 0
elif [[ -d "$INSTALL_DIR" ]]; then
  warn "$INSTALL_DIR exists but is not a git repository"
  BACKUP="${INSTALL_DIR}.backup.$(date +%s)"
  info "Backing up to $BACKUP"
  mv "$INSTALL_DIR" "$BACKUP"
  git clone "$REPO_URL" "$INSTALL_DIR"
  success "Cloned to $INSTALL_DIR (old dir backed up)"
  cd "$INSTALL_DIR"
else
  git clone "$REPO_URL" "$INSTALL_DIR"
  success "Cloned to $INSTALL_DIR"
  cd "$INSTALL_DIR"
fi

# ---------------------------------------------------------------------------
# Step 4 — Install dependencies
# ---------------------------------------------------------------------------

step "Installing dependencies"

bun install
success "Dependencies installed"

# ---------------------------------------------------------------------------
# Step 5 — Collect environment variables
# ---------------------------------------------------------------------------

step "Configuring environment"

ENV_FILE="$INSTALL_DIR/.env.local"

configure_env() {
  local token="" user_id="" provider_key="" provider_var=""

  # Telegram Bot Token
  while [[ -z "$token" ]]; do
    prompt_tty "  Telegram Bot Token (from @BotFather): " token
    if [[ -z "$token" ]]; then
      warn "Bot token is required."
    fi
  done

  # Telegram User ID
  while [[ -z "$user_id" ]]; do
    prompt_tty "  Telegram User ID (from @userinfobot): " user_id
    if ! [[ "$user_id" =~ ^[0-9]+$ ]]; then
      warn "User ID must be a positive number."
      user_id=""
    fi
  done

  # AI provider
  echo > /dev/tty
  info "Select your AI provider:"
  printf "    1) Anthropic (Claude)\n" > /dev/tty
  printf "    2) OpenAI\n" > /dev/tty
  printf "    3) Other (enter variable name manually)\n" > /dev/tty
  local choice=""
  prompt_tty "  Choice [1]: " choice
  choice="${choice:-1}"

  case "$choice" in
    1) provider_var="ANTHROPIC_API_KEY" ;;
    2) provider_var="OPENAI_API_KEY" ;;
    *)
      prompt_tty "  Environment variable name (e.g. GOOGLE_API_KEY): " provider_var
      if [[ -z "$provider_var" ]]; then
        provider_var="ANTHROPIC_API_KEY"
        warn "Defaulting to ANTHROPIC_API_KEY"
      fi
      ;;
  esac

  while [[ -z "$provider_key" ]]; do
    prompt_tty "  $provider_var: " provider_key
    if [[ -z "$provider_key" ]]; then
      warn "API key is required."
    fi
  done

  # Write .env.local (printf to avoid shell expansion corrupting keys)
  (
    umask 077
    {
      printf 'TELEGRAM_BOT_TOKEN="%s"\n' "$token"
      printf 'TELEGRAM_USER_ID="%s"\n' "$user_id"
      printf '%s="%s"\n' "$provider_var" "$provider_key"
    } > "$ENV_FILE"
  )

  success "Configuration saved to .env.local"
}

if [[ -f "$ENV_FILE" ]]; then
  info "Existing .env.local found"
  if prompt_yn "  Reconfigure?" "n"; then
    configure_env
  else
    success "Keeping existing configuration"
  fi
else
  configure_env
fi

# ---------------------------------------------------------------------------
# Step 6 — Run bun setup
# ---------------------------------------------------------------------------

step "Running setup"

# Don't let setup's exit code kill the installer — some checks are
# informational warnings, not hard failures.
if bun setup; then
  success "Setup complete"
else
  warn "Setup reported warnings (this is usually fine)"
fi

# ---------------------------------------------------------------------------
# Step 7 — Summary
# ---------------------------------------------------------------------------

echo
printf "${BOLD}========================================${RESET}\n"
printf "${GREEN}${BOLD}  OpenKitten installed successfully!${RESET}\n"
printf "${BOLD}========================================${RESET}\n"
echo
printf "  ${DIM}Install dir:${RESET}  %s\n" "$INSTALL_DIR"
printf "  ${DIM}Config file:${RESET}  %s\n" "$ENV_FILE"
echo
printf "  To update later: cd %s && bun self-update\n" "$INSTALL_DIR"
echo
