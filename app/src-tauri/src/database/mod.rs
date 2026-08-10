use std::{env, fs, path::PathBuf};

use sqlx::{
    sqlite::{SqliteConnectOptions, SqliteJournalMode, SqlitePoolOptions, SqliteSynchronous},
    SqlitePool,
};
use tauri::{AppHandle, Manager};

use crate::errors::AppResult;

pub async fn initialize_database(app_handle: &AppHandle) -> AppResult<SqlitePool> {
    let data_dir = database_dir(app_handle)?;
    fs::create_dir_all(&data_dir)?;

    let database_path = data_dir.join(database_file_name());
    let options = SqliteConnectOptions::new()
        .filename(&database_path)
        .create_if_missing(true)
        .foreign_keys(true)
        .journal_mode(SqliteJournalMode::Wal)
        .synchronous(SqliteSynchronous::Normal);

    let pool = SqlitePoolOptions::new()
        .max_connections(5)
        .connect_with(options)
        .await?;

    sqlx::migrate!("./migrations").run(&pool).await?;

    Ok(pool)
}

fn database_dir(app_handle: &AppHandle) -> AppResult<PathBuf> {
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

        Ok(project_dir.join("data"))
    } else {
        Ok(app_handle.path().app_data_dir()?)
    }
}

fn database_file_name() -> &'static str {
    if cfg!(debug_assertions) {
        "banco_de_dados.sqlite"
    } else {
        "immersion-vocabulary.sqlite"
    }
}
