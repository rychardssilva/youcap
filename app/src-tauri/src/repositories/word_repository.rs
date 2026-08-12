use sqlx::{Sqlite, SqlitePool, Transaction};
use uuid::Uuid;

use crate::{
    dto::lookup_dto::LookupLexicalRelationDto,
    dto::word_dto::{
        SearchWordsResponse, WordContextDto, WordDetailsDto, WordExampleDto, WordHistorySummaryDto,
        WordLexicalRelationDto, WordListItemDto, WordLookupDto, WordPersonalNoteDto,
        WordPersonalSentenceDto, WordReviewDto, WordSort, WordTagDto, WordTranslationDto,
    },
    errors::AppResult,
    models::word::Word,
    repositories::{context_repository, history_repository, translation_repository},
};

pub async fn create_or_update_word(
    pool: &SqlitePool,
    term: &str,
    language: &str,
    translation: Option<&str>,
    context: Option<&str>,
) -> AppResult<Word> {
    create_or_update_word_with_source(pool, term, language, translation, context, "manual-test")
        .await
}

pub async fn create_or_update_word_with_source(
    pool: &SqlitePool,
    term: &str,
    language: &str,
    translation: Option<&str>,
    context: Option<&str>,
    source: &str,
) -> AppResult<Word> {
    let normalized_term = normalize_term(term);
    let id = Uuid::new_v4().to_string();

    let mut transaction = pool.begin().await?;

    sqlx::query(
        r#"
        INSERT INTO words (id, term, normalized_term, language)
        VALUES (?1, ?2, ?3, ?4)
        ON CONFLICT(normalized_term, language)
        DO UPDATE SET
          term = excluded.term,
          updated_at = CURRENT_TIMESTAMP
        "#,
    )
    .bind(id)
    .bind(term.trim())
    .bind(&normalized_term)
    .bind(language)
    .execute(&mut *transaction)
    .await?;

    let word = find_by_normalized_term(&mut *transaction, &normalized_term, language).await?;

    if let Some(translation) = translation.filter(|value| !value.trim().is_empty()) {
        translation_repository::create_translation(
            &mut transaction,
            &word.id,
            translation,
            Some(source),
        )
        .await?;
    }

    if let Some(context) = context.filter(|value| !value.trim().is_empty()) {
        context_repository::create_context(
            &mut transaction,
            &word.id,
            context,
            Some(term),
            Some(source),
        )
        .await?;
    }

    history_repository::record_lookup(&mut transaction, Some(&word.id), term, Some(source), None)
        .await?;

    transaction.commit().await?;

    Ok(word)
}

pub async fn list_words(pool: &SqlitePool) -> AppResult<Vec<Word>> {
    let words = sqlx::query_as::<_, Word>(
        r#"
        SELECT id, term, normalized_term, language, part_of_speech,
               difficulty, status, frequency_rank, frequency_band, created_at, updated_at
        FROM words
        ORDER BY updated_at DESC, term ASC
        "#,
    )
    .fetch_all(pool)
    .await?;

    Ok(words)
}

pub async fn search_words(
    pool: &SqlitePool,
    query: Option<&str>,
    sort: WordSort,
    limit: i64,
    offset: i64,
) -> AppResult<SearchWordsResponse> {
    let search_query = query.map(str::trim).filter(|value| !value.is_empty());
    let search_pattern = search_query.map(|value| format!("%{}%", value.to_lowercase()));
    let limit = limit.clamp(1, 50);
    let offset = offset.max(0);

    let total = sqlx::query_scalar::<_, i64>(
        r#"
        SELECT COUNT(DISTINCT w.id)
        FROM words w
        LEFT JOIN translations t ON t.word_id = w.id
        WHERE ?1 IS NULL
           OR LOWER(w.term) LIKE ?1
           OR LOWER(w.normalized_term) LIKE ?1
           OR LOWER(t.translation) LIKE ?1
        "#,
    )
    .bind(&search_pattern)
    .fetch_one(pool)
    .await?;

    let items = match sort {
        WordSort::Alphabetical => {
            sqlx::query_as::<_, WordListItemDto>(
                r#"
                SELECT
                  w.id, w.term, w.normalized_term, w.language, w.part_of_speech,
                  w.difficulty, w.status, w.frequency_rank, w.frequency_band,
                  w.created_at, w.updated_at,
                  (
                    SELECT tr.translation
                    FROM translations tr
                    WHERE tr.word_id = w.id
                    ORDER BY CASE tr.kind WHEN 'main' THEN 0 ELSE 1 END, tr.created_at DESC
                    LIMIT 1
                  ) AS main_translation,
                  (
                    SELECT c.original_text
                    FROM contexts c
                    WHERE c.word_id = w.id
                    ORDER BY c.created_at DESC
                    LIMIT 1
                  ) AS latest_context,
                  MIN(l.created_at) AS first_lookup_at,
                  MAX(l.created_at) AS last_lookup_at,
                  COUNT(DISTINCT l.query || '|' || COALESCE(l.source, '') || '|' || l.created_at) AS lookups_count
                FROM words w
                LEFT JOIN translations t ON t.word_id = w.id
                LEFT JOIN lookups l ON l.word_id = w.id
                WHERE ?1 IS NULL
                   OR LOWER(w.term) LIKE ?1
                   OR LOWER(w.normalized_term) LIKE ?1
                   OR LOWER(t.translation) LIKE ?1
                GROUP BY w.id
                ORDER BY w.normalized_term ASC, w.created_at DESC
                LIMIT ?2 OFFSET ?3
                "#,
            )
            .bind(&search_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        }
        WordSort::CreatedAt => {
            sqlx::query_as::<_, WordListItemDto>(
                r#"
                SELECT
                  w.id, w.term, w.normalized_term, w.language, w.part_of_speech,
                  w.difficulty, w.status, w.frequency_rank, w.frequency_band,
                  w.created_at, w.updated_at,
                  (
                    SELECT tr.translation
                    FROM translations tr
                    WHERE tr.word_id = w.id
                    ORDER BY CASE tr.kind WHEN 'main' THEN 0 ELSE 1 END, tr.created_at DESC
                    LIMIT 1
                  ) AS main_translation,
                  (
                    SELECT c.original_text
                    FROM contexts c
                    WHERE c.word_id = w.id
                    ORDER BY c.created_at DESC
                    LIMIT 1
                  ) AS latest_context,
                  MIN(l.created_at) AS first_lookup_at,
                  MAX(l.created_at) AS last_lookup_at,
                  COUNT(DISTINCT l.query || '|' || COALESCE(l.source, '') || '|' || l.created_at) AS lookups_count
                FROM words w
                LEFT JOIN translations t ON t.word_id = w.id
                LEFT JOIN lookups l ON l.word_id = w.id
                WHERE ?1 IS NULL
                   OR LOWER(w.term) LIKE ?1
                   OR LOWER(w.normalized_term) LIKE ?1
                   OR LOWER(t.translation) LIKE ?1
                GROUP BY w.id
                ORDER BY w.created_at DESC, w.normalized_term ASC
                LIMIT ?2 OFFSET ?3
                "#,
            )
            .bind(&search_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        }
        WordSort::LastLookup => {
            sqlx::query_as::<_, WordListItemDto>(
                r#"
                SELECT
                  w.id, w.term, w.normalized_term, w.language, w.part_of_speech,
                  w.difficulty, w.status, w.frequency_rank, w.frequency_band,
                  w.created_at, w.updated_at,
                  (
                    SELECT tr.translation
                    FROM translations tr
                    WHERE tr.word_id = w.id
                    ORDER BY CASE tr.kind WHEN 'main' THEN 0 ELSE 1 END, tr.created_at DESC
                    LIMIT 1
                  ) AS main_translation,
                  (
                    SELECT c.original_text
                    FROM contexts c
                    WHERE c.word_id = w.id
                    ORDER BY c.created_at DESC
                    LIMIT 1
                  ) AS latest_context,
                  MIN(l.created_at) AS first_lookup_at,
                  MAX(l.created_at) AS last_lookup_at,
                  COUNT(DISTINCT l.query || '|' || COALESCE(l.source, '') || '|' || l.created_at) AS lookups_count
                FROM words w
                LEFT JOIN translations t ON t.word_id = w.id
                LEFT JOIN lookups l ON l.word_id = w.id
                WHERE ?1 IS NULL
                   OR LOWER(w.term) LIKE ?1
                   OR LOWER(w.normalized_term) LIKE ?1
                   OR LOWER(t.translation) LIKE ?1
                GROUP BY w.id
                ORDER BY COALESCE(MAX(l.created_at), w.updated_at) DESC, w.normalized_term ASC
                LIMIT ?2 OFFSET ?3
                "#,
            )
            .bind(&search_pattern)
            .bind(limit)
            .bind(offset)
            .fetch_all(pool)
            .await?
        }
    };

    Ok(SearchWordsResponse {
        items,
        total,
        limit,
        offset,
    })
}

pub async fn get_word_details(
    pool: &SqlitePool,
    word_id: &str,
) -> AppResult<Option<WordDetailsDto>> {
    let Some(word) = find_by_id(pool, word_id).await? else {
        return Ok(None);
    };

    let translations = sqlx::query_as::<_, WordTranslationDto>(
        r#"
        SELECT id, language, translation, kind, source, created_at
        FROM translations
        WHERE word_id = ?1
        ORDER BY created_at DESC
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let contexts = sqlx::query_as::<_, WordContextDto>(
        r#"
        SELECT id, original_text, highlighted_text, source, created_at
        FROM contexts
        WHERE word_id = ?1
        ORDER BY created_at DESC
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let examples = sqlx::query_as::<_, WordExampleDto>(
        r#"
        SELECT id, original_text, translated_text, source, created_at
        FROM examples
        WHERE word_id = ?1
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let lookups = sqlx::query_as::<_, WordLookupDto>(
        r#"
        SELECT MIN(id) AS id, query, source, MIN(duration_ms) AS duration_ms, created_at
        FROM lookups
        WHERE word_id = ?1
        GROUP BY query, source, created_at
        ORDER BY created_at DESC
        LIMIT 20
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let history_summary = sqlx::query_as::<_, WordHistorySummaryDto>(
        r#"
        SELECT
          MIN(created_at) AS first_lookup_at,
          MAX(created_at) AS last_lookup_at,
          COUNT(DISTINCT query || '|' || COALESCE(source, '') || '|' || created_at) AS lookups_count
        FROM lookups
        WHERE word_id = ?1
        "#,
    )
    .bind(word_id)
    .fetch_one(pool)
    .await?;

    let lexical_relations = sqlx::query_as::<_, WordLexicalRelationDto>(
        r#"
        SELECT id, term, relation_type, translation, source, created_at
        FROM lexical_relations
        WHERE word_id = ?1
        ORDER BY relation_type ASC, created_at DESC
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let personal_notes = sqlx::query_as::<_, WordPersonalNoteDto>(
        r#"
        SELECT id, note, created_at, updated_at
        FROM personal_notes
        WHERE word_id = ?1
        ORDER BY updated_at DESC
        LIMIT 10
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let personal_sentences = sqlx::query_as::<_, WordPersonalSentenceDto>(
        r#"
        SELECT id, original_text, translated_text, created_at, updated_at
        FROM personal_sentences
        WHERE word_id = ?1
        ORDER BY updated_at DESC
        LIMIT 10
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let reviews = sqlx::query_as::<_, WordReviewDto>(
        r#"
        SELECT id, rating, scheduled_for, reviewed_at, created_at
        FROM reviews
        WHERE word_id = ?1
        ORDER BY reviewed_at DESC
        LIMIT 10
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    let tags = sqlx::query_as::<_, WordTagDto>(
        r#"
        SELECT t.id, t.name, t.normalized_name, t.created_at
        FROM tags t
        INNER JOIN word_tags wt ON wt.tag_id = t.id
        WHERE wt.word_id = ?1
        ORDER BY t.name ASC
        "#,
    )
    .bind(word_id)
    .fetch_all(pool)
    .await?;

    Ok(Some(WordDetailsDto {
        word,
        translations,
        contexts,
        examples,
        lookups,
        history_summary,
        lexical_relations,
        personal_notes,
        personal_sentences,
        tags,
        reviews,
    }))
}

pub async fn update_basic_details(
    pool: &SqlitePool,
    word_id: &str,
    term: Option<&str>,
    translation: Option<&str>,
    meaning: Option<&str>,
    status: Option<&str>,
    part_of_speech: Option<&str>,
    difficulty: Option<i64>,
    frequency_rank: Option<i64>,
    frequency_band: Option<&str>,
    example_original: Option<&str>,
    example_translation: Option<&str>,
    synonyms: Option<&str>,
    antonyms: Option<&str>,
    personal_note: Option<&str>,
    personal_sentence: Option<&str>,
    personal_sentence_translation: Option<&str>,
    tags: Option<&str>,
    review_rating: Option<&str>,
    review_scheduled_for: Option<&str>,
) -> AppResult<()> {
    let mut transaction = pool.begin().await?;
    let normalized_term = term
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(normalize_term);

    sqlx::query(
        r#"
        UPDATE words
        SET term = COALESCE(?1, term),
            normalized_term = COALESCE(?2, normalized_term),
            status = COALESCE(?3, status),
            part_of_speech = COALESCE(?4, part_of_speech),
            difficulty = COALESCE(?5, difficulty),
            frequency_rank = COALESCE(?6, frequency_rank),
            frequency_band = COALESCE(?7, frequency_band),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?8
        "#,
    )
    .bind(term.map(str::trim).filter(|value| !value.is_empty()))
    .bind(normalized_term)
    .bind(status.map(str::trim).filter(|value| !value.is_empty()))
    .bind(
        part_of_speech
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .bind(difficulty)
    .bind(frequency_rank)
    .bind(
        frequency_band
            .map(str::trim)
            .filter(|value| !value.is_empty()),
    )
    .bind(word_id)
    .execute(&mut *transaction)
    .await?;

    if let Some(translation) = translation.map(str::trim).filter(|value| !value.is_empty()) {
        let update_result = sqlx::query(
            r#"
            UPDATE translations
            SET translation = ?1,
                source = 'manual'
            WHERE id = (
              SELECT id
              FROM translations
              WHERE word_id = ?2 AND kind = 'main'
              ORDER BY created_at DESC
              LIMIT 1
            )
            "#,
        )
        .bind(translation)
        .bind(word_id)
        .execute(&mut *transaction)
        .await?;

        if update_result.rows_affected() == 0 {
            sqlx::query(
                r#"
                INSERT INTO translations (id, word_id, language, translation, kind, source)
                VALUES (?1, ?2, 'pt-BR', ?3, 'main', 'manual')
                "#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(word_id)
            .bind(translation)
            .execute(&mut *transaction)
            .await?;
        }
    }

    if let Some(meaning) = meaning.map(str::trim).filter(|value| !value.is_empty()) {
        let update_result = sqlx::query(
            r#"
            UPDATE contexts
            SET original_text = ?1,
                source = 'manual'
            WHERE id = (
              SELECT id
              FROM contexts
              WHERE word_id = ?2 AND source = 'manual'
              ORDER BY created_at DESC
              LIMIT 1
            )
            "#,
        )
        .bind(meaning)
        .bind(word_id)
        .execute(&mut *transaction)
        .await?;

        if update_result.rows_affected() == 0 {
            sqlx::query(
                r#"
                INSERT INTO contexts (id, word_id, original_text, highlighted_text, source)
                VALUES (?1, ?2, ?3, NULL, 'manual')
                "#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(word_id)
            .bind(meaning)
            .execute(&mut *transaction)
            .await?;
        }
    }

    if let Some(example_original) = example_original
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let update_result = sqlx::query(
            r#"
            UPDATE examples
            SET original_text = ?1,
                translated_text = ?2,
                source = 'manual'
            WHERE id = (
              SELECT id
              FROM examples
              WHERE word_id = ?3 AND source = 'manual'
              ORDER BY created_at DESC
              LIMIT 1
            )
            "#,
        )
        .bind(example_original)
        .bind(
            example_translation
                .map(str::trim)
                .filter(|value| !value.is_empty()),
        )
        .bind(word_id)
        .execute(&mut *transaction)
        .await?;

        if update_result.rows_affected() == 0 {
            sqlx::query(
                r#"
                INSERT INTO examples (id, word_id, original_text, translated_text, source)
                VALUES (?1, ?2, ?3, ?4, 'manual')
                "#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(word_id)
            .bind(example_original)
            .bind(
                example_translation
                    .map(str::trim)
                    .filter(|value| !value.is_empty()),
            )
            .execute(&mut *transaction)
            .await?;
        }
    }

    replace_lexical_relations(&mut transaction, word_id, "synonym", synonyms).await?;
    replace_lexical_relations(&mut transaction, word_id, "antonym", antonyms).await?;
    replace_word_tags(&mut transaction, word_id, tags).await?;

    if let Some(note) = personal_note.map(str::trim) {
        if note.is_empty() {
            sqlx::query("DELETE FROM personal_notes WHERE word_id = ?1")
                .bind(word_id)
                .execute(&mut *transaction)
                .await?;
        } else {
            upsert_personal_note(&mut transaction, word_id, note).await?;
        }
    }

    if let Some(sentence) = personal_sentence.map(str::trim) {
        if sentence.is_empty() {
            sqlx::query("DELETE FROM personal_sentences WHERE word_id = ?1")
                .bind(word_id)
                .execute(&mut *transaction)
                .await?;
        } else {
            upsert_personal_sentence(
                &mut transaction,
                word_id,
                sentence,
                personal_sentence_translation,
            )
            .await?;
        }
    }

    if let Some(rating) = review_rating
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        sqlx::query(
            r#"
            INSERT INTO reviews (id, word_id, rating, scheduled_for)
            VALUES (?1, ?2, ?3, ?4)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(word_id)
        .bind(rating)
        .bind(
            review_scheduled_for
                .map(str::trim)
                .filter(|value| !value.is_empty()),
        )
        .execute(&mut *transaction)
        .await?;
    }

    transaction.commit().await?;

    Ok(())
}

pub async fn count_words(pool: &SqlitePool) -> AppResult<i64> {
    let count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM words")
        .fetch_one(pool)
        .await?;

    Ok(count)
}

pub async fn upsert_lexical_relations(
    pool: &SqlitePool,
    word_id: &str,
    relation_type: &str,
    relations: &[LookupLexicalRelationDto],
    source: &str,
) -> AppResult<()> {
    for relation in relations.iter().take(8) {
        let term = relation.term.trim();
        if term.is_empty() {
            continue;
        }

        sqlx::query(
            r#"
            INSERT INTO lexical_relations (id, word_id, term, relation_type, translation, source)
            VALUES (?1, ?2, ?3, ?4, ?5, ?6)
            ON CONFLICT(word_id, relation_type, term)
            DO UPDATE SET
              translation = COALESCE(excluded.translation, lexical_relations.translation),
              source = excluded.source
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(word_id)
        .bind(term)
        .bind(relation_type)
        .bind(
            relation
                .translation
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty()),
        )
        .bind(source)
        .execute(pool)
        .await?;
    }

    Ok(())
}

async fn replace_lexical_relations(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: &str,
    relation_type: &str,
    values: Option<&str>,
) -> AppResult<()> {
    let Some(values) = values else {
        return Ok(());
    };

    sqlx::query(
        r#"
        DELETE FROM lexical_relations
        WHERE word_id = ?1 AND relation_type = ?2
        "#,
    )
    .bind(word_id)
    .bind(relation_type)
    .execute(&mut **transaction)
    .await?;

    for value in split_relation_values(values) {
        sqlx::query(
            r#"
            INSERT INTO lexical_relations (id, word_id, term, relation_type, translation, source)
            VALUES (?1, ?2, ?3, ?4, NULL, 'manual')
            ON CONFLICT(word_id, relation_type, term)
            DO UPDATE SET source = 'manual'
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(word_id)
        .bind(value)
        .bind(relation_type)
        .execute(&mut **transaction)
        .await?;
    }

    Ok(())
}

async fn upsert_personal_note(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: &str,
    note: &str,
) -> AppResult<()> {
    let update_result = sqlx::query(
        r#"
        UPDATE personal_notes
        SET note = ?1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id
          FROM personal_notes
          WHERE word_id = ?2
          ORDER BY updated_at DESC
          LIMIT 1
        )
        "#,
    )
    .bind(note)
    .bind(word_id)
    .execute(&mut **transaction)
    .await?;

    if update_result.rows_affected() == 0 {
        sqlx::query(
            r#"
            INSERT INTO personal_notes (id, word_id, note)
            VALUES (?1, ?2, ?3)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(word_id)
        .bind(note)
        .execute(&mut **transaction)
        .await?;
    }

    Ok(())
}

async fn upsert_personal_sentence(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: &str,
    original_text: &str,
    translated_text: Option<&str>,
) -> AppResult<()> {
    let translated_text = translated_text
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let update_result = sqlx::query(
        r#"
        UPDATE personal_sentences
        SET original_text = ?1,
            translated_text = ?2,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = (
          SELECT id
          FROM personal_sentences
          WHERE word_id = ?3
          ORDER BY updated_at DESC
          LIMIT 1
        )
        "#,
    )
    .bind(original_text)
    .bind(translated_text)
    .bind(word_id)
    .execute(&mut **transaction)
    .await?;

    if update_result.rows_affected() == 0 {
        sqlx::query(
            r#"
            INSERT INTO personal_sentences (id, word_id, original_text, translated_text)
            VALUES (?1, ?2, ?3, ?4)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(word_id)
        .bind(original_text)
        .bind(translated_text)
        .execute(&mut **transaction)
        .await?;
    }

    Ok(())
}

fn split_relation_values(values: &str) -> Vec<&str> {
    values
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .take(20)
        .collect()
}

async fn replace_word_tags(
    transaction: &mut Transaction<'_, Sqlite>,
    word_id: &str,
    values: Option<&str>,
) -> AppResult<()> {
    let Some(values) = values else {
        return Ok(());
    };

    sqlx::query("DELETE FROM word_tags WHERE word_id = ?1")
        .bind(word_id)
        .execute(&mut **transaction)
        .await?;

    for tag_name in split_tag_values(values) {
        let normalized_name = normalize_tag_name(tag_name);
        let tag_id = Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO tags (id, name, normalized_name)
            VALUES (?1, ?2, ?3)
            ON CONFLICT(normalized_name)
            DO UPDATE SET name = excluded.name
            "#,
        )
        .bind(&tag_id)
        .bind(tag_name)
        .bind(&normalized_name)
        .execute(&mut **transaction)
        .await?;

        let existing_tag_id = sqlx::query_scalar::<_, String>(
            r#"
            SELECT id
            FROM tags
            WHERE normalized_name = ?1
            LIMIT 1
            "#,
        )
        .bind(&normalized_name)
        .fetch_one(&mut **transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO word_tags (word_id, tag_id)
            VALUES (?1, ?2)
            ON CONFLICT(word_id, tag_id) DO NOTHING
            "#,
        )
        .bind(word_id)
        .bind(existing_tag_id)
        .execute(&mut **transaction)
        .await?;
    }

    Ok(())
}

fn split_tag_values(values: &str) -> Vec<&str> {
    values
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .take(20)
        .collect()
}

fn normalize_tag_name(value: &str) -> String {
    value.trim().to_lowercase()
}

pub async fn find_saved_translation_by_term(
    pool: &SqlitePool,
    term: &str,
    language: &str,
) -> AppResult<Option<String>> {
    let normalized_term = normalize_term(term);
    let translation = sqlx::query_scalar::<_, String>(
        r#"
        SELECT tr.translation
        FROM words w
        INNER JOIN translations tr ON tr.word_id = w.id
        WHERE w.normalized_term = ?1
          AND w.language = ?2
          AND TRIM(tr.translation) != ''
        ORDER BY CASE tr.kind WHEN 'main' THEN 0 ELSE 1 END, tr.created_at DESC
        LIMIT 1
        "#,
    )
    .bind(normalized_term)
    .bind(language)
    .fetch_optional(pool)
    .await?;

    Ok(translation)
}

async fn find_by_normalized_term<'a>(
    executor: impl sqlx::Executor<'a, Database = sqlx::Sqlite>,
    normalized_term: &str,
    language: &str,
) -> AppResult<Word> {
    let word = sqlx::query_as::<_, Word>(
        r#"
        SELECT id, term, normalized_term, language, part_of_speech,
               difficulty, status, frequency_rank, frequency_band, created_at, updated_at
        FROM words
        WHERE normalized_term = ?1 AND language = ?2
        "#,
    )
    .bind(normalized_term)
    .bind(language)
    .fetch_one(executor)
    .await?;

    Ok(word)
}

async fn find_by_id(pool: &SqlitePool, word_id: &str) -> AppResult<Option<Word>> {
    let word = sqlx::query_as::<_, Word>(
        r#"
        SELECT id, term, normalized_term, language, part_of_speech,
               difficulty, status, frequency_rank, frequency_band, created_at, updated_at
        FROM words
        WHERE id = ?1
        "#,
    )
    .bind(word_id)
    .fetch_optional(pool)
    .await?;

    Ok(word)
}

fn normalize_term(term: &str) -> String {
    term.trim().to_lowercase()
}
