mod commands;
mod database;
mod dto;
mod errors;
mod models;
mod providers;
mod repositories;
mod services;
mod state;

use commands::app_commands::app_health;
use commands::capture_commands::{
    cancel_capture, capture_shortcut_status, complete_capture_selection, current_capture_session,
    open_capture_overlay, register_capture_shortcut, unregister_capture_shortcut,
};
use commands::database_commands::database_health;
use commands::lookup_commands::{
    close_lookup_popup, current_lookup_result, current_lookup_status, lookup_text,
    open_lookup_details, save_lookup_result,
};
use commands::ocr_commands::{
    close_ocr_review, current_ocr_result, current_ocr_status, recognize_image_text,
};
use commands::settings_commands::{list_settings, upsert_setting};
use commands::vocabulary_commands::{
    create_word, ensure_lexical_relations, get_reference_images, get_related_words,
    get_word_details, list_words, search_words, update_word_details,
};
use services::{capture_service::DEFAULT_CAPTURE_SHORTCUT, technical_log_service};
use state::AppState;
use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .setup(|app| {
            let db = tauri::async_runtime::block_on(database::initialize_database(app.handle()))?;
            let initial_shortcut = tauri::async_runtime::block_on(
                repositories::settings_repository::get_setting(&db, "global_shortcut"),
            )?
            .map(|setting| setting.value)
            .unwrap_or_else(|| DEFAULT_CAPTURE_SHORTCUT.to_string());
            let state = AppState {
                db,
                capture_shortcut: Default::default(),
                capture_session: Default::default(),
                capture_in_progress: Default::default(),
                restore_main_after_capture: Default::default(),
                lookup_query: Default::default(),
                lookup_result: Default::default(),
                lookup_error: Default::default(),
                lookup_in_progress: Default::default(),
                ocr_image_path: Default::default(),
                ocr_result: Default::default(),
                ocr_error: Default::default(),
                ocr_in_progress: Default::default(),
            };
            app.manage(state);
            services::system_tray_service::setup_tray(app)?;
            // Capturas sao arquivos temporarios usados pelo OCR; dados de estudo ficam no SQLite.
            if let Err(error) =
                providers::capture::xcap_capture_provider::cleanup_old_captures(app.handle())
            {
                technical_log_service::log_error(app.handle(), "startup.capture_cleanup", &error);
            }
            let state = app.state::<AppState>();
            // O atalho precisa ser registrado ja na inicializacao para funcionar em segundo plano
            if let Err(error) = services::capture_service::register_capture_shortcut(
                app.handle(),
                &state,
                &initial_shortcut,
            ) {
                technical_log_service::log_error(app.handle(), "startup.shortcut", &error);
                eprintln!("failed to register initial capture shortcut: {error}");
            } else {
                technical_log_service::log_info(app.handle(), "startup", "Aplicacao iniciada.");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            app_health,
            open_capture_overlay,
            current_capture_session,
            register_capture_shortcut,
            unregister_capture_shortcut,
            capture_shortcut_status,
            complete_capture_selection,
            cancel_capture,
            database_health,
            lookup_text,
            current_lookup_status,
            current_lookup_result,
            save_lookup_result,
            open_lookup_details,
            close_lookup_popup,
            recognize_image_text,
            current_ocr_status,
            current_ocr_result,
            close_ocr_review,
            create_word,
            list_words,
            search_words,
            get_word_details,
            ensure_lexical_relations,
            get_reference_images,
            get_related_words,
            update_word_details,
            upsert_setting,
            list_settings
        ])
        .on_window_event(services::system_tray_service::handle_main_window_event)
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
