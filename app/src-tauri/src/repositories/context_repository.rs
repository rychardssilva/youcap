use sqlx::{Sqlite, Transaction};
use uuid::Uuid;

use crate::errors::AppResult;

pub async fn create_context(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: &str,
    original_text: &str,
    highlighted_text: Option<&str>,
    source: Option<&str>,
) -> AppResult<()> {
    let id = Uuid::new_v4().to_string();

    sqlx::query(
        r#"
        INSERT INTO contexts (id, word_id, original_text, highlighted_text, source)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
    )
    .bind(id)
    .bind(word_id)
    .bind(original_text.trim())
    .bind(highlighted_text.map(str::trim))
    .bind(source.map(str::trim))
    .execute(&mut **transaction)
    .await?;

    Ok(())
}
