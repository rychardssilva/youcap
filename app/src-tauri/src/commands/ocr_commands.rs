use tauri::{AppHandle, Emitter, Manager, State, WebviewUrl, WebviewWindow, WebviewWindowBuilder};

use crate::{
    dto::ocr_dto::{OcrRequest, OcrResultDto, OcrStatusDto},
    errors::{AppError, AppResult},
    services::{ocr_service, technical_log_service},
    state::AppState,
};

const OCR_REVIEW_LABEL: &str = "ocr-review";

#[tauri::command]
pub async fn recognize_image_text(
    app_handle: AppHandle,
    state: State<'_, AppState>,
    request: OcrRequest,
) -> Result<OcrResultDto, AppError> {
    recognize_and_open_review(&app_handle, &state, &request.image_path).await
}

#[tauri::command]
pub fn current_ocr_result(state: State<'_, AppState>) -> Result<OcrResultDto, AppError> {
    let current_result = state
        .ocr_result
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao acessar estado do OCR."))?;

    current_result
        .clone()
        .ok_or_else(|| AppError::new("ocr_empty", "Nenhum texto de OCR foi carregado."))
}

#[tauri::command]
pub fn current_ocr_status(state: State<'_, AppState>) -> Result<OcrStatusDto, AppError> {
    ocr_status(&state)
}

#[tauri::command]
pub fn close_ocr_review(window: WebviewWindow) -> Result<(), AppError> {
    window.hide()?;
    Ok(())
}

pub async fn recognize_and_open_review(
    app_handle: &AppHandle,
    state: &AppState,
    image_path: &str,
) -> AppResult<OcrResultDto> {
    begin_ocr(state, image_path)?;
    open_ocr_review(app_handle)?;
    app_handle.emit("ocr_started", image_path.to_string())?;

    let result = match ocr_service::recognize_image_text(&state.db, image_path).await {
        Ok(result) => result,
        Err(error) => {
            technical_log_service::log_error(app_handle, "ocr.recognize", &error);
            let _ = finish_ocr_error(state, error.to_string());
            return Err(error);
        }
    };

    finish_ocr_success(state, result.clone())?;

    if let Some(window) = app_handle.get_webview_window(OCR_REVIEW_LABEL) {
        window.emit("ocr_result_ready", result.clone())?;
        window.show()?;
        window.set_focus()?;
    }
    app_handle.emit("ocr_completed", result.clone())?;

    Ok(result)
}

fn open_ocr_review(app_handle: &AppHandle) -> AppResult<()> {
    if let Some(window) = app_handle.get_webview_window(OCR_REVIEW_LABEL) {
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let window = WebviewWindowBuilder::new(
        app_handle,
        OCR_REVIEW_LABEL,
        WebviewUrl::App("index.html#/ocr-review".into()),
    )
    .title("Texto reconhecido")
    .inner_size(640.0, 620.0)
    .min_inner_size(520.0, 500.0)
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

fn begin_ocr(state: &AppState, image_path: &str) -> AppResult<()> {
    *state
        .ocr_image_path
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao acessar imagem do OCR."))? =
        Some(image_path.to_string());
    *state
        .ocr_result
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao limpar resultado do OCR."))? = None;
    *state
        .ocr_error
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao limpar erro do OCR."))? = None;
    *state
        .ocr_in_progress
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao iniciar OCR."))? = true;

    Ok(())
}

fn finish_ocr_success(state: &AppState, result: OcrResultDto) -> AppResult<()> {
    *state
        .ocr_result
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao salvar resultado do OCR."))? =
        Some(result);
    *state
        .ocr_error
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao limpar erro do OCR."))? = None;
    *state
        .ocr_in_progress
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao finalizar OCR."))? = false;

    Ok(())
}

fn finish_ocr_error(state: &AppState, error: String) -> AppResult<()> {
    *state
        .ocr_error
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao salvar erro do OCR."))? = Some(error);
    *state
        .ocr_in_progress
        .lock()
        .map_err(|_| AppError::new("ocr_error", "Falha ao finalizar OCR."))? = false;

    Ok(())
}

fn ocr_status(state: &AppState) -> AppResult<OcrStatusDto> {
    Ok(OcrStatusDto {
        image_path: state
            .ocr_image_path
            .lock()
            .map_err(|_| AppError::new("ocr_error", "Falha ao acessar imagem do OCR."))?
            .clone(),
        result: state
            .ocr_result
            .lock()
            .map_err(|_| AppError::new("ocr_error", "Falha ao acessar resultado do OCR."))?
            .clone(),
        error: state
            .ocr_error
            .lock()
            .map_err(|_| AppError::new("ocr_error", "Falha ao acessar erro do OCR."))?
            .clone(),
        is_loading: *state
            .ocr_in_progress
            .lock()
            .map_err(|_| AppError::new("ocr_error", "Falha ao acessar status do OCR."))?,
    })
}
