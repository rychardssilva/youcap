use std::time::Duration;

use reqwest::{Client, StatusCode};
use serde::{Deserialize, Serialize};

use crate::{
    dto::lookup_dto::{LookupExampleDto, LookupLexicalRelationDto, LookupResultDto},
    dto::word_dto::RelatedWordDto,
    errors::{AppError, AppResult},
};

const GEMINI_MODEL: &str = "gemini-3.5-flash-lite";
const GEMINI_ENDPOINT: &str =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent";

#[derive(Debug, Serialize)]
struct GeminiRequest {
    contents: Vec<GeminiContent>,
    #[serde(rename = "generationConfig")]
    generation_config: GeminiGenerationConfig,
}

#[derive(Debug, Serialize)]
struct GeminiContent {
    parts: Vec<GeminiPart>,
}

#[derive(Debug, Serialize)]
struct GeminiGenerationConfig {
    #[serde(rename = "responseMimeType")]
    response_mime_type: String,
    #[serde(rename = "maxOutputTokens")]
    max_output_tokens: u16,
    temperature: f32,
}

#[derive(Debug, Serialize, Deserialize)]
struct GeminiPart {
    text: String,
}

#[derive(Debug, Deserialize)]
struct GeminiResponse {
    candidates: Option<Vec<GeminiCandidate>>,
}

#[derive(Debug, Deserialize)]
struct GeminiErrorResponse {
    error: Option<GeminiError>,
}

#[derive(Debug, Deserialize)]
struct GeminiError {
    code: Option<u16>,
    message: Option<String>,
    status: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GeminiCandidate {
    content: Option<GeminiContentResponse>,
}

#[derive(Debug, Deserialize)]
struct GeminiContentResponse {
    parts: Option<Vec<GeminiPart>>,
}

#[derive(Debug, Deserialize)]
struct PartialLookupResultDto {
    query: Option<String>,
    word: Option<String>,
    translation: Option<String>,
    meaning: Option<String>,
    meaning_translation: Option<String>,
    contextual_explanation: Option<String>,
    contextual_explanation_translation: Option<String>,
    part_of_speech: Option<String>,
    synonyms: Option<Vec<PartialLexicalRelationDto>>,
    antonyms: Option<Vec<PartialLexicalRelationDto>>,
    reference_image_url: Option<String>,
    examples: Option<Vec<LookupExampleDto>>,
    source: Option<String>,
    warnings: Option<Vec<String>>,
}

#[derive(Debug, Deserialize)]
struct PartialLexicalRelationDto {
    term: Option<String>,
    translation: Option<String>,
}

#[derive(Debug, Deserialize)]
struct RelatedWordsResponse {
    related_words: Option<Vec<PartialRelatedWordDto>>,
}

#[derive(Debug, Deserialize)]
struct PartialRelatedWordDto {
    term: Option<String>,
    translation: Option<String>,
}

pub async fn contextual_lookup(text: &str, api_key: Option<String>) -> AppResult<LookupResultDto> {
    let normalized_text = normalize_text(text)?;
    let Some(api_key) = api_key.filter(|key| !key.trim().is_empty()) else {
        return Ok(fallback_lookup(&normalized_text, "Gemini API key ausente."));
    };

    let client = Client::builder()
        .timeout(Duration::from_secs(7))
        .build()
        .map_err(|error| AppError::new("lookup_provider_error", error.to_string()))?;

    let response = client
        .post(GEMINI_ENDPOINT)
        .header("x-goog-api-key", api_key.trim())
        .json(&GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: build_prompt(&normalized_text),
                }],
            }],
            generation_config: GeminiGenerationConfig {
                response_mime_type: "application/json".to_string(),
                max_output_tokens: 420,
                temperature: 0.2,
            },
        })
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                AppError::new(
                    "lookup_timeout",
                    "A consulta demorou demais para responder.",
                )
            } else {
                AppError::new("lookup_provider_error", error.to_string())
            }
        })?;

    let status = response.status();

    if !status.is_success() {
        let body = response.text().await.unwrap_or_default();
        return Ok(fallback_lookup(
            &normalized_text,
            &gemini_error_message(status, &body),
        ));
    }

    let payload = response
        .json::<GeminiResponse>()
        .await
        .map_err(|error| AppError::new("lookup_provider_error", error.to_string()))?;

    let Some(text_response) = payload
        .candidates
        .and_then(|candidates| candidates.into_iter().next())
        .and_then(|candidate| candidate.content)
        .and_then(|content| content.parts)
        .and_then(|parts| parts.into_iter().next())
        .map(|part| part.text)
    else {
        return Ok(fallback_lookup(
            &normalized_text,
            "Gemini retornou uma resposta vazia.",
        ));
    };

    parse_lookup_response(&normalized_text, &text_response)
}

pub async fn related_words(
    term: &str,
    api_key: Option<String>,
    limit: usize,
) -> AppResult<Vec<RelatedWordDto>> {
    let normalized_term = normalize_text(term)?;
    let Some(api_key) = api_key.filter(|key| !key.trim().is_empty()) else {
        return Ok(Vec::new());
    };

    if is_phrase(&normalized_term) {
        return Ok(Vec::new());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(5))
        .build()
        .map_err(|error| AppError::new("lookup_provider_error", error.to_string()))?;

    let response = client
        .post(GEMINI_ENDPOINT)
        .header("x-goog-api-key", api_key.trim())
        .json(&GeminiRequest {
            contents: vec![GeminiContent {
                parts: vec![GeminiPart {
                    text: build_related_words_prompt(&normalized_term, limit),
                }],
            }],
            generation_config: GeminiGenerationConfig {
                response_mime_type: "application/json".to_string(),
                max_output_tokens: 220,
                temperature: 0.2,
            },
        })
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                AppError::new(
                    "lookup_timeout",
                    "A consulta de palavras relacionadas demorou demais.",
                )
            } else {
                AppError::new("lookup_provider_error", error.to_string())
            }
        })?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let payload = response
        .json::<GeminiResponse>()
        .await
        .map_err(|error| AppError::new("lookup_provider_error", error.to_string()))?;

    let Some(text_response) = payload
        .candidates
        .and_then(|candidates| candidates.into_iter().next())
        .and_then(|candidate| candidate.content)
        .and_then(|content| content.parts)
        .and_then(|parts| parts.into_iter().next())
        .map(|part| part.text)
    else {
        return Ok(Vec::new());
    };

    Ok(parse_related_words_response(
        &normalized_term,
        &text_response,
        limit,
    ))
}

fn gemini_error_message(status: StatusCode, body: &str) -> String {
    let parsed_error = serde_json::from_str::<GeminiErrorResponse>(body)
        .ok()
        .and_then(|response| response.error);

    if let Some(error) = parsed_error {
        let raw_message = error
            .message
            .unwrap_or_else(|| "Gemini recusou a consulta.".to_string());
        let message = translate_gemini_provider_message(&raw_message);
        let status_label = error.status.unwrap_or_else(|| status.to_string());
        let code = error.code.unwrap_or(status.as_u16());

        return format!("Gemini respondeu {code} ({status_label}): {message}");
    }

    format!("Gemini respondeu HTTP {}.", status.as_u16())
}

fn translate_gemini_provider_message(message: &str) -> String {
    let lower_message = message.to_lowercase();

    if lower_message.contains("quota")
        || lower_message.contains("resource_exhausted")
        || lower_message.contains("rate limit")
    {
        return "O limite gratuito do Gemini foi atingido. Tente novamente mais tarde ou use outra chave de API."
            .to_string();
    }

    if lower_message.contains("api key")
        || lower_message.contains("credential")
        || lower_message.contains("permission")
    {
        return "A chave do Gemini parece inválida ou sem permissão. Confira a chave nas configurações."
            .to_string();
    }

    if lower_message.contains("model") && lower_message.contains("not found") {
        return "O modelo configurado do Gemini não está disponível para esta chave.".to_string();
    }

    message.to_string()
}

fn build_prompt(text: &str) -> String {
    format!(
        "Return only valid JSON. Analyze this English text for a Brazilian learner. query must preserve the full text. translation must be the full pt-BR translation of query. meaning and contextual_explanation must be in English. meaning_translation and contextual_explanation_translation must be pt-BR. For a single English word, include 2-5 synonyms and 1-3 antonyms with pt-BR translations when useful. For phrases, synonyms and antonyms can be empty. Shape: {{\"query\":\"\",\"word\":\"\",\"translation\":\"\",\"meaning\":\"\",\"meaning_translation\":\"\",\"contextual_explanation\":\"\",\"contextual_explanation_translation\":\"\",\"part_of_speech\":null,\"synonyms\":[{{\"term\":\"\",\"translation\":\"\"}}],\"antonyms\":[{{\"term\":\"\",\"translation\":\"\"}}],\"examples\":[{{\"original_text\":\"\",\"translated_text\":\"\"}}],\"source\":\"gemini\",\"warnings\":[]}}. Text: {text}"
    )
}

fn build_related_words_prompt(term: &str, limit: usize) -> String {
    format!(
        "Return only valid JSON. For the English word \"{term}\", list up to {limit} semantic related English words useful for a Brazilian learner. Use single lexical words only: synonyms, near-synonyms, hypernyms, hyponyms, or closely related concepts. Do not use words copied from a sentence, function words, time markers, articles, pronouns, or full phrases. Do not include the same word. Each item must have term in English and translation in pt-BR. Shape: {{\"related_words\":[{{\"term\":\"\",\"translation\":\"\"}}]}}"
    )
}

fn parse_related_words_response(term: &str, response: &str, limit: usize) -> Vec<RelatedWordDto> {
    let parsed = serde_json::from_str::<RelatedWordsResponse>(response)
        .or_else(|_| serde_json::from_str::<RelatedWordsResponse>(&clean_markdown_json(response)))
        .ok();
    let normalized_term = term.trim().to_lowercase();
    let mut seen = std::collections::HashSet::new();
    let mut related_words = Vec::new();

    for item in parsed
        .and_then(|payload| payload.related_words)
        .unwrap_or_default()
    {
        let Some(term) = item
            .term
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty())
        else {
            continue;
        };
        let normalized_related = normalize_related_word(&term);

        if !is_related_word_candidate(&normalized_related)
            || normalized_related == normalized_term
            || !seen.insert(normalized_related)
        {
            continue;
        }

        related_words.push(RelatedWordDto {
            term,
            translation: item
                .translation
                .map(|value| value.trim().to_string())
                .filter(|value| !value.is_empty()),
            source: "gemini".to_string(),
        });

        if related_words.len() >= limit {
            break;
        }
    }

    related_words
}

fn normalize_related_word(term: &str) -> String {
    term.split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
        .trim_matches(|character: char| {
            !character.is_alphanumeric() && character != '\'' && character != '-'
        })
        .to_lowercase()
}

fn is_related_word_candidate(term: &str) -> bool {
    !term.is_empty()
        && term.chars().count() >= 3
        && !is_phrase(term)
        && !matches!(
            term,
            "the"
                | "and"
                | "for"
                | "with"
                | "from"
                | "that"
                | "this"
                | "ago"
                | "year"
                | "years"
                | "was"
                | "were"
                | "are"
                | "been"
        )
}

fn parse_lookup_response(query: &str, response: &str) -> AppResult<LookupResultDto> {
    let result = match parse_lookup_json(response) {
        Ok(result) => result,
        Err(_) => {
            return Ok(fallback_lookup(
            query,
            "Não foi possível interpretar a resposta completa da IA. A tradução básica será usada quando disponível.",
        ));
        }
    };

    normalize_result(query, result)
}

fn parse_lookup_json(response: &str) -> AppResult<PartialLookupResultDto> {
    serde_json::from_str::<PartialLookupResultDto>(response)
        .or_else(|_| serde_json::from_str::<PartialLookupResultDto>(&clean_markdown_json(response)))
        .or_else(|_| {
            extract_json_object(response)
                .ok_or_else(|| AppError::new("invalid_lookup_response", "JSON não encontrado."))
                .and_then(|json| {
                    serde_json::from_str::<PartialLookupResultDto>(&json).map_err(|error| {
                        AppError::new("invalid_lookup_response", error.to_string())
                    })
                })
        })
}

fn clean_markdown_json(response: &str) -> String {
    response
        .trim()
        .trim_start_matches("```json")
        .trim_start_matches("```")
        .trim_end_matches("```")
        .trim()
        .to_string()
}

fn extract_json_object(response: &str) -> Option<String> {
    let start = response.find('{')?;
    let end = response.rfind('}')?;

    if start >= end {
        return None;
    }

    Some(response[start..=end].to_string())
}

fn fallback_lookup(query: &str, warning: &str) -> LookupResultDto {
    let word = infer_main_word(query);

    LookupResultDto {
        query: query.to_string(),
        word: word.clone(),
        translation: "Tradução indisponível".to_string(),
        meaning: "Não foi possível obter o significado automaticamente.".to_string(),
        meaning_translation: Some(
            "Não foi possível traduzir o significado automaticamente.".to_string(),
        ),
        contextual_explanation: "Configure a chave do Gemini para receber explicação contextual."
            .to_string(),
        contextual_explanation_translation: Some(
            "Configure a chave do Gemini para receber uma explicação contextual.".to_string(),
        ),
        part_of_speech: None,
        synonyms: Vec::new(),
        antonyms: Vec::new(),
        reference_image_url: None,
        examples: vec![LookupExampleDto {
            original_text: query.to_string(),
            translated_text: None,
        }],
        source: "fallback-local".to_string(),
        warnings: vec![warning.to_string()],
    }
}

fn normalize_result(query: &str, result: PartialLookupResultDto) -> AppResult<LookupResultDto> {
    let query = normalize_text(query)?;
    let ai_query = result
        .query
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty());
    let word = result
        .word
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_string)
        .unwrap_or_else(|| infer_main_word(&query));
    let translation = required_or_fallback(result.translation.as_deref(), "Tradução indisponível");
    let meaning = required_or_fallback(
        result.meaning.as_deref(),
        "A IA não informou o significado desta consulta.",
    );
    let contextual_explanation = required_or_fallback(
        result.contextual_explanation.as_deref(),
        "A IA não informou uma explicação contextual para esta consulta.",
    );
    let mut warnings = result.warnings.unwrap_or_default();

    if result
        .word
        .as_deref()
        .is_none_or(|value| value.trim().is_empty())
    {
        warnings.push(
            "A IA não informou o campo word; a consulta foi usada como fallback.".to_string(),
        );
    }
    let synonyms = normalize_lexical_relations(result.synonyms, &word);
    let antonyms = normalize_lexical_relations(result.antonyms, &word);

    let mut normalized = LookupResultDto {
        query: ai_query
            .filter(|value| value.eq_ignore_ascii_case(&query))
            .map(str::to_string)
            .unwrap_or(query),
        word,
        translation,
        meaning,
        meaning_translation: result
            .meaning_translation
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        contextual_explanation,
        contextual_explanation_translation: result
            .contextual_explanation_translation
            .map(|value| value.trim().to_string())
            .filter(|value| !value.is_empty()),
        part_of_speech: result.part_of_speech,
        synonyms,
        antonyms,
        reference_image_url: result.reference_image_url,
        examples: result.examples.unwrap_or_default(),
        source: result.source.unwrap_or_else(|| GEMINI_MODEL.to_string()),
        warnings,
    };

    normalized.meaning_translation = normalized
        .meaning_translation
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    normalized.contextual_explanation_translation = normalized
        .contextual_explanation_translation
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty());
    normalized
        .warnings
        .retain(|warning| !warning.trim().is_empty());
    if normalized.examples.is_empty() {
        normalized.examples.push(LookupExampleDto {
            original_text: normalized.query.clone(),
            translated_text: Some(normalized.translation.clone()),
        });
    }

    if normalized.examples.len() > 3 {
        normalized.examples.truncate(3);
    }

    Ok(normalized)
}

fn normalize_lexical_relations(
    values: Option<Vec<PartialLexicalRelationDto>>,
    current_word: &str,
) -> Vec<LookupLexicalRelationDto> {
    let current_word = current_word.trim().to_lowercase();
    let mut seen = std::collections::HashSet::new();
    let mut result = Vec::new();

    for value in values.unwrap_or_default() {
        let Some(term) = value
            .term
            .map(|term| term.trim().to_string())
            .filter(|term| !term.is_empty())
        else {
            continue;
        };

        let normalized_term = term.trim().to_lowercase();
        if normalized_term == current_word
            || is_phrase(&normalized_term)
            || !seen.insert(normalized_term)
        {
            continue;
        }

        result.push(LookupLexicalRelationDto {
            term,
            translation: value
                .translation
                .map(|translation| translation.trim().to_string())
                .filter(|translation| !translation.is_empty()),
        });

        if result.len() >= 6 {
            break;
        }
    }

    result
}

fn is_phrase(text: &str) -> bool {
    text.split_whitespace()
        .filter(|part| part.chars().any(char::is_alphabetic))
        .take(2)
        .count()
        > 1
}

fn normalize_text(text: &str) -> AppResult<String> {
    let text = text.trim();

    if text.is_empty() {
        return Err(AppError::new(
            "invalid_lookup_text",
            "Informe um texto para consultar.",
        ));
    }

    if text.chars().count() > 600 {
        return Err(AppError::new(
            "invalid_lookup_text",
            "O texto da consulta deve ter no maximo 600 caracteres.",
        ));
    }

    Ok(text.to_string())
}

fn required_or_fallback(value: Option<&str>, fallback: &str) -> String {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .unwrap_or(fallback)
        .to_string()
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
