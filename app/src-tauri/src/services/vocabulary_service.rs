use std::env;

use sqlx::SqlitePool;

use crate::{
    dto::word_dto::{
        CreateWordRequest, RelatedWordDto, SearchWordsRequest, SearchWordsResponse,
        UpdateWordDetailsRequest, WordDetailsDto, WordSort,
    },
    errors::{AppError, AppResult},
    models::word::Word,
    providers::ai::gemini_provider,
    repositories::{settings_repository, word_repository},
};

pub async fn create_word(pool: &SqlitePool, request: CreateWordRequest) -> AppResult<Word> {
    let term = request.term.trim();

    if term.is_empty() {
        return Err(AppError::new(
            "validation_error",
            "A palavra nao pode ficar vazia.",
        ));
    }

    let language = request.language.unwrap_or_else(|| "en".to_string());

    word_repository::create_or_update_word(
        pool,
        term,
        &language,
        request.translation.as_deref(),
        request.context.as_deref(),
    )
    .await
}

pub async fn list_words(pool: &SqlitePool) -> AppResult<Vec<Word>> {
    word_repository::list_words(pool).await
}

pub async fn search_words(
    pool: &SqlitePool,
    request: SearchWordsRequest,
) -> AppResult<SearchWordsResponse> {
    let query = request.query.map(|value| normalize_search_query(&value));
    let query = query.filter(|value| !value.is_empty());

    if query
        .as_ref()
        .is_some_and(|value| value.chars().count() > 120)
    {
        return Err(AppError::new(
            "validation_error",
            "A pesquisa deve ter no maximo 120 caracteres.",
        ));
    }

    word_repository::search_words(
        pool,
        query.as_deref(),
        request.sort.unwrap_or(WordSort::LastLookup),
        request.limit.unwrap_or(20),
        request.offset.unwrap_or(0),
    )
    .await
}

pub async fn get_word_details(pool: &SqlitePool, word_id: &str) -> AppResult<WordDetailsDto> {
    word_repository::get_word_details(pool, word_id)
        .await?
        .ok_or_else(|| AppError::new("word_not_found", "Palavra nao encontrada."))
}

pub async fn update_word_details(
    pool: &SqlitePool,
    request: UpdateWordDetailsRequest,
) -> AppResult<WordDetailsDto> {
    if request.id.trim().is_empty() {
        return Err(AppError::new(
            "validation_error",
            "A palavra selecionada e invalida.",
        ));
    }

    if let Some(term) = request.term.as_deref() {
        validate_optional_field("palavra original", term, 160)?;
        if term.trim().is_empty() {
            return Err(AppError::new(
                "validation_error",
                "A palavra original nao pode ficar vazia.",
            ));
        }
    }

    if let Some(translation) = request.translation.as_deref() {
        validate_optional_field("traducao", translation, 240)?;
    }

    if let Some(meaning) = request.meaning.as_deref() {
        validate_optional_field("significado", meaning, 800)?;
    }

    if let Some(pronunciation) = request.pronunciation.as_deref() {
        validate_optional_field("pronuncia", pronunciation, 500)?;
    }

    if let Some(ipa) = request.ipa.as_deref() {
        validate_optional_field("IPA", ipa, 120)?;
    }

    if let Some(part_of_speech) = request.part_of_speech.as_deref() {
        validate_optional_field("classe gramatical", part_of_speech, 80)?;
    }

    if let Some(difficulty) = request.difficulty {
        if !(0..=5).contains(&difficulty) {
            return Err(AppError::new(
                "validation_error",
                "A dificuldade deve ficar entre 0 e 5.",
            ));
        }
    }

    if let Some(frequency_rank) = request.frequency_rank {
        if frequency_rank < 1 {
            return Err(AppError::new(
                "validation_error",
                "A frequencia precisa ser um numero positivo.",
            ));
        }
    }

    if let Some(frequency_band) = request.frequency_band.as_deref() {
        validate_optional_field("faixa de frequencia", frequency_band, 80)?;
    }

    if let Some(example_original) = request.example_original.as_deref() {
        validate_optional_field("exemplo", example_original, 600)?;
    }

    if let Some(example_translation) = request.example_translation.as_deref() {
        validate_optional_field("traducao do exemplo", example_translation, 600)?;
    }

    if let Some(synonyms) = request.synonyms.as_deref() {
        validate_optional_field("sinonimos", synonyms, 800)?;
    }

    if let Some(antonyms) = request.antonyms.as_deref() {
        validate_optional_field("antonimos", antonyms, 800)?;
    }

    if let Some(personal_note) = request.personal_note.as_deref() {
        validate_optional_field("anotacao pessoal", personal_note, 1200)?;
    }

    if let Some(personal_sentence) = request.personal_sentence.as_deref() {
        validate_optional_field("frase propria", personal_sentence, 600)?;
    }

    if let Some(personal_sentence_translation) = request.personal_sentence_translation.as_deref() {
        validate_optional_field(
            "traducao da frase propria",
            personal_sentence_translation,
            600,
        )?;
    }

    if let Some(tags) = request.tags.as_deref() {
        validate_optional_field("tags", tags, 500)?;
    }

    if let Some(review_rating) = request.review_rating.as_deref() {
        validate_review_rating(review_rating)?;
    }

    if let Some(review_scheduled_for) = request.review_scheduled_for.as_deref() {
        validate_optional_field("data de revisao", review_scheduled_for, 40)?;
    }

    if let Some(status) = request.status.as_deref() {
        validate_status(status)?;
    }

    word_repository::update_basic_details(
        pool,
        request.id.trim(),
        request.term.as_deref(),
        request.translation.as_deref(),
        request.meaning.as_deref(),
        request.status.as_deref(),
        request.pronunciation.as_deref(),
        request.ipa.as_deref(),
        request.part_of_speech.as_deref(),
        request.difficulty,
        request.frequency_rank,
        request.frequency_band.as_deref(),
        request.example_original.as_deref(),
        request.example_translation.as_deref(),
        request.synonyms.as_deref(),
        request.antonyms.as_deref(),
        request.personal_note.as_deref(),
        request.personal_sentence.as_deref(),
        request.personal_sentence_translation.as_deref(),
        request.tags.as_deref(),
        request.review_rating.as_deref(),
        request.review_scheduled_for.as_deref(),
    )
    .await?;

    get_word_details(pool, request.id.trim()).await
}

pub async fn get_related_words(
    pool: &SqlitePool,
    _word_id: &str,
    term: &str,
    limit: i64,
) -> AppResult<Vec<RelatedWordDto>> {
    let limit = limit.clamp(1, 12);
    let normalized_term = normalize_related_term(term);

    if normalized_term.is_empty() || is_phrase(&normalized_term) {
        return Ok(Vec::new());
    }

    let suggested_words = gemini_provider::related_words(
        &normalized_term,
        lookup_api_key(pool).await?,
        limit as usize,
    )
    .await
    .unwrap_or_default();

    let mut related_words = Vec::new();
    for mut word in suggested_words {
        if !is_related_word_candidate(&word.term, &normalized_term) {
            continue;
        }

        if let Some(local_translation) =
            word_repository::find_saved_translation_by_term(pool, &word.term, "en").await?
        {
            word.translation = Some(local_translation);
            word.source = "local".to_string();
        }

        related_words.push(word);
    }

    Ok(dedupe_related_words(related_words, &normalized_term)
        .into_iter()
        .take(limit as usize)
        .collect())
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

fn dedupe_related_words(words: Vec<RelatedWordDto>, current_term: &str) -> Vec<RelatedWordDto> {
    let current_term = normalize_related_term(current_term);
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for word in words {
        let normalized = normalize_related_term(&word.term);
        if normalized.is_empty() || normalized == current_term || !seen.insert(normalized) {
            continue;
        }

        result.push(word);
    }

    result
}

fn is_related_word_candidate(term: &str, current_term: &str) -> bool {
    let normalized = normalize_related_term(term);

    !normalized.is_empty()
        && normalized != normalize_related_term(current_term)
        && normalized.chars().count() >= 3
        && !is_phrase(&normalized)
        && !is_function_word(&normalized)
}

fn normalize_related_term(term: &str) -> String {
    term.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(|character: char| {
            !character.is_alphanumeric() && character != '\'' && character != '-'
        })
        .to_lowercase()
}

fn is_function_word(term: &str) -> bool {
    matches!(
        term,
        "a" | "an"
            | "and"
            | "are"
            | "as"
            | "at"
            | "be"
            | "been"
            | "being"
            | "by"
            | "for"
            | "from"
            | "had"
            | "has"
            | "have"
            | "he"
            | "her"
            | "his"
            | "i"
            | "in"
            | "is"
            | "it"
            | "its"
            | "of"
            | "on"
            | "or"
            | "she"
            | "that"
            | "the"
            | "their"
            | "them"
            | "they"
            | "this"
            | "to"
            | "was"
            | "we"
            | "were"
            | "with"
            | "you"
            | "your"
            | "ago"
            | "year"
            | "years"
    )
}

fn is_phrase(term: &str) -> bool {
    term.split_whitespace()
        .filter(|part| part.chars().any(char::is_alphabetic))
        .take(2)
        .count()
        > 1
}

fn normalize_search_query(query: &str) -> String {
    query.split_whitespace().collect::<Vec<_>>().join(" ")
}

fn validate_optional_field(label: &str, value: &str, max_chars: usize) -> AppResult<()> {
    let value = value.trim();
    if value.is_empty() {
        return Ok(());
    }

    if value.chars().count() > max_chars {
        return Err(AppError::new(
            "validation_error",
            format!("O campo {label} deve ter no maximo {max_chars} caracteres."),
        ));
    }

    Ok(())
}

fn validate_status(status: &str) -> AppResult<()> {
    match status.trim() {
        "new" | "learning" | "difficult" | "known" | "mastered" | "archived" => Ok(()),
        _ => Err(AppError::new(
            "validation_error",
            "O status da palavra e invalido.",
        )),
    }
}

fn validate_review_rating(rating: &str) -> AppResult<()> {
    match rating.trim() {
        "again" | "hard" | "good" | "easy" => Ok(()),
        _ => Err(AppError::new(
            "validation_error",
            "A revisao precisa ser marcada como repetir, dificil, boa ou facil.",
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::{dedupe_related_words, is_related_word_candidate};
    use crate::dto::word_dto::RelatedWordDto;

    #[test]
    fn related_word_filter_rejects_context_and_function_words() {
        assert!(is_related_word_candidate("town", "village"));
        assert!(is_related_word_candidate("settlement", "village"));
        assert!(!is_related_word_candidate("the", "village"));
        assert!(!is_related_word_candidate("ago", "village"));
        assert!(!is_related_word_candidate("years", "village"));
        assert!(!is_related_word_candidate(
            "Twelve years ago the Village Hidden",
            "village"
        ));
        assert!(!is_related_word_candidate("village", "Village"));
    }

    #[test]
    fn related_words_are_deduplicated_without_current_term() {
        let words = vec![
            RelatedWordDto {
                term: "Town".to_string(),
                translation: Some("cidade".to_string()),
                source: "gemini".to_string(),
            },
            RelatedWordDto {
                term: "town".to_string(),
                translation: Some("cidade".to_string()),
                source: "local".to_string(),
            },
            RelatedWordDto {
                term: "Village".to_string(),
                translation: Some("vila".to_string()),
                source: "gemini".to_string(),
            },
        ];

        let deduped = dedupe_related_words(words, "village");

        assert_eq!(deduped.len(), 1);
        assert_eq!(deduped[0].term, "Town");
    }
}
