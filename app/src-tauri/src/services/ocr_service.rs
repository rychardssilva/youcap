use std::env;

use sqlx::SqlitePool;

use crate::{
    dto::ocr_dto::OcrResultDto, errors::AppResult, providers::ocr::ocr_space_provider,
    repositories::settings_repository,
};

pub async fn recognize_image_text(pool: &SqlitePool, image_path: &str) -> AppResult<OcrResultDto> {
    let api_key = ocr_api_key(pool).await?;
    ocr_space_provider::recognize_text(image_path, api_key).await
}

async fn ocr_api_key(pool: &SqlitePool) -> AppResult<Option<String>> {
    if let Ok(api_key) = env::var("OCR_SPACE_API_KEY") {
        if !api_key.trim().is_empty() {
            return Ok(Some(api_key));
        }
    }

    Ok(settings_repository::get_setting(pool, "ocr_space_api_key")
        .await?
        .map(|setting| setting.value)
        .filter(|value| !value.trim().is_empty()))
}
