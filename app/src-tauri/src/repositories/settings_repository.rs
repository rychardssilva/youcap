use sqlx::SqlitePool;

use crate::{errors::AppResult, models::setting::Setting};

pub async fn upsert_setting(pool: &SqlitePool, key: &str, value: &str) -> AppResult<Setting> {
    sqlx::query(
        r#"
        INSERT INTO settings (key, value)
        VALUES (?1, ?2)
        ON CONFLICT(key)
        DO UPDATE SET
          value = excluded.value,
          updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(key)
    .bind(value)
    .execute(pool)
    .await?;

    find_setting(pool, key).await
}

pub async fn list_settings(pool: &SqlitePool) -> AppResult<Vec<Setting>> {
    let settings = sqlx::query_as::<_, Setting>(
        r#"
        SELECT key, value, updated_at
        FROM settings
        ORDER BY key ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(settings)
}

pub async fn get_setting(pool: &SqlitePool, key: &str) -> AppResult<Option<Setting>> {
    let setting = sqlx::query_as::<_, Setting>(
        r#"
        SELECT key, value, updated_at
        FROM settings
        WHERE key = ?1
        "#,
    )
    .bind(key)
    .fetch_optional(pool)
    .await?;

    Ok(setting)
}

pub async fn count_settings(pool: &SqlitePool) -> AppResult<i64> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM settings")
        .fetch_one(pool)
        .await?;

    Ok(count)
}

async fn find_setting(pool: &SqlitePool, key: &str) -> AppResult<Setting> {
    let setting = sqlx::query_as::<_, Setting>(
        r#"
        SELECT key, value, updated_at
        FROM settings
        WHERE key = ?1
        "#,
    )
    .bind(key)
    .fetch_one(pool)
    .await?;

    Ok(setting)
}
