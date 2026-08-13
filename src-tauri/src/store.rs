use crate::models::{AuthKind, Group, Host, NewHost};
use rusqlite::{params, Connection};
use std::path::Path;
use std::sync::Mutex;
use uuid::Uuid;

pub struct Store(pub Mutex<Connection>);

#[derive(Debug, Clone)]
pub struct HostRecord {
    pub host: Host,
    pub host_key_fingerprint: Option<String>,
}

impl Store {
    pub fn new(db_path: &Path) -> rusqlite::Result<Self> {
        let conn = Connection::open(db_path)?;
        Self::init_schema(&conn)?;
        Ok(Store(Mutex::new(conn)))
    }

    fn init_schema(conn: &Connection) -> rusqlite::Result<()> {
        conn.execute(
            "CREATE TABLE IF NOT EXISTS hosts (
                id TEXT PRIMARY KEY,
                label TEXT NOT NULL,
                hostname TEXT NOT NULL,
                port INTEGER NOT NULL,
                username TEXT NOT NULL,
                auth_kind TEXT NOT NULL,
                key_ref TEXT
            )",
            [],
        )?;
        conn.execute(
            "CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL
            )",
            [],
        )?;
        Self::add_column_if_missing(conn, "hosts", "host_key_fingerprint", "TEXT")?;
        Self::add_column_if_missing(conn, "hosts", "group_id", "TEXT")?;
        Self::add_column_if_missing(conn, "hosts", "tags", "TEXT")?;
        Self::add_column_if_missing(conn, "hosts", "accent", "TEXT")?;
        Self::add_column_if_missing(conn, "hosts", "term_scheme", "TEXT")?;
        Self::add_column_if_missing(conn, "hosts", "os", "TEXT")?;
        Self::add_column_if_missing(conn, "groups", "parent_id", "TEXT")?;
        Ok(())
    }

    /// Lightweight migration helper: adds a column if an older schema
    /// version doesn't have it yet.
    fn add_column_if_missing(
        conn: &Connection,
        table: &str,
        column: &str,
        decl_type: &str,
    ) -> rusqlite::Result<()> {
        let mut stmt = conn.prepare(&format!("PRAGMA table_info({table})"))?;
        let has_column = stmt
            .query_map([], |row| row.get::<_, String>(1))?
            .filter_map(Result::ok)
            .any(|name| name == column);
        if !has_column {
            conn.execute(
                &format!("ALTER TABLE {table} ADD COLUMN {column} {decl_type}"),
                [],
            )?;
        }
        Ok(())
    }

    fn encode_tags(tags: &[String]) -> String {
        serde_json::to_string(tags).unwrap_or_else(|_| "[]".to_string())
    }

    fn decode_tags(raw: Option<String>) -> Vec<String> {
        raw.and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn get_known_host_key(&self, host_id: &str) -> rusqlite::Result<Option<String>> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT host_key_fingerprint FROM hosts WHERE id = ?1",
            params![host_id],
            |row| row.get(0),
        )
    }

    pub fn set_known_host_key(&self, host_id: &str, fingerprint: &str) -> rusqlite::Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE hosts SET host_key_fingerprint = ?2 WHERE id = ?1",
            params![host_id, fingerprint],
        )?;
        Ok(())
    }

    pub fn list_hosts(&self) -> rusqlite::Result<Vec<Host>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, label, hostname, port, username, auth_kind, key_ref, group_id, tags, accent, term_scheme, os
             FROM hosts ORDER BY label",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(Host {
                id: row.get(0)?,
                label: row.get(1)?,
                hostname: row.get(2)?,
                port: row.get::<_, i64>(3)? as u16,
                username: row.get(4)?,
                auth_kind: AuthKind::from_str(&row.get::<_, String>(5)?),
                key_ref: row.get(6)?,
                group_id: row.get(7)?,
                tags: Self::decode_tags(row.get(8)?),
                accent: row.get(9)?,
                term_scheme: row.get(10)?,
                os: row.get(11)?,
            })
        })?;
        rows.collect()
    }

    pub fn list_host_records(&self) -> rusqlite::Result<Vec<HostRecord>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare(
            "SELECT id, label, hostname, port, username, auth_kind, key_ref, group_id, tags, accent, term_scheme, host_key_fingerprint, os
             FROM hosts ORDER BY label",
        )?;
        let rows = stmt.query_map([], |row| {
            Ok(HostRecord {
                host: Host {
                    id: row.get(0)?,
                    label: row.get(1)?,
                    hostname: row.get(2)?,
                    port: row.get::<_, i64>(3)? as u16,
                    username: row.get(4)?,
                    auth_kind: AuthKind::from_str(&row.get::<_, String>(5)?),
                    key_ref: row.get(6)?,
                    group_id: row.get(7)?,
                    tags: Self::decode_tags(row.get(8)?),
                    accent: row.get(9)?,
                    term_scheme: row.get(10)?,
                    os: row.get(12)?,
                },
                host_key_fingerprint: row.get(11)?,
            })
        })?;
        rows.collect()
    }

    /// Bulk insert for import, in a single transaction: either every host and
    /// group lands or none does. Callers pass rows already filtered for
    /// collisions — this preserves the supplied ids rather than minting new
    /// ones, because keychain entries are keyed by host id.
    pub fn insert_imported(
        &self,
        hosts: &[(Host, Option<String>)],
        groups: &[Group],
    ) -> rusqlite::Result<()> {
        let mut conn = self.0.lock().unwrap();
        let tx = conn.transaction()?;
        for group in groups {
            tx.execute(
                "INSERT INTO groups (id, name, parent_id) VALUES (?1, ?2, ?3)",
                params![group.id, group.name, group.parent_id],
            )?;
        }
        for (host, fingerprint) in hosts {
            tx.execute(
                "INSERT INTO hosts (id, label, hostname, port, username, auth_kind, key_ref, group_id, tags, accent, term_scheme, host_key_fingerprint, os)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)",
                params![
                    host.id,
                    host.label,
                    host.hostname,
                    host.port,
                    host.username,
                    host.auth_kind.as_str(),
                    host.key_ref,
                    host.group_id,
                    Self::encode_tags(&host.tags),
                    host.accent,
                    host.term_scheme,
                    fingerprint,
                    host.os,
                ],
            )?;
        }
        tx.commit()
    }

    /// Used to undo an import whose keychain writes failed partway.
    pub fn delete_hosts(&self, ids: &[String]) -> rusqlite::Result<()> {
        let mut conn = self.0.lock().unwrap();
        let tx = conn.transaction()?;
        for id in ids {
            tx.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
        }
        tx.commit()
    }

    pub fn add_host(&self, new_host: NewHost) -> rusqlite::Result<Host> {
        let id = Uuid::new_v4().to_string();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO hosts (id, label, hostname, port, username, auth_kind, key_ref, group_id, tags, accent, term_scheme)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11)",
            params![
                id,
                new_host.label,
                new_host.hostname,
                new_host.port,
                new_host.username,
                new_host.auth_kind.as_str(),
                new_host.key_ref,
                new_host.group_id,
                Self::encode_tags(&new_host.tags),
                new_host.accent,
                new_host.term_scheme,
            ],
        )?;
        Ok(Host {
            id,
            label: new_host.label,
            hostname: new_host.hostname,
            port: new_host.port,
            username: new_host.username,
            auth_kind: new_host.auth_kind,
            key_ref: new_host.key_ref,
            group_id: new_host.group_id,
            tags: new_host.tags,
            accent: new_host.accent,
            term_scheme: new_host.term_scheme,
            // Unknown until the host is connected to for the first time.
            os: None,
        })
    }

    pub fn update_host(&self, host: Host) -> rusqlite::Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE hosts
             SET label = ?2, hostname = ?3, port = ?4, username = ?5, auth_kind = ?6,
                 key_ref = ?7, group_id = ?8, tags = ?9, accent = ?10, term_scheme = ?11
             WHERE id = ?1",
            params![
                host.id,
                host.label,
                host.hostname,
                host.port,
                host.username,
                host.auth_kind.as_str(),
                host.key_ref,
                host.group_id,
                Self::encode_tags(&host.tags),
                host.accent,
                host.term_scheme,
            ],
        )?;
        Ok(())
    }

    pub fn get_host_os(&self, host_id: &str) -> rusqlite::Result<Option<String>> {
        let conn = self.0.lock().unwrap();
        conn.query_row(
            "SELECT os FROM hosts WHERE id = ?1",
            params![host_id],
            |row| row.get(0),
        )
    }

    pub fn set_host_os(&self, host_id: &str, os: &str) -> rusqlite::Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE hosts SET os = ?2 WHERE id = ?1",
            params![host_id, os],
        )?;
        Ok(())
    }

    pub fn delete_host(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute("DELETE FROM hosts WHERE id = ?1", params![id])?;
        Ok(())
    }

    pub fn list_tags(&self) -> rusqlite::Result<Vec<String>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT tags FROM hosts")?;
        let all: Vec<String> = stmt
            .query_map([], |row| row.get::<_, Option<String>>(0))?
            .filter_map(Result::ok)
            .flat_map(Self::decode_tags)
            .collect();
        let mut unique: Vec<String> = all
            .into_iter()
            .fold(Vec::new(), |mut acc: Vec<String>, tag| {
                if !acc.contains(&tag) {
                    acc.push(tag);
                }
                acc
            });
        unique.sort();
        Ok(unique)
    }

    pub fn list_groups(&self) -> rusqlite::Result<Vec<Group>> {
        let conn = self.0.lock().unwrap();
        let mut stmt = conn.prepare("SELECT id, name, parent_id FROM groups ORDER BY name")?;
        let rows = stmt.query_map([], |row| {
            Ok(Group {
                id: row.get(0)?,
                name: row.get(1)?,
                parent_id: row.get(2)?,
            })
        })?;
        rows.collect()
    }

    pub fn add_group(&self, name: &str, parent_id: Option<&str>) -> rusqlite::Result<Group> {
        let id = Uuid::new_v4().to_string();
        let conn = self.0.lock().unwrap();
        conn.execute(
            "INSERT INTO groups (id, name, parent_id) VALUES (?1, ?2, ?3)",
            params![id, name, parent_id],
        )?;
        Ok(Group {
            id,
            name: name.to_string(),
            parent_id: parent_id.map(str::to_string),
        })
    }

    pub fn rename_group(&self, id: &str, name: &str) -> rusqlite::Result<()> {
        let conn = self.0.lock().unwrap();
        conn.execute(
            "UPDATE groups SET name = ?2 WHERE id = ?1",
            params![id, name],
        )?;
        Ok(())
    }

    /// Deletes a group. Its hosts are ungrouped and its subgroups are
    /// reparented to the deleted group's own parent — nothing is deleted
    /// except the group itself.
    pub fn delete_group(&self, id: &str) -> rusqlite::Result<()> {
        let conn = self.0.lock().unwrap();
        let parent: Option<String> = conn
            .query_row(
                "SELECT parent_id FROM groups WHERE id = ?1",
                params![id],
                |row| row.get(0),
            )
            .unwrap_or(None);
        conn.execute(
            "UPDATE hosts SET group_id = NULL WHERE group_id = ?1",
            params![id],
        )?;
        conn.execute(
            "UPDATE groups SET parent_id = ?2 WHERE parent_id = ?1",
            params![id, parent],
        )?;
        conn.execute("DELETE FROM groups WHERE id = ?1", params![id])?;
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn test_store() -> Store {
        let conn = Connection::open_in_memory().unwrap();
        Store::init_schema(&conn).unwrap();
        Store(Mutex::new(conn))
    }

    fn sample_host() -> NewHost {
        NewHost {
            label: "Prod box".into(),
            hostname: "10.0.0.5".into(),
            port: 22,
            username: "deploy".into(),
            auth_kind: AuthKind::Key,
            key_ref: Some("prod-key".into()),
            group_id: None,
            tags: vec![],
            accent: None,
            term_scheme: None,
        }
    }

    #[test]
    fn add_list_update_delete_roundtrip() {
        let store = test_store();

        let created = store.add_host(sample_host()).unwrap();

        let hosts = store.list_hosts().unwrap();
        assert_eq!(hosts.len(), 1);
        assert_eq!(hosts[0].id, created.id);
        assert_eq!(hosts[0].auth_kind, AuthKind::Key);
        assert!(hosts[0].tags.is_empty());

        let mut updated = created.clone();
        updated.label = "Prod box (renamed)".into();
        store.update_host(updated).unwrap();

        let hosts = store.list_hosts().unwrap();
        assert_eq!(hosts[0].label, "Prod box (renamed)");

        store.delete_host(&created.id).unwrap();
        assert!(store.list_hosts().unwrap().is_empty());
    }

    #[test]
    fn tags_round_trip_and_list_tags_dedupes() {
        let store = test_store();

        let mut host_a = sample_host();
        host_a.label = "api".into();
        host_a.tags = vec!["prod".into(), "api".into()];
        let host_a = store.add_host(host_a).unwrap();

        let mut host_b = sample_host();
        host_b.label = "mongodb".into();
        host_b.tags = vec!["prod".into(), "db".into()];
        store.add_host(host_b).unwrap();

        let hosts = store.list_hosts().unwrap();
        let a = hosts.iter().find(|h| h.id == host_a.id).unwrap();
        assert_eq!(a.tags, vec!["prod".to_string(), "api".to_string()]);

        let mut tags = store.list_tags().unwrap();
        tags.sort();
        assert_eq!(tags, vec!["api".to_string(), "db".to_string(), "prod".to_string()]);
    }

    #[test]
    fn group_crud_and_delete_ungroups_hosts() {
        let store = test_store();

        let group = store.add_group("SkillDrift", None).unwrap();
        let mut host = sample_host();
        host.group_id = Some(group.id.clone());
        let host = store.add_host(host).unwrap();

        let groups = store.list_groups().unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].name, "SkillDrift");

        store.rename_group(&group.id, "SkillDrift Renamed").unwrap();
        assert_eq!(store.list_groups().unwrap()[0].name, "SkillDrift Renamed");

        store.delete_group(&group.id).unwrap();
        assert!(store.list_groups().unwrap().is_empty());

        let hosts = store.list_hosts().unwrap();
        assert_eq!(hosts.len(), 1, "deleting a group must not delete its hosts");
        assert_eq!(hosts[0].id, host.id);
        assert_eq!(hosts[0].group_id, None, "host should be ungrouped");
    }

    #[test]
    fn nested_groups_and_delete_reparents_subgroups() {
        let store = test_store();

        let prod = store.add_group("Production", None).unwrap();
        let dbs = store.add_group("Databases", Some(&prod.id)).unwrap();
        let mut host = sample_host();
        host.group_id = Some(dbs.id.clone());
        store.add_host(host).unwrap();

        let groups = store.list_groups().unwrap();
        let dbs_row = groups.iter().find(|g| g.id == dbs.id).unwrap();
        assert_eq!(dbs_row.parent_id.as_deref(), Some(prod.id.as_str()));

        // Deleting the parent reparents "Databases" up to root (Production's parent = None).
        store.delete_group(&prod.id).unwrap();
        let groups = store.list_groups().unwrap();
        assert_eq!(groups.len(), 1);
        assert_eq!(groups[0].id, dbs.id);
        assert_eq!(groups[0].parent_id, None, "subgroup should reparent to root");
        assert_eq!(store.list_hosts().unwrap().len(), 1, "hosts survive group delete");
    }
}
