use serde::Deserialize;

#[derive(Debug, Deserialize)]
pub struct UpsertSettingRequest {
    pub key: String,
    pub value: String,
}
