use std::env;

use sqlx::SqlitePool;

use crate::{
    errors::AppResult,
    providers::image::{pexels_image_provider, wikipedia_image_provider},
    repositories::settings_repository,
};

pub async fn lookup_reference_image(pool: &SqlitePool, term: &str) -> AppResult<Option<String>> {
    Ok(lookup_reference_images(pool, term, 1)
        .await?
        .into_iter()
        .next())
}

pub async fn lookup_reference_images(
    pool: &SqlitePool,
    term: &str,
    limit: usize,
) -> AppResult<Vec<String>> {
    if !is_visual_lookup_candidate(term) {
        return Ok(Vec::new());
    }

    let limit = limit.clamp(1, 12);
    let mut images =
        pexels_image_provider::lookup_reference_images(term, pexels_api_key(pool).await?, limit)
            .await
            .unwrap_or_default();

    dedupe_images(&mut images);

    if images.len() < limit {
        let remaining = limit - images.len();
        if let Ok(mut wikipedia_images) =
            wikipedia_image_provider::lookup_reference_images(term, remaining).await
        {
            images.append(&mut wikipedia_images);
            dedupe_images(&mut images);
        }
    }

    images.truncate(limit);
    Ok(images)
}

async fn pexels_api_key(pool: &SqlitePool) -> AppResult<Option<String>> {
    if let Ok(api_key) = env::var("PEXELS_API_KEY") {
        if !api_key.trim().is_empty() {
            return Ok(Some(api_key));
        }
    }

    Ok(settings_repository::get_setting(pool, "pexels_api_key")
        .await?
        .map(|setting| setting.value)
        .filter(|value| !value.trim().is_empty()))
}

fn dedupe_images(images: &mut Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    images.retain(|image| seen.insert(image_identity(image)));
}

fn image_identity(image: &str) -> String {
    image
        .split('?')
        .next()
        .unwrap_or(image)
        .rsplit('/')
        .next()
        .unwrap_or(image)
        .trim_start_matches(|character: char| character.is_ascii_digit())
        .trim_start_matches("px-")
        .to_lowercase()
}

pub(crate) fn is_visual_lookup_candidate(term: &str) -> bool {
    let normalized = normalize_term(term);

    !normalized.is_empty()
        && normalized.chars().count() >= 3
        && normalized.chars().any(char::is_alphabetic)
        && normalized.split_whitespace().count() == 1
        && !is_non_visual_word(&normalized)
}

fn normalize_term(term: &str) -> String {
    term.trim()
        .to_lowercase()
        .trim_matches(|character: char| !character.is_alphanumeric() && character != '\'')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn is_non_visual_word(term: &str) -> bool {
    matches!(
        term,
        "a" | "an"
            | "the"
            | "of"
            | "to"
            | "in"
            | "on"
            | "at"
            | "by"
            | "for"
            | "from"
            | "with"
            | "without"
            | "about"
            | "into"
            | "over"
            | "under"
            | "between"
            | "through"
            | "and"
            | "or"
            | "but"
            | "because"
            | "although"
            | "if"
            | "when"
            | "while"
            | "than"
            | "that"
            | "this"
            | "these"
            | "those"
            | "it"
            | "its"
            | "he"
            | "she"
            | "they"
            | "we"
            | "you"
            | "i"
            | "me"
            | "him"
            | "her"
            | "them"
            | "us"
            | "my"
            | "your"
            | "his"
            | "their"
            | "our"
            | "is"
            | "are"
            | "was"
            | "were"
            | "be"
            | "been"
            | "being"
            | "am"
            | "do"
            | "does"
            | "did"
            | "have"
            | "has"
            | "had"
            | "can"
            | "could"
            | "should"
            | "would"
            | "will"
            | "shall"
            | "may"
            | "might"
            | "must"
            | "not"
            | "no"
            | "yes"
            | "very"
            | "just"
            | "also"
            | "too"
            | "so"
            | "then"
            | "ago"
            | "time"
            | "way"
            | "thing"
            | "idea"
            | "context"
            | "meaning"
            | "word"
    )
}

#[cfg(test)]
mod tests {
    use super::is_visual_lookup_candidate;

    #[test]
    fn visual_lookup_rejects_function_and_abstract_words() {
        for term in [
            "the", "a", "of", "because", "should", "would", "ago", "time",
        ] {
            assert!(
                !is_visual_lookup_candidate(term),
                "{term} should not request images"
            );
        }
    }

    #[test]
    fn visual_lookup_accepts_concrete_and_descriptive_words() {
        for term in ["car", "village", "house", "river", "castle", "hidden"] {
            assert!(
                is_visual_lookup_candidate(term),
                "{term} should request images"
            );
        }
    }
}
