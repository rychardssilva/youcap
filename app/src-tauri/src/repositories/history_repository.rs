use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::errors::AppResult;

pub async fn record_lookup(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: Option<&str>,
    query: &str,
    source: Option<&str>,
    duration_ms: Option<i64>,
) -> AppResult<()> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO lookups (id, word_id, query, source, duration_ms)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
    )
    .bind(id)
    .bind(word_id)
    .bind(query.trim())
    .bind(source.map(str::trim))
    .bind(duration_ms)
    .execute(&mut **transaction)
    .await?;

    Ok(())
}

pub async fn count_lookups(pool: &SqlitePool) -> AppResult<i64> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM lookups")
        .fetch_one(pool)
        .await?;

    Ok(count)
}
