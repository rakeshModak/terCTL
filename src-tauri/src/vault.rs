use keyring::Entry;

const SERVICE_PREFIX: &str = "terctl";

/// Which secret is stored for a host. A key-based host can need both a
/// private key and a passphrase, so these are tracked separately per host.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SecretKind {
    Password,
    Passphrase,
    PrivateKey,
}

impl SecretKind {
    fn as_str(&self) -> &'static str {
        match self {
            SecretKind::Password => "password",
            SecretKind::Passphrase => "passphrase",
            SecretKind::PrivateKey => "private_key",
        }
    }

    pub fn from_str(s: &str) -> Option<Self> {
        match s {
            "password" => Some(SecretKind::Password),
            "passphrase" => Some(SecretKind::Passphrase),
            "private_key" => Some(SecretKind::PrivateKey),
            _ => None,
        }
    }
}

fn entry(host_id: &str, kind: SecretKind) -> keyring::Result<Entry> {
    let service = format!("{SERVICE_PREFIX}:{}", kind.as_str());
    Entry::new(&service, host_id)
}

pub fn set_secret(host_id: &str, kind: SecretKind, value: &str) -> keyring::Result<()> {
    entry(host_id, kind)?.set_password(value)
}

pub fn get_secret(host_id: &str, kind: SecretKind) -> keyring::Result<Option<String>> {
    match entry(host_id, kind)?.get_password() {
        Ok(secret) => Ok(Some(secret)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e),
    }
}

pub fn has_secret(host_id: &str, kind: SecretKind) -> keyring::Result<bool> {
    Ok(get_secret(host_id, kind)?.is_some())
}

pub fn delete_secret(host_id: &str, kind: SecretKind) -> keyring::Result<()> {
    match entry(host_id, kind)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e),
    }
}

/// Removes every secret kind that might exist for a host, e.g. when deleting
/// the host itself. Ignores kinds that were never set.
pub fn delete_all_secrets(host_id: &str) -> keyring::Result<()> {
    for kind in [
        SecretKind::Password,
        SecretKind::Passphrase,
        SecretKind::PrivateKey,
    ] {
        delete_secret(host_id, kind)?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Hits the real OS credential store (Keychain/Credential Manager/Secret
    // Service) — there is no in-memory backend to test against.
    const TEST_HOST: &str = "terctl-vault-test-host";

    #[test]
    fn set_get_delete_roundtrip() {
        set_secret(TEST_HOST, SecretKind::Password, "hunter2").unwrap();
        assert_eq!(
            get_secret(TEST_HOST, SecretKind::Password).unwrap(),
            Some("hunter2".to_string())
        );
        assert!(has_secret(TEST_HOST, SecretKind::Password).unwrap());

        delete_secret(TEST_HOST, SecretKind::Password).unwrap();
        assert_eq!(get_secret(TEST_HOST, SecretKind::Password).unwrap(), None);
        assert!(!has_secret(TEST_HOST, SecretKind::Password).unwrap());
    }
}
