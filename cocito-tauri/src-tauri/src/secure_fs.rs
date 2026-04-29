//! secure_fs · helpers de filesystem com permissões restritivas.
//!
//! Todos os ficheiros que o Cocito guarda têm conteúdo sensível:
//! cookies/sessions (partitions), regras de notificação (rules.json),
//! índice de cada notif vista (virgilio.sqlite), URLs de instâncias
//! (config.json). Ler estes ficheiros expõe a vida do utilizador.
//!
//! Em sistemas multi-utilizador (raro em desktops pessoais, comum em
//! shared workstations), o default 0644 deixa qualquer outro utilizador
//! ler. Forçamos 0600 (ficheiro só owner) e 0700 (diretório só owner).

use std::fs;
use std::io::{self, Write};
use std::path::Path;

/// Limite máximo para qualquer ficheiro de config/state que o Cocito escreve.
/// Defesa em profundidade contra payloads gigantes (sync import, rules.json).
pub const MAX_CONFIG_SIZE: usize = 4 * 1024 * 1024; // 4 MB

/// Escreve `body` em `path` com permissões 0600 (só dono). Cria parent dirs
/// também restritivos (0700) se preciso. No Windows ignora chmod (NTFS DACL gere).
pub fn write_secure<P: AsRef<Path>>(path: P, body: &[u8]) -> io::Result<()> {
    let path = path.as_ref();
    if body.len() > MAX_CONFIG_SIZE {
        return Err(io::Error::new(
            io::ErrorKind::InvalidInput,
            format!("body excede MAX_CONFIG_SIZE ({} bytes)", body.len()),
        ));
    }

    if let Some(parent) = path.parent() {
        ensure_dir_secure(parent)?;
    }

    // Escreve via temp + rename atómico (resiste a crashes a meio).
    let tmp = path.with_extension("tmp");
    {
        let mut f = open_create_secure(&tmp)?;
        f.write_all(body)?;
        f.sync_all()?;
    }
    fs::rename(&tmp, path)?;

    // Garante 0600 mesmo que o ficheiro já existisse.
    apply_file_mode(path, 0o600)?;

    Ok(())
}

/// Garante que um diretório existe com permissões 0700.
pub fn ensure_dir_secure<P: AsRef<Path>>(path: P) -> io::Result<()> {
    let path = path.as_ref();
    if !path.exists() {
        fs::create_dir_all(path)?;
    }
    apply_dir_mode(path, 0o700)?;
    Ok(())
}

/// Cria/abre um ficheiro com 0600 e devolve handle escrita-only.
fn open_create_secure(path: &Path) -> io::Result<fs::File> {
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(path)
    }
    #[cfg(not(unix))]
    {
        fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .open(path)
    }
}

#[cfg(unix)]
fn apply_file_mode(path: &Path, mode: u32) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let perms = fs::Permissions::from_mode(mode);
    fs::set_permissions(path, perms)
}

#[cfg(not(unix))]
fn apply_file_mode(_path: &Path, _mode: u32) -> io::Result<()> {
    // Windows: NTFS DACL é gerido pelo SO; não há modo POSIX.
    Ok(())
}

#[cfg(unix)]
fn apply_dir_mode(path: &Path, mode: u32) -> io::Result<()> {
    use std::os::unix::fs::PermissionsExt;
    let perms = fs::Permissions::from_mode(mode);
    fs::set_permissions(path, perms)
}

#[cfg(not(unix))]
fn apply_dir_mode(_path: &Path, _mode: u32) -> io::Result<()> {
    Ok(())
}

/// Lê um ficheiro mas rejeita se exceder MAX_CONFIG_SIZE — proteção contra
/// ficheiros corrompidos/tampered que tentem fazer DoS por memória.
pub fn read_secure<P: AsRef<Path>>(path: P) -> io::Result<String> {
    let path = path.as_ref();
    let meta = fs::metadata(path)?;
    if meta.len() > MAX_CONFIG_SIZE as u64 {
        return Err(io::Error::new(
            io::ErrorKind::InvalidData,
            format!(
                "{} excede MAX_CONFIG_SIZE ({} > {})",
                path.display(),
                meta.len(),
                MAX_CONFIG_SIZE
            ),
        ));
    }
    fs::read_to_string(path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::tempdir;

    #[test]
    fn write_secure_creates_with_0600() {
        let dir = tempdir().unwrap();
        let path = dir.path().join("secret.json");
        write_secure(&path, b"{\"k\":\"v\"}").unwrap();

        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            let mode = fs::metadata(&path).unwrap().permissions().mode() & 0o777;
            assert_eq!(mode, 0o600);
        }
    }

    #[test]
    fn rejects_oversized_writes() {
        let dir = tempdir().unwrap();
        let huge = vec![0u8; MAX_CONFIG_SIZE + 1];
        assert!(write_secure(dir.path().join("big"), &huge).is_err());
    }
}
