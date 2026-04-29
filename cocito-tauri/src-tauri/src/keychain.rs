//! keychain · acesso ao keychain do SO via crate `keyring`.
//!
//! macOS: usa o Keychain (login.keychain). Windows: Credential Manager.
//! Linux: Secret Service (gnome-keyring/kwallet via D-Bus).
//!
//! Princípio: Cocito **nunca** guarda secrets em ficheiros JSON. Tudo o que é
//! sensível (Ollama API key futura, chave de encryption do Virgílio) vive aqui.

use anyhow::{Context, Result};
use keyring::Entry;

const SERVICE: &str = "app.cocito.desktop";

/// Lê uma secret do keychain. Devolve `Ok(None)` se não existir.
pub fn get(name: &str) -> Result<Option<String>> {
    let entry = Entry::new(SERVICE, name).context("a abrir entry do keychain")?;
    match entry.get_password() {
        Ok(s) => Ok(Some(s)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.into()),
    }
}

/// Grava uma secret no keychain (substitui se existir).
pub fn set(name: &str, value: &str) -> Result<()> {
    let entry = Entry::new(SERVICE, name).context("a abrir entry do keychain")?;
    entry.set_password(value).context("a gravar password")?;
    Ok(())
}

/// Apaga uma secret do keychain. Sem erro se não existir.
#[allow(dead_code)]
pub fn delete(name: &str) -> Result<()> {
    let entry = Entry::new(SERVICE, name).context("a abrir entry do keychain")?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.into()),
    }
}

/// Garante uma chave de 32 bytes (256-bit) hexadecimal — gera se não existir.
/// Usada para encryption do Virgílio.
pub fn ensure_random_key(name: &str) -> Result<String> {
    if let Some(existing) = get(name)? {
        return Ok(existing);
    }
    use rand::RngCore;
    let mut buf = [0u8; 32];
    rand::rng().fill_bytes(&mut buf);
    let hex: String = buf.iter().map(|b| format!("{b:02x}")).collect();
    set(name, &hex)?;
    Ok(hex)
}
