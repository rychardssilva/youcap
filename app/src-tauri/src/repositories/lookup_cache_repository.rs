use sqlx::SqlitePool;

use crate::{
    dto::lookup_dto::LookupResultDto,
    errors::{AppError, AppResult},
};

pub async fn find_by_normalized_query(
    pool: &SqlitePool,
    normalized_query: &str,
) -> AppResult<Option<LookupResultDto>> {
    let result_json = sqlx::query_scalar::<_, String>(
        r#"
        SELECT result_json
        FROM lookup_cache
        WHERE normalized_query = ?1
        "#,
    )
    .bind(normalized_query)
    .fetch_optional(pool)
    .await?;

    result_json
        .map(|json| {
            serde_json::from_str::<LookupResultDto>(&json)
                .map_err(|error| AppError::new("lookup_cache_error", error.to_string()))
        })
        .transpose()
}

pub async fn upsert_lookup_result(
    pool: &SqlitePool,
    normalized_query: &str,
    result: &LookupResultDto,
) -> AppResult<()> {
    let result_json = serde_json::to_string(result)
        .map_err(|error| AppError::new("lookup_cache_error", error.to_string()))?;

    sqlx::query(
        r#"
        INSERT INTO lookup_cache (normalized_query, query, result_json, source)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(normalized_query)
        DO UPDATE SET
          query = excluded.query,
          result_json = excluded.result_json,
          source = excluded.source,
          updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(normalized_query)
    .bind(&result.query)
    .bind(result_json)
    .bind(&result.source)
    .execute(pool)
    .await?;

    Ok(())
}
