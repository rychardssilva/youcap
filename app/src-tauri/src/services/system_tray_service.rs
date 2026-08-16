use tauri::{
    menu::{Menu, MenuItem, PredefinedMenuItem},
    tray::{MouseButton, TrayIconBuilder, TrayIconEvent},
    App, AppHandle, Manager, WindowEvent,
};

use crate::{errors::AppResult, repositories::settings_repository, state::AppState};

const TRAY_OPEN_ID: &str = "tray_open_yocab";
const TRAY_QUIT_ID: &str = "tray_quit_yocab";
const TRAY_ID: &str = "main";
const RUN_IN_BACKGROUND_SETTING: &str = "run_in_background";

pub fn setup_tray(app: &mut App) -> AppResult<()> {
    let open = MenuItem::with_id(app, TRAY_OPEN_ID, "Abrir Yocab", true, None::<&str>)?;
    let separator = PredefinedMenuItem::separator(app)?;
    let quit = MenuItem::with_id(app, TRAY_QUIT_ID, "Sair", true, None::<&str>)?;
    let menu = Menu::with_items(app, &[&open, &separator, &quit])?;

    let mut tray = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("Yocab")
        .menu(&menu)
        .show_menu_on_left_click(false)
        .on_menu_event(|app, event| match event.id().as_ref() {
            TRAY_OPEN_ID => {
                let _ = show_main_window(app);
            }
            TRAY_QUIT_ID => app.exit(0),
            _ => {}
        })
        .on_tray_icon_event(|tray, event| {
            if let TrayIconEvent::DoubleClick {
                button: MouseButton::Left,
                ..
            } = event
            {
                let _ = show_main_window(tray.app_handle());
            }
        });

    if let Some(icon) = app.default_window_icon().cloned() {
        tray = tray.icon(icon);
    }

    tray.build(app)?;
    sync_tray_visibility(app.handle())?;
    Ok(())
}

pub fn update_tray_visibility(app_handle: &AppHandle, run_in_background: bool) -> AppResult<()> {
    if let Some(tray) = app_handle.tray_by_id(TRAY_ID) {
        tray.set_visible(run_in_background)?;
    }

    Ok(())
}

pub fn handle_main_window_event(window: &tauri::Window, event: &WindowEvent) {
    let WindowEvent::CloseRequested { api, .. } = event else {
        return;
    };

    if window.label() != "main" {
        return;
    }

    let app_handle = window.app_handle().clone();
    let should_hide =
        tauri::async_runtime::block_on(should_run_in_background(&app_handle)).unwrap_or(false);

    if should_hide {
        // Em segundo plano o X esconde a janela, sem segundo plano o X encerra o processo
        api.prevent_close();
        let _ = window.hide();
    } else {
        app_handle.exit(0);
    }
}

async fn should_run_in_background(app_handle: &AppHandle) -> AppResult<bool> {
    let state = app_handle.state::<AppState>();
    let setting = settings_repository::get_setting(&state.db, RUN_IN_BACKGROUND_SETTING).await?;
    Ok(setting.is_some_and(|setting| setting.value == "true"))
}

fn sync_tray_visibility(app_handle: &AppHandle) -> AppResult<()> {
    let should_show =
        tauri::async_runtime::block_on(should_run_in_background(app_handle)).unwrap_or(false);
    update_tray_visibility(app_handle, should_show)
}

fn show_main_window(app_handle: &AppHandle) -> tauri::Result<()> {
    if let Some(window) = app_handle.get_webview_window("main") {
        window.show()?;
        window.unminimize()?;
        window.set_focus()?;
    }

    Ok(())
}
