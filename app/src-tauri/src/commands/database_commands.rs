use tauri::State;

use crate::{
    dto::database_dto::DatabaseHealth, errors::AppError, services::database_service,
    state::AppState,
};

#[tauri::command]
pub async fn database_health(state: State<'_, AppState>) -> Result<DatabaseHealth, AppError> {
    database_service::get_database_health(&state.db).await
}
