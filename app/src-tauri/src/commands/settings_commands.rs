use tauri::State;

use crate::{
    dto::settings_dto::UpsertSettingRequest, errors::AppError, models::setting::Setting,
    services::settings_service, state::AppState,
};

#[tauri::command]
pub async fn upsert_setting(
    state: State<'_, AppState>,
    request: UpsertSettingRequest,
) -> Result<Setting, AppError> {
    settings_service::upsert_setting(&state.db, request).await
}

#[tauri::command]
pub async fn list_settings(state: State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    settings_service::list_settings(&state.db).await
}
