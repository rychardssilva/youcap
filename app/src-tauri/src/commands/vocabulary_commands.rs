use tauri::State;

use crate::{
    dto::word_dto::{
        CreateWordRequest, EnsureLexicalRelationsRequest, ReferenceImagesRequest, RelatedWordDto,
        RelatedWordsRequest, SearchWordsRequest, SearchWordsResponse, UpdateWordDetailsRequest,
        WordDetailsDto, WordDetailsRequest,
    },
    errors::AppError,
    models::word::Word,
    services::{image_service, vocabulary_service},
    state::AppState,
};

#[tauri::command]
pub async fn create_word(
    state: State<'_, AppState>,
    request: CreateWordRequest,
) -> Result<Word, AppError> {
    vocabulary_service::create_word(&state.db, request).await
}

#[tauri::command]
pub async fn list_words(state: State<'_, AppState>) -> Result<Vec<Word>, AppError> {
    vocabulary_service::list_words(&state.db).await
}

#[tauri::command]
pub async fn search_words(
    state: State<'_, AppState>,
    request: SearchWordsRequest,
) -> Result<SearchWordsResponse, AppError> {
    vocabulary_service::search_words(&state.db, request).await
}

#[tauri::command]
pub async fn get_word_details(
    state: State<'_, AppState>,
    request: WordDetailsRequest,
) -> Result<WordDetailsDto, AppError> {
    vocabulary_service::get_word_details(&state.db, &request.id).await
}

#[tauri::command]
pub async fn update_word_details(
    state: State<'_, AppState>,
    request: UpdateWordDetailsRequest,
) -> Result<WordDetailsDto, AppError> {
    vocabulary_service::update_word_details(&state.db, request).await
}

#[tauri::command]
pub async fn ensure_lexical_relations(
    state: State<'_, AppState>,
    request: EnsureLexicalRelationsRequest,
) -> Result<WordDetailsDto, AppError> {
    vocabulary_service::ensure_lexical_relations(&state.db, &request.id).await
}

#[tauri::command]
pub async fn get_reference_images(
    state: State<'_, AppState>,
    request: ReferenceImagesRequest,
) -> Result<Vec<String>, AppError> {
    image_service::lookup_reference_images(&state.db, &request.term, request.limit.unwrap_or(4))
        .await
}

#[tauri::command]
pub async fn get_related_words(
    state: State<'_, AppState>,
    request: RelatedWordsRequest,
) -> Result<Vec<RelatedWordDto>, AppError> {
    vocabulary_service::get_related_words(
        &state.db,
        &request.word_id,
        &request.term,
        request.limit.unwrap_or(8),
    )
    .await
}
