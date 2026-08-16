use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::{
    dto::lookup_dto::{LookupRequest, LookupResultDto, LookupStatusDto, SaveLookupRequest},
    errors::{AppError, AppResult},
    models::word::Word,
    services::{lookup_service, technical_log_service},
    state::AppState,
};

const LOOKUP_POPUP_LABEL: &str = "lookup-popup";

#[tauri::command]
pub async fn lookup_text(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    request: LookupRequest,
) -> Result<(), AppError> {
    begin_lookup(&state, &request.text)?;

    open_lookup_popup(&app_handle, &request.text)?;
    app_handle.emit("lookup_started", request.text.clone())?;

    let app_handle_for_lookup = app_handle.clone();
    let text = request.text;
    // Essa consulta externa roda fora do comando Tauri para o popup abrir rapido e a UI nao travar
    tauri::async_runtime::spawn(async move {
        let state = app_handle_for_lookup.state::<AppState>();
        let result = match lookup_service::lookup_text(&state.db, &text).await {
            Ok(result) => result,
            Err(error) => {
                technical_log_service::log_error(&app_handle_for_lookup, "lookup.query", &error);
                let _ = finish_lookup_error(&state, error.to_string());
                let _ = app_handle_for_lookup.emit("lookup_failed", error.to_string());
                return;
            }
        };

        if let Err(error) = finish_lookup_success(&state, result.clone()) {
            technical_log_service::log_error(
                &app_handle_for_lookup,
                "lookup.finish_success",
                &error,
            );
            let _ = app_handle_for_lookup.emit("lookup_failed", error.to_string());
            return;
        }

        let _ = app_handle_for_lookup.emit("lookup_result_ready", result);
    });

    Ok(())
}

#[tauri::command]
pub fn current_lookup_status(state: State<'_, AppState>) -> Result<LookupStatusDto, AppError> {
    lookup_status(&state)
}

#[tauri::command]
pub fn current_lookup_result(state: State<'_, AppState>) -> Result<LookupResultDto, AppError> {
    let current_result = state
        .lookup_result
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao acessar estado da consulta."))?;

    current_result
        .clone()
        .ok_or_else(|| AppError::new("lookup_empty", "Nenhuma consulta foi carregada."))
}

fn begin_lookup(state: &AppState, query: &str) -> AppResult<()> {
    *state
        .lookup_query
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao acessar texto da consulta."))? =
        Some(query.to_string());
    *state
        .lookup_result
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao acessar resultado da consulta."))? =
        None;
    *state
        .lookup_error
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao acessar erro da consulta."))? = None;
    *state
        .lookup_in_progress
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao acessar status da consulta."))? = true;

    Ok(())
}

fn finish_lookup_success(state: &AppState, result: LookupResultDto) -> AppResult<()> {
    *state
        .lookup_result
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao salvar resultado da consulta."))? =
        Some(result);
    *state
        .lookup_error
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao limpar erro da consulta."))? = None;
    *state
        .lookup_in_progress
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao finalizar consulta."))? = false;

    Ok(())
}

fn finish_lookup_error(state: &AppState, error: String) -> AppResult<()> {
    *state
        .lookup_error
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao salvar erro da consulta."))? =
        Some(error);
    *state
        .lookup_in_progress
        .lock()
        .map_err(|_| AppError::new("lookup_error", "Falha ao finalizar consulta."))? = false;

    Ok(())
}

fn lookup_status(state: &AppState) -> AppResult<LookupStatusDto> {
    Ok(LookupStatusDto {
        query: state
            .lookup_query
            .lock()
            .map_err(|_| AppError::new("lookup_error", "Falha ao acessar texto da consulta."))?
            .clone(),
        result: state
            .lookup_result
            .lock()
            .map_err(|_| AppError::new("lookup_error", "Falha ao acessar resultado da consulta."))?
            .clone(),
        error: state
            .lookup_error
            .lock()
            .map_err(|_| AppError::new("lookup_error", "Falha ao acessar erro da consulta."))?
            .clone(),
        is_loading: *state
            .lookup_in_progress
            .lock()
            .map_err(|_| AppError::new("lookup_error", "Falha ao acessar status da consulta."))?,
    })
}

#[tauri::command]
pub async fn save_lookup_result(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    request: SaveLookupRequest,
) -> Result<Word, AppError> {
    let word = match lookup_service::save_lookup_result(&state.db, &request.result).await {
        Ok(word) => word,
        Err(error) => {
            technical_log_service::log_error(&app_handle, "lookup.save", &error);
            return Err(error);
        }
    };
    app_handle.emit("lookup_saved", word.clone())?;

    Ok(word)
}

#[tauri::command]
pub async fn open_lookup_details(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    window: WebviewWindow,
    request: SaveLookupRequest,
) -> Result<Word, AppError> {
    let word = match lookup_service::save_lookup_result(&state.db, &request.result).await {
        Ok(word) => word,
        Err(error) => {
            technical_log_service::log_error(&app_handle, "lookup.open_details_save", &error);
            return Err(error);
        }
    };
    app_handle.emit("lookup_details_requested", word.clone())?;

    if let Some(main_window) = app_handle.get_webview_window("main") {
        main_window.show()?;
        main_window.set_focus()?;
    }

    window.hide()?;

    Ok(word)
}

#[tauri::command]
pub fn close_lookup_popup(window: WebviewWindow) -> Result<(), AppError> {
    window.hide()?;
    Ok(())
}

fn open_lookup_popup(app_handle: &AppHandle, query: &str) -> AppResult<()> {
    if let Some(window) = app_handle.get_webview_window(LOOKUP_POPUP_LABEL) {
        // Reusar a janela evita acumular popups antigos quando o usuario consulta varias vezes.
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        app_handle,
        LOOKUP_POPUP_LABEL,
        WebviewUrl::App(format!("index.html#/lookup-popup?query={}", url_encode(query)).into()),
    )
    .title("Consulta")
    .inner_size(640.0, 680.0)
    .min_inner_size(520.0, 560.0)
    .decorations(true)
    .resizable(true)
    .always_on_top(false)
    .skip_taskbar(false)
    .visible(false)
    .build()?;

    window.show()?;
    window.set_focus()?;

    Ok(())
}

fn url_encode(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            b' ' => vec!['+'],
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}
