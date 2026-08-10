use sqlx::SqlitePool;

use crate::{
    dto::settings_dto::UpsertSettingRequest,
    errors::{AppError, AppResult},
    models::setting::Setting,
    repositories::settings_repository,
};

pub async fn upsert_setting(
    pool: &SqlitePool,
    request: UpsertSettingRequest,
) -> AppResult<Setting> {
    let key = request.key.trim();

    if key.is_empty() {
        return Err(AppError::new(
            "validation_error",
            "A chave da configuracao nao pode ficar vazia.",
        ));
    }

    let value = request.value.trim();

    if value.is_empty() && !allows_empty_value(key) {
        return Err(AppError::new(
            "validation_error",
            "O valor da configuracao nao pode ficar vazio.",
        ));
    }

    validate_setting_value(key, value)?;

    settings_repository::upsert_setting(pool, key, value).await
}

pub async fn list_settings(pool: &SqlitePool) -> AppResult<Vec<Setting>> {
    settings_repository::list_settings(pool).await
}

fn allows_empty_value(key: &str) -> bool {
    matches!(
        key,
        "ocr_space_api_key" | "gemini_api_key" | "pexels_api_key"
    )
}

fn validate_setting_value(key: &str, value: &str) -> AppResult<()> {
    match key {
        "theme" if !matches!(value, "light" | "dark") => Err(AppError::new(
            "validation_error",
            "O tema precisa ser light ou dark.",
        )),
        "target_language" if value != "pt-BR" => Err(AppError::new(
            "validation_error",
            "O MVP aceita apenas portugues do Brasil como idioma de destino.",
        )),
        "ocr_provider" if value != "ocr_space" => Err(AppError::new(
            "validation_error",
            "Provider de OCR invalido para o MVP.",
        )),
        "ai_provider" if value != "gemini" => Err(AppError::new(
            "validation_error",
            "Provider de IA invalido para o MVP.",
        )),
        "global_shortcut" if !looks_like_shortcut(value) => Err(AppError::new(
            "validation_error",
            "O atalho global precisa ter ao menos um modificador e uma tecla.",
        )),
        _ => Ok(()),
    }
}

fn looks_like_shortcut(value: &str) -> bool {
    let parts: Vec<&str> = value.split('+').map(str::trim).collect();

    parts.len() >= 2
        && parts.iter().all(|part| !part.is_empty())
        && parts.iter().any(|part| {
            matches!(
                part.to_ascii_lowercase().as_str(),
                "ctrl" | "control" | "commandorcontrol" | "command" | "shift" | "alt" | "option"
            )
        })
}
