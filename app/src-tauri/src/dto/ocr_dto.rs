use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct OcrRequest {
    pub image_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct OcrResultDto {
    pub image_path: String,
    pub text: String,
    pub provider: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct OcrStatusDto {
    pub image_path: Option<String>,
    pub result: Option<OcrResultDto>,
    pub error: Option<String>,
    pub is_loading: bool,
}
