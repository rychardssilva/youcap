use std::{thread, time::Duration};

use tauri::{AppHandle, Emitter, Manager, State, WebviewWindow};

use crate::{
    dto::capture_dto::{
        CaptureResult, CaptureSelectionRequest, CaptureSession, CaptureShortcutStatus,
    },
    errors::AppError,
    services::{capture_service, technical_log_service},
    state::AppState,
};

#[tauri::command]
pub fn open_capture_overlay(
    app_handle: AppHandle,
    _state: State<'_, AppState>,
) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        thread::sleep(Duration::from_millis(80));
        let state = app_handle.state::<AppState>();
        if let Err(error) = capture_service::open_capture_window(&app_handle, &state) {
            technical_log_service::log_error(&app_handle, "capture.open_overlay", &error);
            let _ = app_handle.emit("capture_failed", error.to_string());
        }
    });

    Ok(())
}

#[tauri::command]
pub fn current_capture_session(state: State<'_, AppState>) -> Result<CaptureSession, AppError> {
    capture_service::current_capture_session(&state)
}

#[tauri::command]
pub fn register_capture_shortcut(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    shortcut: String,
) -> Result<CaptureShortcutStatus, AppError> {
    capture_service::register_capture_shortcut(&app_handle, &state, &shortcut)
}

#[tauri::command]
pub fn unregister_capture_shortcut(
    app_handle: AppHandle,
    state: State<'_, AppState>,
) -> Result<CaptureShortcutStatus, AppError> {
    capture_service::unregister_capture_shortcut(&app_handle, &state)
}

#[tauri::command]
pub fn capture_shortcut_status(
    state: State<'_, AppState>,
) -> Result<CaptureShortcutStatus, AppError> {
    capture_service::capture_shortcut_status(&state)
}

#[tauri::command]
pub fn complete_capture_selection(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    window: WebviewWindow,
    selection: CaptureSelectionRequest,
) -> Result<CaptureResult, AppError> {
    let result = capture_service::capture_selection(&app_handle, &state, selection)?;
    app_handle.emit("capture_completed", result.clone())?;
    window.hide()?;

    let app_handle_for_ocr = app_handle.clone();
    let image_path = result.image_path.clone();
    tauri::async_runtime::spawn(async move {
        let state = app_handle_for_ocr.state::<AppState>();
        if let Err(error) = crate::commands::ocr_commands::recognize_and_open_review(
            &app_handle_for_ocr,
            &state,
            &image_path,
        )
        .await
        {
            technical_log_service::log_error(
                &app_handle_for_ocr,
                "capture.ocr_after_selection",
                &error,
            );
            let _ = app_handle_for_ocr.emit("ocr_failed", error.to_string());
        }
    });

    Ok(result)
}

#[tauri::command]
pub fn cancel_capture(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    window: WebviewWindow,
) -> Result<(), AppError> {
    capture_service::cancel_capture(&app_handle, &state)?;
    app_handle.emit("capture_cancelled", ())?;
    window.hide()?;
    Ok(())
}
