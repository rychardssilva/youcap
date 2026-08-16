use tauri::{AppHandle, State};

use crate::{
    dto::settings_dto::UpsertSettingRequest, errors::AppError, models::setting::Setting,
    services::settings_service, state::AppState,
};

#[tauri::command]
pub async fn upsert_setting(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    request: UpsertSettingRequest,
) -> Result<Setting, AppError> {
    let is_run_in_background = request.key == "run_in_background";
    let run_in_background = request.value == "true";
    let setting = settings_service::upsert_setting(&state.db, request).await?;

    if is_run_in_background {
        crate::services::system_tray_service::update_tray_visibility(
            &app_handle,
            run_in_background,
        )?;
    }

    Ok(setting)
}

#[tauri::command]
pub async fn list_settings(state: State<'_, AppState>) -> Result<Vec<Setting>, AppError> {
    settings_service::list_settings(&state.db).await
}
