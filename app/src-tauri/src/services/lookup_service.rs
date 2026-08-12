use std::{env, time::Instant};

use sqlx::SqlitePool;
use uuid::Uuid;

use crate::{
    dto::lookup_dto::{LookupExampleDto, LookupLexicalRelationDto, LookupResultDto},
    errors::{AppError, AppResult},
    models::word::Word,
    providers::{ai::gemini_provider, translation::mymemory_provider},
    repositories::{lookup_cache_repository, settings_repository, word_repository},
    services::image_service,
};

pub async fn lookup_text(pool: &SqlitePool, text: &str) -> AppResult<LookupResultDto> {
    let started_at = Instant::now();
    let normalized_query = normalize_lookup_query(text)?;
    let cache_key = normalized_cache_key(&normalized_query);

    if let Some(result) =
        lookup_cache_repository::find_by_normalized_query(pool, &cache_key).await?
    {
        let mut result = result;
        enrich_with_reference_image_if_needed(pool, &mut result).await;
        record_lookup(pool, &result, started_at.elapsed().as_millis() as i64).await?;
        return Ok(result);
    }

    let api_key = lookup_api_key(pool).await?;
    let mut result = match gemini_provider::contextual_lookup(&normalized_query, api_key).await {
        Ok(result) => result,
        Err(error) => fallback_lookup_from_free_translation(&normalized_query, error).await,
    };

    enrich_with_free_translation_if_needed(&mut result).await;
    enrich_with_reference_image_if_needed(pool, &mut result).await;

    if is_cacheable_lookup(&result) {
        lookup_cache_repository::upsert_lookup_result(pool, &cache_key, &result).await?;
    }

    record_lookup(pool, &result, started_at.elapsed().as_millis() as i64).await?;

    Ok(result)
}

pub async fn save_lookup_result(pool: &SqlitePool, result: &LookupResultDto) -> AppResult<Word> {
    let word = word_repository::create_or_update_word_with_source(
        pool,
        &result.word,
        "en",
        Some(&result.translation),
        Some(&result.query),
        &result.source,
    )
    .await?;

    sqlx::query(
        r#"
        UPDATE words
        SET part_of_speech = ?1,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = ?2
        "#,
    )
    .bind(&result.part_of_speech)
    .bind(&word.id)
    .execute(pool)
    .await?;

    for example in result.examples.iter().take(3) {
        sqlx::query(
            r#"
            INSERT INTO examples (id, word_id, original_text, translated_text, source)
            VALUES (?1, ?2, ?3, ?4, ?5)
            "#,
        )
        .bind(Uuid::new_v4().to_string())
        .bind(&word.id)
        .bind(example.original_text.trim())
        .bind(&example.translated_text)
        .bind(&result.source)
        .execute(pool)
        .await?;
    }

    save_lexical_relations(pool, &word.id, "synonym", &result.synonyms, &result.source).await?;
    save_lexical_relations(pool, &word.id, "antonym", &result.antonyms, &result.source).await?;
    save_phrase_words(pool, result, &word.id).await?;

    Ok(word)
}

async fn save_lexical_relations(
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

async fn save_phrase_words(
    pool: &SqlitePool,
    result: &LookupResultDto,
    main_word_id: &str,
) -> AppResult<()> {
    let phrase_words = words_from_phrase(&result.query);

    if phrase_words.len() <= 1 {
        return Ok(());
    }

    for term in phrase_words.into_iter().take(16) {
        let translation = translation_for_phrase_word(&term).await;
        let saved_word = word_repository::create_or_update_word_with_source(
            pool,
            &term,
            "en",
            translation.as_deref(),
            Some(&result.query),
            &result.source,
        )
        .await?;

        if saved_word.id == main_word_id {
            continue;
        }

        for example in result.examples.iter().take(2) {
            sqlx::query(
                r#"
                INSERT INTO examples (id, word_id, original_text, translated_text, source)
                VALUES (?1, ?2, ?3, ?4, ?5)
                "#,
            )
            .bind(Uuid::new_v4().to_string())
            .bind(&saved_word.id)
            .bind(example.original_text.trim())
            .bind(&example.translated_text)
            .bind(&result.source)
            .execute(pool)
            .await?;
        }
    }

    Ok(())
}

async fn translation_for_phrase_word(term: &str) -> Option<String> {
    if let Some(translation) = local_word_translation(term) {
        return Some(translation.to_string());
    }

    mymemory_provider::translate_en_to_pt_br(term)
        .await
        .ok()
        .flatten()
}

async fn lookup_api_key(pool: &SqlitePool) -> AppResult<Option<String>> {
    if let Ok(api_key) = env::var("GEMINI_API_KEY") {
        if !api_key.trim().is_empty() {
            return Ok(Some(api_key));
        }
    }

    Ok(settings_repository::get_setting(pool, "gemini_api_key")
        .await?
        .map(|setting| setting.value)
        .filter(|value| !value.trim().is_empty()))
}

async fn record_lookup(
    pool: &SqlitePool,
    result: &LookupResultDto,
    duration_ms: i64,
) -> AppResult<()> {
    sqlx::query(
        r#"
        INSERT INTO lookups (id, query, source, duration_ms)
        VALUES (?1, ?2, ?3, ?4)
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&result.query)
    .bind(&result.source)
    .bind(duration_ms)
    .execute(pool)
    .await?;

    Ok(())
}

async fn enrich_with_free_translation_if_needed(result: &mut LookupResultDto) {
    let translation_unavailable = result
        .translation
        .eq_ignore_ascii_case("Tradução indisponível");
    let translation_too_short =
        is_translation_suspiciously_short(&result.query, &result.translation);

    if !translation_unavailable && !translation_too_short {
        return;
    }

    match mymemory_provider::translate_en_to_pt_br(&result.query).await {
        Ok(Some(translation)) => {
            let replaced_translation = result.translation.clone();
            result.translation = translation.clone();

            if translation_unavailable {
                result.contextual_explanation =
                    "Tradução gratuita gerada pelo MyMemory. Configure o Gemini para uma explicação contextual mais completa."
                        .to_string();
                result.contextual_explanation_translation = Some(
                    "Tradução gratuita gerada pelo MyMemory. Configure o Gemini para uma explicação contextual mais completa."
                        .to_string(),
                );
                result.meaning_translation =
                    Some("Não foi possível gerar o significado completo sem o Gemini.".to_string());
            }

            if let Some(example) = result.examples.first_mut() {
                example.translated_text = Some(translation);
            }

            if translation_unavailable {
                result.source = "mymemory-fallback".to_string();
                result
                    .warnings
                    .retain(|warning| !warning.contains("Gemini API key ausente"));
                result.warnings.push(
                    "Gemini não configurado; usando tradução gratuita sem explicação por IA."
                        .to_string(),
                );
            } else {
                result.source = format!("{}+mymemory-translation", result.source);
                result.warnings.push(format!(
                    "A tradução original parecia curta demais para a frase inteira e foi substituída. Tradução anterior: {replaced_translation}"
                ));
            }
        }
        Ok(None) => {}
        Err(error) => result
            .warnings
            .push(format!("Tradução gratuita indisponível: {}", error.message)),
    }
}

async fn enrich_with_reference_image_if_needed(pool: &SqlitePool, result: &mut LookupResultDto) {
    if result.reference_image_url.is_some()
        || is_phrase(&result.word)
        || !image_service::is_visual_lookup_candidate(&result.word)
    {
        return;
    }

    match image_service::lookup_reference_image(pool, &result.word).await {
        Ok(Some(image_url)) => {
            result.reference_image_url = Some(image_url);

            if !result.source.contains("reference-image") {
                result.source = format!("{}+reference-image", result.source);
            }
        }
        Ok(None) => {}
        Err(error) => result.warnings.push(format!(
            "Não foi possível carregar imagem de referência automaticamente: {}",
            error.message
        )),
    }
}

async fn fallback_lookup_from_free_translation(query: &str, error: AppError) -> LookupResultDto {
    let translation = match mymemory_provider::translate_en_to_pt_br(query).await {
        Ok(Some(translation)) => translation,
        Ok(None) => "Tradução indisponível".to_string(),
        Err(translation_error) => {
            return local_fallback_lookup(
                query,
                "Tradução indisponível",
                vec![
                    format!("Gemini indisponível: {}", error.message),
                    format!(
                        "Tradução gratuita indisponível: {}",
                        translation_error.message
                    ),
                ],
            );
        }
    };

    let mut result = local_fallback_lookup(
        query,
        &translation,
        vec![format!("Gemini indisponível: {}", error.message)],
    );
    result.source = "mymemory-fallback".to_string();
    result.contextual_explanation =
        "A tradução da frase completa está disponível, mas a explicação contextual da IA não pode ser gerada."
            .to_string();
    result.contextual_explanation_translation = Some(
        "A tradução da frase completa está disponível, mas a explicação contextual da IA não pode ser gerada."
            .to_string(),
    );
    result.meaning =
        "Use a frase capturada como contexto principal até o provedor de IA estar disponível."
            .to_string();
    result.meaning_translation = Some(
        "Use a frase capturada como contexto principal até o provedor de IA estar disponível."
            .to_string(),
    );

    result
}

fn local_fallback_lookup(query: &str, translation: &str, warnings: Vec<String>) -> LookupResultDto {
    LookupResultDto {
        query: query.to_string(),
        word: infer_main_word(query),
        translation: translation.to_string(),
        meaning: "Não foi possível obter o significado automaticamente.".to_string(),
        meaning_translation: Some(
            "Não foi possível obter o significado automaticamente.".to_string(),
        ),
        contextual_explanation:
            "O texto capturado foi traduzido, mas o contexto completo depende do provedor de IA."
                .to_string(),
        contextual_explanation_translation: Some(
            "Não foi possível gerar uma explicação contextual automaticamente.".to_string(),
        ),
        part_of_speech: None,
        synonyms: Vec::new(),
        antonyms: Vec::new(),
        reference_image_url: None,
        examples: vec![LookupExampleDto {
            original_text: query.to_string(),
            translated_text: if translation.eq_ignore_ascii_case("Tradução indisponível") {
                None
            } else {
                Some(translation.to_string())
            },
        }],
        source: "fallback-local".to_string(),
        warnings,
    }
}

fn is_translation_suspiciously_short(query: &str, translation: &str) -> bool {
    let query_word_count = meaningful_word_count(query);
    let translation_word_count = meaningful_word_count(translation);

    query_word_count >= 5 && translation_word_count <= 2
}

fn is_cacheable_lookup(result: &LookupResultDto) -> bool {
    !result
        .translation
        .trim()
        .eq_ignore_ascii_case("Tradução indisponível")
}

fn normalize_lookup_query(text: &str) -> AppResult<String> {
    let normalized = text.split_whitespace().collect::<Vec<_>>().join(" ");

    if normalized.is_empty() {
        return Err(AppError::new(
            "invalid_lookup_text",
            "Informe um texto para consultar.",
        ));
    }

    if normalized.chars().count() > 600 {
        return Err(AppError::new(
            "invalid_lookup_text",
            "O texto da consulta deve ter no maximo 600 caracteres.",
        ));
    }

    Ok(normalized)
}

fn normalized_cache_key(text: &str) -> String {
    text.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .to_lowercase()
}

fn words_from_phrase(text: &str) -> Vec<String> {
    let mut words = Vec::new();

    for raw_word in text.split_whitespace() {
        let word = raw_word
            .trim_matches(|character: char| !character.is_alphanumeric() && character != '\'')
            .trim();

        if word.is_empty()
            || !word.chars().any(char::is_alphabetic)
            || words
                .iter()
                .any(|existing: &String| existing.eq_ignore_ascii_case(word))
        {
            continue;
        }

        words.push(word.to_string());
    }

    words
}

fn local_word_translation(term: &str) -> Option<&'static str> {
    match term.trim().to_lowercase().as_str() {
        "a" | "an" => Some("um/uma"),
        "i" => Some("eu"),
        "the" => Some("o/a"),
        "of" => Some("de"),
        "to" => Some("para"),
        "in" => Some("em"),
        "on" => Some("em/sobre"),
        "and" => Some("e"),
        "or" => Some("ou"),
        "but" => Some("mas"),
        "is" => Some("é/está"),
        "are" => Some("são/estão"),
        "was" => Some("era/estava"),
        "were" => Some("eram/estavam"),
        _ => None,
    }
}

fn infer_main_word(text: &str) -> String {
    let words = text
        .split_whitespace()
        .filter(|part| part.chars().any(char::is_alphabetic))
        .collect::<Vec<_>>();

    if words.len() > 1 {
        return text.to_string();
    }

    words
        .first()
        .map(|part| {
            part.trim_matches(|character: char| !character.is_alphanumeric())
                .to_string()
        })
        .filter(|part| !part.is_empty())
        .unwrap_or_else(|| text.to_string())
}

fn meaningful_word_count(text: &str) -> usize {
    text.split_whitespace()
        .filter(|word| word.chars().any(char::is_alphabetic))
        .count()
}

pub fn is_phrase(text: &str) -> bool {
    meaningful_word_count(text) > 1
}

#[cfg(test)]
mod tests {
    use super::{
        is_cacheable_lookup, is_translation_suspiciously_short, local_fallback_lookup,
        local_word_translation, normalize_lookup_query, normalized_cache_key, words_from_phrase,
    };

    #[test]
    fn lookup_query_is_trimmed_and_spaces_are_normalized() {
        let normalized = normalize_lookup_query("  I   ran   out   of   time  ").unwrap();

        assert_eq!(normalized, "I ran out of time");
    }

    #[test]
    fn cache_key_ignores_case_and_extra_spaces() {
        assert_eq!(
            normalized_cache_key("  I   Ran OUT of time "),
            "i ran out of time"
        );
    }

    #[test]
    fn long_phrase_with_tiny_translation_is_suspicious() {
        assert!(is_translation_suspiciously_short(
            "Twelve years ago the Village Hidden",
            "Aldeia"
        ));
    }

    #[test]
    fn short_word_translation_is_not_suspicious() {
        assert!(!is_translation_suspiciously_short("context", "contexto"));
    }

    #[test]
    fn unavailable_translation_is_not_cacheable() {
        let result = local_fallback_lookup("context", "Tradução indisponível", Vec::new());

        assert!(!is_cacheable_lookup(&result));
    }

    #[test]
    fn fallback_for_phrase_keeps_full_query_as_word() {
        let result = local_fallback_lookup("I ran out of time", "Fiquei sem tempo", Vec::new());

        assert_eq!(result.word, "I ran out of time");
        assert_eq!(result.translation, "Fiquei sem tempo");
    }

    #[test]
    fn words_from_phrase_keeps_single_letter_words() {
        let words = words_from_phrase("This is a word, and a word again.");

        assert_eq!(words, vec!["This", "is", "a", "word", "and", "again"]);
    }

    #[test]
    fn common_single_letter_word_has_translation() {
        assert_eq!(local_word_translation("a"), Some("um/uma"));
    }
}
