use std::{env, fs, io::Write, path::PathBuf};

use chrono::Utc;
use tauri::{AppHandle, Manager};

pub fn log_error(app_handle: &AppHandle, scope: &str, error: impl std::fmt::Display) {
    let line = format!("{} ERROR {scope}: {error}\n", Utc::now().to_rfc3339());
    let _ = append_log(app_handle, &line);
}

pub fn log_info(app_handle: &AppHandle, scope: &str, message: impl std::fmt::Display) {
    let line = format!("{} INFO {scope}: {message}\n", Utc::now().to_rfc3339());
    let _ = append_log(app_handle, &line);
}

fn append_log(app_handle: &AppHandle, line: &str) -> std::io::Result<()> {
    let log_dir = log_dir(app_handle)?;
    fs::create_dir_all(&log_dir)?;

    let mut file = fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(log_dir.join("immersion-vocabulary.log"))?;
    file.write_all(line.as_bytes())
}

fn log_dir(app_handle: &AppHandle) -> std::io::Result<PathBuf> {
    if cfg!(debug_assertions) {
        let current_dir = env::current_dir()?;
        let project_dir = if current_dir
            .file_name()
            .is_some_and(|name| name == "src-tauri")
        {
            current_dir
                .parent()
                .map(PathBuf::from)
                .unwrap_or(current_dir)
        } else {
            current_dir
        };

        return Ok(project_dir.join("data").join("logs"));
    }

    app_handle
        .path()
        .app_data_dir()
        .map(|path| path.join("logs"))
        .map_err(std::io::Error::other)
}
