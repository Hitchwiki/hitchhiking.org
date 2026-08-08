#!/usr/bin/env bash
set -euo pipefail

release_mode=false
if [[ ${1:-} == --release ]]; then
  release_mode=true
  shift
fi

project_root=${1:-$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd -P)}
project_root=$(cd -- "$project_root" && pwd -P)
failures=0

fail() {
  echo "ERROR: $*" >&2
  failures=$((failures + 1))
}

for required in LICENSE NOTICE.md README.md package.json index.html index_template.html assets/heatmap.js about/index.html .github/workflows/ci.yml; do
  [[ -f "$project_root/$required" ]] || fail "missing required release file: $required"
done

if [[ -f "$project_root/LICENSE" ]]; then
  grep -Fq 'GNU AFFERO GENERAL PUBLIC LICENSE' "$project_root/LICENSE" || fail 'LICENSE is not the GNU AGPL text'
fi
grep -Fq 'AGPL-3.0-or-later' "$project_root/README.md" || fail 'README does not state AGPL-3.0-or-later'
grep -Fq '(c) 2025–2026 guaka and till' "$project_root/README.md" || fail 'README copyright notice is missing'
grep -Fq 'Roger McLassus' "$project_root/NOTICE.md" || fail 'photo attribution is missing from NOTICE'
grep -Fq 'Roger McLassus' "$project_root/about/index.html" || fail 'photo attribution is missing from /about'
grep -Fq 'OpenStreetMap contributors' "$project_root/about/index.html" || fail 'map attribution is missing from /about'
grep -Fq 'Signal Technology Foundation' "$project_root/about/index.html" || fail 'Signal attribution is missing from /about'
grep -Fq '$folium_head' "$project_root/index_template.html" || fail 'map template placeholder is missing'
grep -Fq 'assets/heatmap.js' "$project_root/index.html" || fail 'generated page does not load runtime map data'
if grep -Eq '\$folium_(head|body|script)' "$project_root/index.html"; then
  fail 'generated page still contains unresolved map template placeholders'
fi

if [[ $release_mode == true ]]; then
  for prohibited in .git .codex .venv coverage dist node_modules release; do
    [[ ! -e "$project_root/$prohibited" ]] || fail "prohibited release path exists: $prohibited"
  done
  while IFS= read -r env_file; do
    [[ $(basename -- "$env_file") == .env.example ]] || fail "environment file exists in release: ${env_file#"$project_root/"}"
  done < <(find "$project_root" -type f -name '.env*' -print)
fi

credential_pattern='BEGIN (RSA |EC |OPENSSH |DSA )?PRIVATE KEY|(api[_-]?key|client[_-]?secret|password|access[_-]?token)[[:space:]]*[:=][[:space:]]*.{8}'
while IFS= read -r suspect; do
  fail "possible credential pattern in ${suspect#"$project_root/"}"
done < <(grep -IlER \
  --exclude='package-lock.json' \
  --exclude='check-release.sh' \
  --exclude-dir='.git' \
  --exclude-dir='.venv' \
  --exclude-dir='coverage' \
  --exclude-dir='dist' \
  --exclude-dir='node_modules' \
  --exclude-dir='release' \
  "$credential_pattern" "$project_root" || true)

if ((failures > 0)); then
  echo "Release check failed with $failures error(s)." >&2
  exit 1
fi

echo "Release check passed: $project_root"
