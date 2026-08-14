use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum AuthKind {
    Password,
    Key,
    Agent,
}

impl AuthKind {
    pub fn as_str(&self) -> &'static str {
        match self {
            AuthKind::Password => "password",
            AuthKind::Key => "key",
            AuthKind::Agent => "agent",
        }
    }

    pub fn from_str(s: &str) -> Self {
        match s {
            "key" => AuthKind::Key,
            "agent" => AuthKind::Agent,
            _ => AuthKind::Password,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Host {
    pub id: String,
    pub label: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: AuthKind,
    pub key_ref: Option<String>,
    pub group_id: Option<String>,
    pub tags: Vec<String>,
    pub accent: Option<String>,
    pub term_scheme: Option<String>,
    #[serde(default)]
    pub os: Option<String>,
    #[serde(default)]
    pub jump_host_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NewHost {
    pub label: String,
    pub hostname: String,
    pub port: u16,
    pub username: String,
    pub auth_kind: AuthKind,
    pub key_ref: Option<String>,
    pub group_id: Option<String>,
    pub tags: Vec<String>,
    pub accent: Option<String>,
    pub term_scheme: Option<String>,
    #[serde(default)]
    pub jump_host_id: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Group {
    pub id: String,
    pub name: String,
    pub parent_id: Option<String>,
}
