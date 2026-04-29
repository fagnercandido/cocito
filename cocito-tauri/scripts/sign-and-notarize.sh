#!/bin/zsh
# Cocito · sign + notarize + staple do .app/.dmg para distribuição.
#
# Pré-requisitos (configurar uma vez):
#   1. Apple Developer ID (anual, ~99 USD/ano)
#   2. Certificado "Developer ID Application: <teu-nome>" instalado no Keychain
#   3. App-specific password gerada em https://appleid.apple.com → Sign-in & Security
#   4. Variáveis de ambiente:
#        export APPLE_ID="your-apple-id@example.com"
#        export APPLE_TEAM_ID="XXXXXXXXXX"           # vê em developer.apple.com → Membership
#        export APPLE_APP_PASSWORD="abcd-efgh-ijkl-mnop"
#        export APPLE_SIGNING_IDENTITY="Developer ID Application: <Nome> (XXXXXXXXXX)"
#
# Tauri 2 lê estas envs no `pnpm tauri:build` automaticamente, então só
# precisas de as exportar antes de buildar.
#
# Este script:
#   1. Verifica que as envs estão lá
#   2. Faz `pnpm tauri:build` (ele próprio assina o .app durante o bundle)
#   3. Notariza o .dmg (submete a Apple, espera, aplica staple)
#   4. Verifica com `spctl` que tudo passou

set -euo pipefail

cd "$(dirname "$0")/.."

# ── Verificações ──────────────────────────────────────────────────────
for var in APPLE_ID APPLE_TEAM_ID APPLE_APP_PASSWORD APPLE_SIGNING_IDENTITY; do
  if [[ -z "${(P)var:-}" ]]; then
    echo "❌ $var não está definida. Vê o cabeçalho deste script." >&2
    exit 1
  fi
done

# Verifica que o certificado existe no Keychain.
if ! security find-identity -v -p codesigning | grep -q "$APPLE_SIGNING_IDENTITY"; then
  echo "❌ Certificado '$APPLE_SIGNING_IDENTITY' não encontrado no Keychain." >&2
  echo "   Importa o .p12 do Developer Portal antes de continuar." >&2
  exit 1
fi

# ── Build ────────────────────────────────────────────────────────────
echo "▸ Build (tauri:build assina o .app)…"
pnpm tauri:build

APP_PATH="src-tauri/target/release/bundle/macos/Cocito.app"
DMG_PATH=$(ls src-tauri/target/release/bundle/dmg/Cocito_*.dmg 2>/dev/null | head -1)

if [[ ! -d "$APP_PATH" ]]; then
  echo "❌ $APP_PATH não foi gerado." >&2
  exit 1
fi

# Confirma assinatura do .app.
echo "▸ Verifica assinatura do .app…"
codesign -dv --verbose=4 "$APP_PATH" 2>&1 | grep -E "(Authority|TeamIdentifier)"
spctl -a -t exec -vv "$APP_PATH"

# Se o .dmg do Tauri falhou, regenera manual.
if [[ -z "$DMG_PATH" ]]; then
  echo "▸ DMG falhou no build, a regerar com hdiutil…"
  rm -f src-tauri/target/release/bundle/dmg/rw.*.dmg
  DMG_PATH="src-tauri/target/release/bundle/dmg/Cocito_$(node -p "require('./package.json').version").dmg"
  hdiutil create -volname "Cocito" -srcfolder "$APP_PATH" -ov -format UDZO "$DMG_PATH"
  # Assinar o DMG também.
  codesign --sign "$APPLE_SIGNING_IDENTITY" --options runtime --timestamp "$DMG_PATH"
fi

# ── Notarization ─────────────────────────────────────────────────────
echo "▸ Submete .dmg para notarization Apple (pode demorar 2-5 min)…"
xcrun notarytool submit "$DMG_PATH" \
  --apple-id "$APPLE_ID" \
  --team-id "$APPLE_TEAM_ID" \
  --password "$APPLE_APP_PASSWORD" \
  --wait

# ── Staple ────────────────────────────────────────────────────────────
echo "▸ Aplica staple no .dmg…"
xcrun stapler staple "$DMG_PATH"
xcrun stapler validate "$DMG_PATH"

echo ""
echo "✅ Cocito assinado, notarizado e stapled."
echo "   $DMG_PATH"
echo ""
echo "   SHA256: $(shasum -a 256 "$DMG_PATH" | awk '{print $1}')"
