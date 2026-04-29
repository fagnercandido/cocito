#!/bin/zsh
# Cocito · cria GitHub release com .dmg + latest.json (auto-update manifest).
#
# Uso: ./scripts/release.sh v0.3.0
#
# Pré-requisitos:
#   · `gh` CLI autenticado (`gh auth login`)
#   · `.dmg` já assinado e notarizado (correr sign-and-notarize.sh primeiro)
#   · `~/.cocito/tauri-signing.key` — chave privada do Tauri Updater
#     (gerar uma vez com: `pnpm tauri signer generate -w ~/.cocito/tauri-signing.key`)

set -euo pipefail

cd "$(dirname "$0")/.."

VERSION="${1:-}"
if [[ -z "$VERSION" ]]; then
  echo "❌ Uso: $0 vX.Y.Z" >&2
  exit 1
fi

# Despoja o `v` para o nome do .dmg.
VER_NUM="${VERSION#v}"

DMG_PATH=$(ls src-tauri/target/release/bundle/dmg/Cocito_${VER_NUM}*.dmg 2>/dev/null | head -1)
if [[ -z "$DMG_PATH" || ! -f "$DMG_PATH" ]]; then
  echo "❌ DMG para $VERSION não encontrado em src-tauri/target/release/bundle/dmg/" >&2
  echo "   Corre primeiro: ./scripts/sign-and-notarize.sh" >&2
  exit 1
fi

SIG_KEY="${HOME}/.cocito/tauri-signing.key"
if [[ ! -f "$SIG_KEY" ]]; then
  echo "❌ Chave de signing do updater não encontrada em $SIG_KEY" >&2
  echo "   Gera uma vez com: pnpm tauri signer generate -w $SIG_KEY" >&2
  exit 1
fi

# ── Assinatura para auto-update ────────────────────────────────────────
echo "▸ A assinar $DMG_PATH para o updater…"
SIG=$(pnpm tauri signer sign --private-key "$SIG_KEY" "$DMG_PATH" 2>&1 | grep -A 1 "signature" | tail -1 | tr -d ' ')

# ── Checksum ───────────────────────────────────────────────────────────
SHA256=$(shasum -a 256 "$DMG_PATH" | awk '{print $1}')

# ── latest.json (manifest do updater) ─────────────────────────────────
LATEST=$(mktemp -t latest.XXXXXX.json)
cat > "$LATEST" <<EOF
{
  "version": "$VERSION",
  "notes": "Cocito $VERSION — ver https://github.com/fagnercandido/cocito/releases/tag/$VERSION",
  "pub_date": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "platforms": {
    "darwin-x86_64": {
      "signature": "$SIG",
      "url": "https://github.com/fagnercandido/cocito/releases/download/$VERSION/$(basename "$DMG_PATH")"
    },
    "darwin-aarch64": {
      "signature": "$SIG",
      "url": "https://github.com/fagnercandido/cocito/releases/download/$VERSION/$(basename "$DMG_PATH")"
    }
  }
}
EOF

# ── GitHub release ─────────────────────────────────────────────────────
echo "▸ A criar release $VERSION no GitHub…"
gh release create "$VERSION" \
  --title "Cocito $VERSION" \
  --notes "## SHA256

\`$SHA256  $(basename "$DMG_PATH")\`

## Verificar
\`\`\`bash
shasum -a 256 -c <<< \"$SHA256  $(basename "$DMG_PATH")\"
\`\`\`

Notarized com Apple Developer ID. Aceitável em macOS sem warnings.

## Atualização
Cocito 0.3+ atualiza-se sozinho. Versões anteriores: instala o .dmg manualmente." \
  "$DMG_PATH" \
  "$LATEST#latest.json"

rm -f "$LATEST"

echo ""
echo "✅ Release $VERSION publicado."
echo "   SHA256: $SHA256"
echo "   URL:    $(gh release view "$VERSION" --json url -q .url)"
