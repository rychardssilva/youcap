use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;

use crate::errors::{AppError, AppResult};

const FREE_DICTIONARY_ENDPOINT: &str = "https://api.dictionaryapi.dev/api/v2/entries/en";

#[derive(Debug, Clone)]
pub struct PronunciationResult {
    pub ipa: Option<String>,
    pub audio_url: Option<String>,
    pub part_of_speech: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DictionaryEntry {
    phonetic: Option<String>,
    phonetics: Option<Vec<DictionaryPhonetic>>,
    meanings: Option<Vec<DictionaryMeaning>>,
}

#[derive(Debug, Deserialize)]
struct DictionaryPhonetic {
    text: Option<String>,
    audio: Option<String>,
}

#[derive(Debug, Deserialize)]
struct DictionaryMeaning {
    #[serde(rename = "partOfSpeech")]
    part_of_speech: Option<String>,
}

pub async fn lookup_pronunciation(term: &str) -> AppResult<Option<PronunciationResult>> {
    let Some(word) = normalize_single_word(term) else {
        return Ok(None);
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|error| AppError::new("pronunciation_provider_error", error.to_string()))?;

    let response = client
        .get(format!("{FREE_DICTIONARY_ENDPOINT}/{word}"))
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                AppError::new(
                    "pronunciation_timeout",
                    "A consulta de pronuncia demorou demais para responder.",
                )
            } else {
                AppError::new("pronunciation_provider_error", error.to_string())
            }
        })?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let entries = response
        .json::<Vec<DictionaryEntry>>()
        .await
        .map_err(|error| AppError::new("pronunciation_provider_error", error.to_string()))?;

    Ok(entries.into_iter().find_map(pronunciation_from_entry))
}

fn pronunciation_from_entry(entry: DictionaryEntry) -> Option<PronunciationResult> {
    let mut ipa = entry
        .phonetic
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    let mut audio_url = None;
    let part_of_speech = entry
        .meanings
        .unwrap_or_default()
        .into_iter()
        .find_map(|meaning| {
            meaning
                .part_of_speech
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string)
        });

    for phonetic in entry.phonetics.unwrap_or_default() {
        if ipa.is_none() {
            ipa = phonetic
                .text
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
        }

        if audio_url.is_none() {
            audio_url = phonetic
                .audio
                .as_deref()
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_string);
        }
    }

    if ipa.is_none() && audio_url.is_none() && part_of_speech.is_none() {
        None
    } else {
        Some(PronunciationResult {
            ipa,
            audio_url,
            part_of_speech,
        })
    }
}

fn normalize_single_word(term: &str) -> Option<String> {
    let normalized = term
        .trim()
        .trim_matches(|character: char| !character.is_alphabetic())
        .to_lowercase();

    if normalized.is_empty()
        || normalized.split_whitespace().count() > 1
        || !normalized
            .chars()
            .all(|character| character.is_ascii_alphabetic())
    {
        None
    } else {
        Some(normalized)
    }
}
