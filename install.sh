#!/usr/bin/env bash
set -euo pipefail

# koala-code-steward (考拉代码管家) installer
# Installs all Agent Skills into Claude Code / Antigravity (.agents) / Codex / Cursor.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILLS_SRC="${SCRIPT_DIR}/skills"

TARGET="all"
SCOPE="project"
PROJECT_DIR="$(pwd)"

usage() {
  cat <<'EOF'
Usage: ./install.sh [options]

Options:
  --target <claude|agents|codex|cursor|all>   Target agent ecosystem (default: all)
  --scope <project|global>                    Install into project or user home (default: project)
  --project-dir <path>                        Project root directory when --scope project (default: cwd)
  -h, --help                                  Show this help message

Examples:
  ./install.sh --target claude --scope project --project-dir /path/to/my-app
  ./install.sh --target all --scope global
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --target) TARGET="$2"; shift 2 ;;
    --scope) SCOPE="$2"; shift 2 ;;
    --project-dir) PROJECT_DIR="$2"; shift 2 ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 2 ;;
  esac
done

if [[ "$SCOPE" != "project" && "$SCOPE" != "global" ]]; then
  echo "ERROR: --scope must be 'project' or 'global'" >&2
  exit 2
fi

if [[ "$SCOPE" == "project" && ! -d "$PROJECT_DIR" ]]; then
  echo "ERROR: --project-dir does not exist: $PROJECT_DIR" >&2
  exit 2
fi

install_to_dir() {
  local dest="$1"
  local count=0
  mkdir -p "$dest"
  for skill_path in "$SKILLS_SRC"/*; do
    [[ -d "$skill_path" ]] || continue
    local skill_name
    skill_name="$(basename "$skill_path")"
    rm -rf "${dest:?}/${skill_name}"
    cp -R "$skill_path" "${dest}/${skill_name}"
    count=$((count + 1))
  done
  echo "  [OK] Installed ${count} skills -> $dest"
}

echo "Installing koala-code-steward (考拉代码管家) skills (target=${TARGET}, scope=${SCOPE})..."

install_target() {
  local t="$1"
  case "$t" in
    claude)
      if [[ "$SCOPE" == "project" ]]; then
        install_to_dir "${PROJECT_DIR}/.claude/skills"
      else
        install_to_dir "${HOME}/.claude/skills"
      fi
      ;;
    agents)
      if [[ "$SCOPE" == "project" ]]; then
        install_to_dir "${PROJECT_DIR}/.agents/skills"
      else
        install_to_dir "${HOME}/.gemini/config/skills"
      fi
      ;;
    codex)
      if [[ "$SCOPE" == "project" ]]; then
        install_to_dir "${PROJECT_DIR}/.codex/skills"
      else
        install_to_dir "${HOME}/.codex/skills"
      fi
      ;;
    cursor)
      if [[ "$SCOPE" == "project" ]]; then
        install_to_dir "${PROJECT_DIR}/.cursor/skills"
      else
        install_to_dir "${HOME}/.cursor/skills"
      fi
      ;;
    *)
      echo "ERROR: Unsupported target '$t'" >&2
      exit 2
      ;;
  esac
}

if [[ "$TARGET" == "all" ]]; then
  for t in claude agents codex cursor; do
    install_target "$t"
  done
else
  install_target "$TARGET"
fi

echo ""
echo "Done! Next recommended steps:"
echo "  1. Create your GitHub repo first (Single Source of Truth) and copy skills/github-shared-truth/templates/PULL_REQUEST_TEMPLATE.md to .github/pull_request_template.md."
echo "  2. Copy templates/AGENTS_TEMPLATE.md to your repo root as AGENTS.md (symlink CLAUDE.md -> AGENTS.md if using Claude Code)."
echo "  3. Build local code graph: uv tool install code-review-graph && code-review-graph install && code-review-graph build"
echo "  4. (Recommended) Install Grill-Me for blueprint co-design: npx skills@latest add mattpocock/skills --skill=grill-me"
echo "  5. Ask your coding agent to run 'constitution-blueprint' and push the 5 truth docs to GitHub main."
