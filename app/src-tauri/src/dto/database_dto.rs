use serde::Serialize;

#[derive(Debug, Serialize)]
pub struct DatabaseHealth {
    pub status: String,
    pub words_count: i64,
    pub lookups_count: i64,
    pub settings_count: i64,
}
