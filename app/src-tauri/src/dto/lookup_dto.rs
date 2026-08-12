use serde::{Deserialize, Serialize};

#[derive(Debug, Deserialize)]
pub struct LookupRequest {
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookupExampleDto {
    pub original_text: String,
    pub translated_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookupResultDto {
    pub query: String,
    pub word: String,
    pub translation: String,
    pub meaning: String,
    pub meaning_translation: Option<String>,
    pub contextual_explanation: String,
    pub contextual_explanation_translation: Option<String>,
    pub part_of_speech: Option<String>,
    #[serde(default)]
    pub synonyms: Vec<LookupLexicalRelationDto>,
    #[serde(default)]
    pub antonyms: Vec<LookupLexicalRelationDto>,
    pub reference_image_url: Option<String>,
    pub examples: Vec<LookupExampleDto>,
    pub source: String,
    pub warnings: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LookupLexicalRelationDto {
    pub term: String,
    pub translation: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct SaveLookupRequest {
    pub result: LookupResultDto,
}

#[derive(Debug, Clone, Serialize)]
pub struct LookupStatusDto {
    pub query: Option<String>,
    pub result: Option<LookupResultDto>,
    pub error: Option<String>,
    pub is_loading: bool,
}
