use std::{env, fs, path::PathBuf};

use image::{
    codecs::png::{CompressionType, FilterType, PngEncoder},
    ColorType, DynamicImage, GenericImageView, ImageEncoder, RgbaImage,
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;
use xcap::Monitor;

use crate::{
    dto::capture_dto::{CaptureResult, CaptureSelectionRequest, CaptureSession},
    errors::{AppError, AppResult},
};

const MIN_CAPTURE_SIZE: u32 = 8;
const OCR_SELECTION_PADDING: u32 = 12;

pub fn create_capture_session(app_handle: &AppHandle) -> AppResult<CaptureSession> {
    let monitor = target_monitor()?;
    let image = monitor
        .capture_image()
        .map_err(|error| AppError::new("capture_error", error.to_string()))?;
    let monitor_x = monitor
        .x()
        .map_err(|error| AppError::new("capture_error", error.to_string()))?;
    let monitor_y = monitor
        .y()
        .map_err(|error| AppError::new("capture_error", error.to_string()))?;
    let scale_factor = monitor.scale_factor().unwrap_or(1.0).max(1.0);

    let captures_dir = capture_dir(app_handle)?;
    fs::create_dir_all(&captures_dir)?;

    let id = Uuid::new_v4().to_string();
    let image_path = captures_dir.join(format!("session_{id}.png"));
    save_rgba_png_fast(&image_path, &image)?;

    Ok(CaptureSession {
        id,
        image_path: image_path.to_string_lossy().to_string(),
        monitor_x,
        monitor_y,
        width: image.width(),
        height: image.height(),
        scale_factor,
    })
}

pub fn capture_region_from_session(
    app_handle: &AppHandle,
    selection: CaptureSelectionRequest,
) -> AppResult<CaptureResult> {
    validate_selection(&selection)?;

    let captures_dir = capture_dir(app_handle)?;
    let session_path = captures_dir.join(format!("session_{}.png", selection.session_id));
    let session_image = image::open(&session_path)
        .map_err(|error| AppError::new("capture_error", error.to_string()))?;
    let (session_width, session_height) = session_image.dimensions();

    let padded_x = selection.x.saturating_sub(OCR_SELECTION_PADDING);
    let padded_y = selection.y.saturating_sub(OCR_SELECTION_PADDING);
    let padded_right = selection
        .x
        .saturating_add(selection.width)
        .saturating_add(OCR_SELECTION_PADDING)
        .min(session_width);
    let padded_bottom = selection
        .y
        .saturating_add(selection.height)
        .saturating_add(OCR_SELECTION_PADDING)
        .min(session_height);
    let width = padded_right.saturating_sub(padded_x);
    let height = padded_bottom.saturating_sub(padded_y);

    if width < MIN_CAPTURE_SIZE || height < MIN_CAPTURE_SIZE {
        return Err(AppError::new(
            "invalid_capture_region",
            "A area selecionada ficou pequena demais para captura.",
        ));
    }

    let image = session_image.crop_imm(padded_x, padded_y, width, height);
    let image_path = captures_dir.join(format!("capture_{}.png", Uuid::new_v4()));
    save_dynamic_png_fast(&image_path, &image)?;

    Ok(CaptureResult {
        image_path: image_path.to_string_lossy().to_string(),
        width,
        height,
    })
}

fn save_dynamic_png_fast(path: &PathBuf, image: &DynamicImage) -> AppResult<()> {
    let rgba = image.to_rgba8();
    save_rgba_png_fast(path, &rgba)
}

fn save_rgba_png_fast(path: &PathBuf, image: &RgbaImage) -> AppResult<()> {
    let file = fs::File::create(path)?;
    let writer = std::io::BufWriter::new(file);
    let encoder = PngEncoder::new_with_quality(writer, CompressionType::Fast, FilterType::NoFilter);

    encoder
        .write_image(
            image.as_raw(),
            image.width(),
            image.height(),
            ColorType::Rgba8.into(),
        )
        .map_err(|error| AppError::new("capture_save_error", error.to_string()))
}

fn target_monitor() -> AppResult<Monitor> {
    if let Some((x, y)) = cursor_position() {
        if let Ok(monitor) = Monitor::from_point(x, y) {
            return Ok(monitor);
        }
    }

    let monitors =
        Monitor::all().map_err(|error| AppError::new("capture_error", error.to_string()))?;

    monitors
        .iter()
        .find(|monitor| monitor.is_primary().unwrap_or(false))
        .cloned()
        .or_else(|| monitors.first().cloned())
        .ok_or_else(|| AppError::new("capture_error", "Nenhum monitor foi encontrado."))
}

#[cfg(target_os = "windows")]
fn cursor_position() -> Option<(i32, i32)> {
    use windows::Win32::{Foundation::POINT, UI::WindowsAndMessaging::GetCursorPos};

    let mut point = POINT::default();
    let result = unsafe { GetCursorPos(&mut point) };

    result.ok().map(|_| (point.x, point.y))
}

#[cfg(not(target_os = "windows"))]
fn cursor_position() -> Option<(i32, i32)> {
    None
}

fn validate_selection(selection: &CaptureSelectionRequest) -> AppResult<()> {
    if selection.width < MIN_CAPTURE_SIZE || selection.height < MIN_CAPTURE_SIZE {
        return Err(AppError::new(
            "invalid_capture_region",
            "Selecione uma area maior para capturar.",
        ));
    }

    Ok(())
}

fn capture_dir(app_handle: &AppHandle) -> AppResult<PathBuf> {
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

        Ok(project_dir.join("data").join("captures"))
    } else {
        Ok(app_handle.path().app_data_dir()?.join("captures"))
    }
}
