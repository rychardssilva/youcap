use std::{thread, time::Duration};

use tauri::{
    AppHandle, Emitter, Manager, PhysicalPosition, PhysicalSize, WebviewUrl, WebviewWindow,
    WebviewWindowBuilder,
};
use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};

use crate::{
    dto::capture_dto::{
        CaptureResult, CaptureSelectionRequest, CaptureSession, CaptureShortcutStatus,
    },
    errors::{AppError, AppResult},
    providers::capture::xcap_capture_provider,
    state::AppState,
};

const CAPTURE_WINDOW_LABEL: &str = "capture-overlay";
pub const DEFAULT_CAPTURE_SHORTCUT: &str = "CommandOrControl+Shift+E";

pub fn open_capture_window(app_handle: &AppHandle, state: &AppState) -> AppResult<()> {
    begin_capture(state)?;
    let main_was_hidden = hide_main_window_for_capture(app_handle, state)?;

    if main_was_hidden {
        wait_for_desktop_after_window_hide();
    }

    let session = match xcap_capture_provider::create_capture_session(app_handle) {
        Ok(session) => session,
        Err(error) => {
            let _ = restore_main_window_after_capture(app_handle, state);
            let _ = end_capture(state);
            return Err(error);
        }
    };

    {
        let mut current_session = match state.capture_session.lock() {
            Ok(session) => session,
            Err(_) => {
                let _ = restore_main_window_after_capture(app_handle, state);
                let _ = end_capture(state);
                return Err(AppError::new(
                    "capture_error",
                    "Falha ao acessar estado da sessão de captura.",
                ));
            }
        };
        *current_session = Some(session.clone());
    }

    if let Some(window) = app_handle.get_webview_window(CAPTURE_WINDOW_LABEL) {
        configure_capture_window(&window, &session)?;
        window.emit("capture_session_ready", session)?;
        window.show()?;
        window.set_focus()?;
        return Ok(());
    }

    let build_result = WebviewWindowBuilder::new(
        app_handle,
        CAPTURE_WINDOW_LABEL,
        WebviewUrl::App("index.html#/capture-overlay".into()),
    )
    .title("Selecionar area")
    .position(
        logical_size(session.monitor_x, session.scale_factor),
        logical_size(session.monitor_y, session.scale_factor),
    )
    .inner_size(
        logical_size(session.width, session.scale_factor),
        logical_size(session.height, session.scale_factor),
    )
    .decorations(false)
    .resizable(false)
    .shadow(false)
    .always_on_top(true)
    .skip_taskbar(true)
    .visible(false)
    .build();

    let window = match build_result {
        Ok(window) => window,
        Err(error) => {
            let _ = restore_main_window_after_capture(app_handle, state);
            let _ = end_capture(state);
            return Err(AppError::from(error));
        }
    };

    if let Err(error) = configure_capture_window(&window, &session) {
        let _ = restore_main_window_after_capture(app_handle, state);
        let _ = end_capture(state);
        return Err(error);
    }

    window.show()?;
    window.set_focus()?;

    Ok(())
}

pub fn register_capture_shortcut(
    app_handle: &AppHandle,
    state: &AppState,
    shortcut: &str,
) -> AppResult<CaptureShortcutStatus> {
    let shortcut = normalize_shortcut(shortcut);

    {
        let mut current_shortcut = state
            .capture_shortcut
            .lock()
            .map_err(|_| AppError::new("shortcut_error", "Falha ao acessar estado do atalho."))?;

        if let Some(previous_shortcut) = current_shortcut.as_ref() {
            let _ = app_handle
                .global_shortcut()
                .unregister(previous_shortcut.as_str());
        }

        let shortcut_for_handler = shortcut.clone();
        app_handle
            .global_shortcut()
            .on_shortcut(shortcut.as_str(), move |app, _shortcut, event| {
                if event.state == ShortcutState::Pressed {
                    let state = app.state::<AppState>();
                    let _ = open_capture_window(app, &state);
                }
            })
            .map_err(|error| AppError::new("shortcut_error", error.to_string()))?;

        *current_shortcut = Some(shortcut_for_handler);
    }

    Ok(CaptureShortcutStatus {
        shortcut,
        registered: true,
    })
}

pub fn unregister_capture_shortcut(
    app_handle: &AppHandle,
    state: &AppState,
) -> AppResult<CaptureShortcutStatus> {
    let mut current_shortcut = state
        .capture_shortcut
        .lock()
        .map_err(|_| AppError::new("shortcut_error", "Falha ao acessar estado do atalho."))?;

    if let Some(shortcut) = current_shortcut.take() {
        app_handle
            .global_shortcut()
            .unregister(shortcut.as_str())
            .map_err(|error| AppError::new("shortcut_error", error.to_string()))?;

        return Ok(CaptureShortcutStatus {
            shortcut,
            registered: false,
        });
    }

    Ok(CaptureShortcutStatus {
        shortcut: DEFAULT_CAPTURE_SHORTCUT.to_string(),
        registered: false,
    })
}

pub fn capture_shortcut_status(state: &AppState) -> AppResult<CaptureShortcutStatus> {
    let current_shortcut = state
        .capture_shortcut
        .lock()
        .map_err(|_| AppError::new("shortcut_error", "Falha ao acessar estado do atalho."))?;

    Ok(CaptureShortcutStatus {
        shortcut: current_shortcut
            .clone()
            .unwrap_or_else(|| DEFAULT_CAPTURE_SHORTCUT.to_string()),
        registered: current_shortcut.is_some(),
    })
}

pub fn capture_selection(
    app_handle: &AppHandle,
    state: &AppState,
    selection: CaptureSelectionRequest,
) -> AppResult<CaptureResult> {
    let result = xcap_capture_provider::capture_region_from_session(app_handle, selection);
    restore_main_window_after_capture(app_handle, state)?;
    clear_capture_session(state)?;
    end_capture(state)?;
    result
}

pub fn current_capture_session(state: &AppState) -> AppResult<CaptureSession> {
    let current_session = state.capture_session.lock().map_err(|_| {
        AppError::new(
            "capture_error",
            "Falha ao acessar estado da sessão de captura.",
        )
    })?;

    current_session
        .clone()
        .ok_or_else(|| AppError::new("capture_error", "Nenhuma sessão de captura foi iniciada."))
}

pub fn cancel_capture(app_handle: &AppHandle, state: &AppState) -> AppResult<()> {
    restore_main_window_after_capture(app_handle, state)?;
    clear_capture_session(state)?;
    end_capture(state)
}

fn begin_capture(state: &AppState) -> AppResult<()> {
    let mut capture_in_progress = state.capture_in_progress.lock().map_err(|_| {
        AppError::new(
            "capture_error",
            "Falha ao acessar estado da captura em andamento.",
        )
    })?;

    if *capture_in_progress {
        return Err(AppError::new(
            "capture_in_progress",
            "Uma captura ja esta em andamento.",
        ));
    }

    *capture_in_progress = true;
    Ok(())
}

fn end_capture(state: &AppState) -> AppResult<()> {
    let mut capture_in_progress = state.capture_in_progress.lock().map_err(|_| {
        AppError::new(
            "capture_error",
            "Falha ao acessar estado da captura em andamento.",
        )
    })?;
    *capture_in_progress = false;

    Ok(())
}

fn hide_main_window_for_capture(app_handle: &AppHandle, state: &AppState) -> AppResult<bool> {
    let Some(main_window) = app_handle.get_webview_window("main") else {
        return Ok(false);
    };

    let should_restore = main_window.is_visible().unwrap_or(false);

    if should_restore {
        main_window.hide()?;
    }

    let mut restore_main = state.restore_main_after_capture.lock().map_err(|_| {
        AppError::new(
            "capture_error",
            "Falha ao acessar estado da janela principal.",
        )
    })?;
    *restore_main = should_restore;

    Ok(should_restore)
}

fn wait_for_desktop_after_window_hide() {
    flush_desktop_compositor();
    thread::sleep(Duration::from_millis(220));
    flush_desktop_compositor();
}

#[cfg(target_os = "windows")]
fn flush_desktop_compositor() {
    let _ = unsafe { windows::Win32::Graphics::Dwm::DwmFlush() };
}

#[cfg(not(target_os = "windows"))]
fn flush_desktop_compositor() {}

fn configure_capture_window(window: &WebviewWindow, session: &CaptureSession) -> AppResult<()> {
    window.set_fullscreen(false)?;
    window.set_decorations(false)?;
    window.set_resizable(false)?;
    window.set_shadow(false)?;
    window.set_always_on_top(true)?;
    window.set_position(PhysicalPosition::new(session.monitor_x, session.monitor_y))?;
    window.set_size(PhysicalSize::new(session.width, session.height))?;
    window.set_fullscreen(true)?;
    window.set_focus()?;

    Ok(())
}

fn logical_size<T>(value: T, scale_factor: f32) -> f64
where
    T: Into<f64>,
{
    value.into() / f64::from(scale_factor.max(1.0))
}

fn restore_main_window_after_capture(app_handle: &AppHandle, state: &AppState) -> AppResult<()> {
    let should_restore = {
        let mut restore_main = state.restore_main_after_capture.lock().map_err(|_| {
            AppError::new(
                "capture_error",
                "Falha ao acessar estado da janela principal.",
            )
        })?;
        let should_restore = *restore_main;
        *restore_main = false;
        should_restore
    };

    if should_restore {
        if let Some(main_window) = app_handle.get_webview_window("main") {
            main_window.show()?;
            main_window.set_focus()?;
        }
    }

    Ok(())
}

fn clear_capture_session(state: &AppState) -> AppResult<()> {
    let mut current_session = state.capture_session.lock().map_err(|_| {
        AppError::new(
            "capture_error",
            "Falha ao acessar estado da sessão de captura.",
        )
    })?;
    *current_session = None;

    Ok(())
}

fn normalize_shortcut(shortcut: &str) -> String {
    let shortcut = shortcut.trim();

    if shortcut.is_empty() {
        DEFAULT_CAPTURE_SHORTCUT.to_string()
    } else {
        shortcut.to_string()
    }
}
