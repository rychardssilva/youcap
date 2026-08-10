use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct CaptureSelectionRequest {
    pub session_id: String,
    pub x: u32,
    pub y: u32,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Clone, Serialize)]
pub struct CaptureSession {
    pub id: String,
    pub image_path: String,
    pub monitor_x: i32,
    pub monitor_y: i32,
    pub width: u32,
    pub height: u32,
    pub scale_factor: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct CaptureResult {
    pub image_path: String,
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize)]
pub struct CaptureShortcutStatus {
    pub shortcut: String,
    pub registered: bool,
}
