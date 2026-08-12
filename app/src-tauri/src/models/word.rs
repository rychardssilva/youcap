use serde::Serialize;
use sqlx::FromRow;

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct Word {
    pub id: String,
    pub term: String,
    pub normalized_term: String,
    pub language: String,
    pub part_of_speech: Option<String>,
    pub difficulty: i64,
    pub status: String,
    pub frequency_rank: Option<i64>,
    pub frequency_band: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
