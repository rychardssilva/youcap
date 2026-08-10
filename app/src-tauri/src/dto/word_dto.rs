use serde::{Deserialize, Serialize};
use sqlx::FromRow;

use crate::models::word::Word;

#[derive(Debug, Deserialize)]
pub struct CreateWordRequest {
    pub term: String,
    pub language: Option<String>,
    pub translation: Option<String>,
    pub context: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct WordDetailsRequest {
    pub id: String,
}

#[derive(Debug, Deserialize)]
pub struct ReferenceImagesRequest {
    pub term: String,
    pub limit: Option<usize>,
}

#[derive(Debug, Deserialize)]
pub struct RelatedWordsRequest {
    pub word_id: String,
    pub term: String,
    pub limit: Option<i64>,
}

#[derive(Debug, Serialize, FromRow, Clone)]
pub struct RelatedWordDto {
    pub term: String,
    pub translation: Option<String>,
    pub source: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum WordSort {
    Alphabetical,
    CreatedAt,
    LastLookup,
}

#[derive(Debug, Deserialize)]
pub struct SearchWordsRequest {
    pub query: Option<String>,
    pub sort: Option<WordSort>,
    pub limit: Option<i64>,
    pub offset: Option<i64>,
}

#[derive(Debug, Serialize)]
pub struct SearchWordsResponse {
    pub items: Vec<WordListItemDto>,
    pub total: i64,
    pub limit: i64,
    pub offset: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordListItemDto {
    pub id: String,
    pub term: String,
    pub normalized_term: String,
    pub language: String,
    pub pronunciation: Option<String>,
    pub ipa: Option<String>,
    pub part_of_speech: Option<String>,
    pub difficulty: i64,
    pub status: String,
    pub frequency_rank: Option<i64>,
    pub frequency_band: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub main_translation: Option<String>,
    pub latest_context: Option<String>,
    pub first_lookup_at: Option<String>,
    pub last_lookup_at: Option<String>,
    pub lookups_count: i64,
}

#[derive(Debug, Deserialize)]
pub struct UpdateWordDetailsRequest {
    pub id: String,
    pub term: Option<String>,
    pub translation: Option<String>,
    pub meaning: Option<String>,
    pub status: Option<String>,
    pub pronunciation: Option<String>,
    pub ipa: Option<String>,
    pub part_of_speech: Option<String>,
    pub difficulty: Option<i64>,
    pub frequency_rank: Option<i64>,
    pub frequency_band: Option<String>,
    pub example_original: Option<String>,
    pub example_translation: Option<String>,
    pub synonyms: Option<String>,
    pub antonyms: Option<String>,
    pub personal_note: Option<String>,
    pub personal_sentence: Option<String>,
    pub personal_sentence_translation: Option<String>,
    pub tags: Option<String>,
    pub review_rating: Option<String>,
    pub review_scheduled_for: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct WordDetailsDto {
    pub word: Word,
    pub translations: Vec<WordTranslationDto>,
    pub contexts: Vec<WordContextDto>,
    pub examples: Vec<WordExampleDto>,
    pub lookups: Vec<WordLookupDto>,
    pub history_summary: WordHistorySummaryDto,
    pub lexical_relations: Vec<WordLexicalRelationDto>,
    pub personal_notes: Vec<WordPersonalNoteDto>,
    pub personal_sentences: Vec<WordPersonalSentenceDto>,
    pub tags: Vec<WordTagDto>,
    pub reviews: Vec<WordReviewDto>,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordHistorySummaryDto {
    pub first_lookup_at: Option<String>,
    pub last_lookup_at: Option<String>,
    pub lookups_count: i64,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordTranslationDto {
    pub id: String,
    pub language: String,
    pub translation: String,
    pub kind: String,
    pub source: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordContextDto {
    pub id: String,
    pub original_text: String,
    pub highlighted_text: Option<String>,
    pub source: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordExampleDto {
    pub id: String,
    pub original_text: String,
    pub translated_text: Option<String>,
    pub source: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordLookupDto {
    pub id: String,
    pub query: String,
    pub source: Option<String>,
    pub duration_ms: Option<i64>,
    pub created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordLexicalRelationDto {
    pub id: String,
    pub term: String,
    pub relation_type: String,
    pub translation: Option<String>,
    pub source: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordPersonalNoteDto {
    pub id: String,
    pub note: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordPersonalSentenceDto {
    pub id: String,
    pub original_text: String,
    pub translated_text: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordTagDto {
    pub id: String,
    pub name: String,
    pub normalized_name: String,
    pub created_at: String,
}

#[derive(Debug, Serialize, FromRow)]
pub struct WordReviewDto {
    pub id: String,
    pub rating: String,
    pub scheduled_for: Option<String>,
    pub reviewed_at: String,
    pub created_at: String,
}
