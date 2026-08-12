use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;

use crate::errors::{AppError, AppResult};

const MYMEMORY_ENDPOINT: &str = "https://api.mymemory.translated.net/get";

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MyMemoryResponse {
    response_data: MyMemoryResponseData,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct MyMemoryResponseData {
    translated_text: String,
}

pub async fn translate_en_to_pt_br(text: &str) -> AppResult<Option<String>> {
    let text = text.trim();

    if text.is_empty() {
        return Ok(None);
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|error| AppError::new("translation_provider_error", error.to_string()))?;

    let response = client
        .get(MYMEMORY_ENDPOINT)
        .query(&[("q", text), ("langpair", "en|pt-BR")])
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                AppError::new(
                    "translation_timeout",
                    "A tradução demorou demais para responder.",
                )
            } else {
                AppError::new("translation_provider_error", error.to_string())
            }
        })?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let payload = response
        .json::<MyMemoryResponse>()
        .await
        .map_err(|error| AppError::new("translation_provider_error", error.to_string()))?;
    let translated_text = payload.response_data.translated_text.trim();

    if translated_text.is_empty() || translated_text.eq_ignore_ascii_case(text) {
        Ok(None)
    } else {
        Ok(Some(translated_text.to_string()))
    }
}
