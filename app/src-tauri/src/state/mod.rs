use std::sync::Mutex;

use crate::dto::{capture_dto::CaptureSession, lookup_dto::LookupResultDto, ocr_dto::OcrResultDto};
use sqlx::SqlitePool;

pub struct AppState {
    pub db: SqlitePool,
    pub capture_shortcut: Mutex<Option<String>>,
    pub capture_session: Mutex<Option<CaptureSession>>,
    pub capture_in_progress: Mutex<bool>,
    pub restore_main_after_capture: Mutex<bool>,
    pub lookup_query: Mutex<Option<String>>,
    pub lookup_result: Mutex<Option<LookupResultDto>>,
    pub lookup_error: Mutex<Option<String>>,
    pub lookup_in_progress: Mutex<bool>,
    pub ocr_image_path: Mutex<Option<String>>,
    pub ocr_result: Mutex<Option<OcrResultDto>>,
    pub ocr_error: Mutex<Option<String>>,
    pub ocr_in_progress: Mutex<bool>,
}
