use serde::Serialize;

#[derive(Serialize)]
pub struct AppHealth {
    message: String,
    platform: String,
    version: String,
}

#[tauri::command]
pub fn app_health() -> AppHealth {
    AppHealth {
        message: "Nucleo Rust operacional".to_string(),
        platform: std::env::consts::OS.to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
    }
}
