use std::time::Duration;

use reqwest::Client;
use serde::Deserialize;

use crate::errors::{AppError, AppResult};

#[derive(Debug, Deserialize)]
struct PexelsSearchResponse {
    photos: Vec<PexelsPhoto>,
}

#[derive(Debug, Deserialize)]
struct PexelsPhoto {
    src: PexelsPhotoSource,
}

#[derive(Debug, Deserialize)]
struct PexelsPhotoSource {
    large: Option<String>,
    medium: Option<String>,
    landscape: Option<String>,
}

pub async fn lookup_reference_images(
    term: &str,
    api_key: Option<String>,
    limit: usize,
) -> AppResult<Vec<String>> {
    let Some(api_key) = api_key
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty())
    else {
        return Ok(Vec::new());
    };

    let term = term.trim();
    if term.is_empty() {
        return Ok(Vec::new());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(3))
        .build()
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    let response = client
        .get("https://api.pexels.com/v1/search")
        .header("Authorization", api_key)
        .header(
            "User-Agent",
            "ImmersionVocabulary/0.1.0 (local desktop vocabulary app)",
        )
        .header("Accept", "application/json")
        .query(&[
            ("query", term),
            ("per_page", &limit.clamp(1, 12).to_string()),
            ("orientation", "landscape"),
            ("locale", "en-US"),
        ])
        .send()
        .await
        .map_err(provider_error)?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let payload = response
        .json::<PexelsSearchResponse>()
        .await
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    Ok(payload
        .photos
        .into_iter()
        .filter_map(|photo| {
            photo
                .src
                .large
                .or(photo.src.landscape)
                .or(photo.src.medium)
                .filter(|url| looks_like_image_url(url))
        })
        .take(limit)
        .collect())
}

fn looks_like_image_url(url: &str) -> bool {
    let lower_url = url.to_lowercase();
    lower_url.starts_with("https://")
        && [".jpg", ".jpeg", ".png", ".webp"]
            .iter()
            .any(|extension| lower_url.contains(extension))
}

fn provider_error(error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        AppError::new("image_timeout", "A busca de imagem demorou demais.")
    } else {
        AppError::new("image_provider_error", error.to_string())
    }
}
