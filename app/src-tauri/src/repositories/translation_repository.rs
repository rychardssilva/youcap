use sqlx::{Sqlite, Transaction};
use uuid::Uuid;

use crate::errors::AppResult;

pub async fn create_translation(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: &str,
    translation: &str,
    source: Option<&str>,
) -> AppResult<()> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO translations (id, word_id, translation, source)
        VALUES (?1, ?2, ?3, ?4)
        "#,
    )
    .bind(id)
    .bind(word_id)
    .bind(translation.trim())
    .bind(source.map(str::trim))
    .execute(&mut **transaction)
    .await?;

    Ok(())
}
