use sqlx::SqlitePool;

use crate::{
    dto::database_dto::DatabaseHealth,
    errors::AppResult,
    repositories::{history_repository, settings_repository, word_repository},
};

pub async fn get_database_health(pool: &SqlitePool) -> AppResult<DatabaseHealth> {
    let words_count = word_repository::count_words(pool).await?;
    let lookups_count = history_repository::count_lookups(pool).await?;
    let settings_count = settings_repository::count_settings(pool).await?;

    Ok(DatabaseHealth {
        status: "ready".to_string(),
        words_count,
        lookups_count,
        settings_count,
    })
}
