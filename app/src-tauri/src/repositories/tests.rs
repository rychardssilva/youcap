use sqlx::{sqlite::SqlitePoolOptions, SqlitePool};
use uuid::Uuid;

use crate::{
    dto::{
        lookup_dto::{LookupExampleDto, LookupResultDto},
        settings_dto::UpsertSettingRequest,
        word_dto::{CreateWordRequest, UpdateWordDetailsRequest, WordSort},
    },
    repositories::{
        history_repository, lookup_cache_repository, settings_repository, word_repository,
    },
    services::{settings_service, vocabulary_service},
};

async fn test_pool() -> SqlitePool {
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect("sqlite::memory:")
        .await
        .expect("test database should connect");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations should run");

    pool
}

async fn file_pool(path: &std::path::Path) -> SqlitePool {
    let database_url = format!("sqlite://{}?mode=rwc", path.display());
    let pool = SqlitePoolOptions::new()
        .max_connections(1)
        .connect(&database_url)
        .await
        .expect("file database should connect");

    sqlx::migrate!("./migrations")
        .run(&pool)
        .await
        .expect("migrations should run");

    pool
}

#[tokio::test]
async fn migrations_create_empty_database() {
    let pool = test_pool().await;

    let words_count = word_repository::count_words(&pool).await.unwrap();
    let lookups_count = history_repository::count_lookups(&pool).await.unwrap();
    let settings_count = settings_repository::count_settings(&pool).await.unwrap();

    assert_eq!(words_count, 0);
    assert_eq!(lookups_count, 0);
    assert_eq!(settings_count, 0);
}

#[tokio::test]
async fn create_word_persists_related_context_and_lookup() {
    let pool = test_pool().await;

    let word = vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Context".to_string(),
            language: Some("en".to_string()),
            translation: Some("contexto".to_string()),
            context: Some("The word context helps explain meaning.".to_string()),
        },
    )
    .await
    .unwrap();

    let words = word_repository::list_words(&pool).await.unwrap();
    let lookups_count = history_repository::count_lookups(&pool).await.unwrap();
    let translations_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM translations")
        .fetch_one(&pool)
        .await
        .unwrap();
    let contexts_count = sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM contexts")
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(word.normalized_term, "context");
    assert_eq!(words.len(), 1);
    assert_eq!(lookups_count, 1);
    assert_eq!(translations_count, 1);
    assert_eq!(contexts_count, 1);
}

#[tokio::test]
async fn word_details_load_saved_related_data() {
    let pool = test_pool().await;

    let word = vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Details".to_string(),
            language: Some("en".to_string()),
            translation: Some("detalhes".to_string()),
            context: Some("Details make a word easier to remember.".to_string()),
        },
    )
    .await
    .unwrap();

    let details = word_repository::get_word_details(&pool, &word.id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(details.word.id, word.id);
    assert_eq!(details.translations.len(), 1);
    assert_eq!(details.contexts.len(), 1);
    assert_eq!(details.lookups.len(), 1);
}

#[tokio::test]
async fn saved_translation_can_be_loaded_by_term() {
    let pool = test_pool().await;

    vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Village".to_string(),
            language: Some("en".to_string()),
            translation: Some("vila".to_string()),
            context: Some("The Village Hidden in the Leaves.".to_string()),
        },
    )
    .await
    .unwrap();

    let translation = word_repository::find_saved_translation_by_term(&pool, "village", "en")
        .await
        .unwrap();

    assert_eq!(translation.as_deref(), Some("vila"));

    let missing = word_repository::find_saved_translation_by_term(&pool, "town", "en")
        .await
        .unwrap();

    assert!(missing.is_none());
}

#[tokio::test]
async fn duplicate_word_updates_existing_record() {
    let pool = test_pool().await;

    let first = vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Context".to_string(),
            language: Some("en".to_string()),
            translation: None,
            context: None,
        },
    )
    .await
    .unwrap();

    let second = vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "context".to_string(),
            language: Some("en".to_string()),
            translation: None,
            context: None,
        },
    )
    .await
    .unwrap();

    let words_count = word_repository::count_words(&pool).await.unwrap();
    let lookups_count = history_repository::count_lookups(&pool).await.unwrap();

    assert_eq!(first.id, second.id);
    assert_eq!(words_count, 1);
    assert_eq!(lookups_count, 2);
}

#[tokio::test]
async fn search_words_finds_terms_and_translations() {
    let pool = test_pool().await;

    vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Village".to_string(),
            language: Some("en".to_string()),
            translation: Some("aldeia".to_string()),
            context: Some("The Village Hidden in the Leaves.".to_string()),
        },
    )
    .await
    .unwrap();

    vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Time".to_string(),
            language: Some("en".to_string()),
            translation: Some("tempo".to_string()),
            context: None,
        },
    )
    .await
    .unwrap();

    let by_term =
        word_repository::search_words(&pool, Some("village"), WordSort::Alphabetical, 20, 0)
            .await
            .unwrap();
    let by_translation =
        word_repository::search_words(&pool, Some("TEMPO"), WordSort::Alphabetical, 20, 0)
            .await
            .unwrap();

    assert_eq!(by_term.total, 1);
    assert_eq!(by_term.items[0].main_translation.as_deref(), Some("aldeia"));
    assert_eq!(by_translation.total, 1);
    assert_eq!(by_translation.items[0].term, "Time");
}

#[tokio::test]
async fn search_words_does_not_multiply_lookup_count_by_translations() {
    let pool = test_pool().await;

    let word = vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Twelve".to_string(),
            language: Some("en".to_string()),
            translation: Some("doze".to_string()),
            context: Some("Twelve years ago.".to_string()),
        },
    )
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO translations (id, word_id, language, translation, kind, source)
        VALUES (?1, ?2, 'pt-BR', 'numero doze', 'variant', 'manual')
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&word.id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO lookups (id, word_id, query, source, created_at)
        VALUES (?1, ?2, 'Twelve years ago.', 'gemini', '2026-07-28 10:00:00')
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&word.id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO lookups (id, word_id, query, source, created_at)
        VALUES (?1, ?2, 'Twelve years ago.', 'gemini', '2026-07-28 10:00:00')
        "#,
    )
    .bind(Uuid::new_v4().to_string())
    .bind(&word.id)
    .execute(&pool)
    .await
    .unwrap();

    let result =
        word_repository::search_words(&pool, Some("twelve"), WordSort::Alphabetical, 20, 0)
            .await
            .unwrap();
    let details = word_repository::get_word_details(&pool, &word.id)
        .await
        .unwrap()
        .unwrap();

    assert_eq!(result.items[0].lookups_count, 2);
    assert_eq!(details.history_summary.lookups_count, 2);
    assert_eq!(details.lookups.len(), 2);
}

#[tokio::test]
async fn search_words_applies_pagination_and_alphabetical_sort() {
    let pool = test_pool().await;

    for term in ["Zebra", "Apple", "Moon"] {
        vocabulary_service::create_word(
            &pool,
            CreateWordRequest {
                term: term.to_string(),
                language: Some("en".to_string()),
                translation: None,
                context: None,
            },
        )
        .await
        .unwrap();
    }

    let first_page = word_repository::search_words(&pool, None, WordSort::Alphabetical, 2, 0)
        .await
        .unwrap();
    let second_page = word_repository::search_words(&pool, None, WordSort::Alphabetical, 2, 2)
        .await
        .unwrap();

    assert_eq!(first_page.total, 3);
    assert_eq!(
        first_page
            .items
            .iter()
            .map(|word| word.term.as_str())
            .collect::<Vec<_>>(),
        vec!["Apple", "Moon"]
    );
    assert_eq!(second_page.items[0].term, "Zebra");
}

#[tokio::test]
async fn update_word_details_adds_manual_translation_context_and_status() {
    let pool = test_pool().await;

    let word = vocabulary_service::create_word(
        &pool,
        CreateWordRequest {
            term: "Run".to_string(),
            language: Some("en".to_string()),
            translation: Some("correr".to_string()),
            context: None,
        },
    )
    .await
    .unwrap();

    let details = vocabulary_service::update_word_details(
        &pool,
        UpdateWordDetailsRequest {
            id: word.id.clone(),
            term: Some("Run".to_string()),
            translation: Some("ficar sem".to_string()),
            meaning: Some("Usada em expressoes como run out of time.".to_string()),
            status: Some("learning".to_string()),
            part_of_speech: Some("verb".to_string()),
            difficulty: Some(3),
            frequency_rank: Some(120),
            frequency_band: Some("muito comum".to_string()),
            example_original: Some("I ran out of time.".to_string()),
            example_translation: Some("Fiquei sem tempo.".to_string()),
            synonyms: Some("sprint, operate".to_string()),
            antonyms: Some("walk, stop".to_string()),
            personal_note: Some("Cuidado com phrasal verbs.".to_string()),
            personal_sentence: Some("I run before work.".to_string()),
            personal_sentence_translation: Some("Eu corro antes do trabalho.".to_string()),
            tags: Some("phrasal verbs, rotina".to_string()),
            review_rating: Some("good".to_string()),
            review_scheduled_for: Some("2026-08-11".to_string()),
        },
    )
    .await
    .unwrap();

    assert_eq!(details.word.status, "learning");
    assert_eq!(details.word.part_of_speech.as_deref(), Some("verb"));
    assert_eq!(details.word.difficulty, 3);
    assert_eq!(details.word.frequency_rank, Some(120));
    assert_eq!(details.word.frequency_band.as_deref(), Some("muito comum"));
    assert_eq!(details.translations[0].translation, "ficar sem");
    assert_eq!(
        details.contexts[0].original_text,
        "Usada em expressoes como run out of time."
    );
    assert_eq!(details.examples[0].original_text, "I ran out of time.");
    assert_eq!(details.lexical_relations.len(), 4);
    assert_eq!(details.personal_notes[0].note, "Cuidado com phrasal verbs.");
    assert_eq!(
        details.personal_sentences[0].original_text,
        "I run before work."
    );
    assert_eq!(details.tags.len(), 2);
    assert_eq!(details.tags[0].name, "phrasal verbs");
    assert_eq!(details.reviews[0].rating, "good");

    let updated_again = vocabulary_service::update_word_details(
        &pool,
        UpdateWordDetailsRequest {
            id: word.id.clone(),
            term: Some("Run".to_string()),
            translation: Some("esgotar".to_string()),
            meaning: Some("Novo contexto manual.".to_string()),
            status: Some("known".to_string()),
            part_of_speech: Some("verb".to_string()),
            difficulty: Some(2),
            frequency_rank: None,
            frequency_band: None,
            example_original: Some("They run every morning.".to_string()),
            example_translation: Some("Eles correm toda manha.".to_string()),
            synonyms: None,
            antonyms: None,
            personal_note: None,
            personal_sentence: None,
            personal_sentence_translation: None,
            tags: Some("corrida".to_string()),
            review_rating: None,
            review_scheduled_for: None,
        },
    )
    .await
    .unwrap();

    let manual_translations = updated_again
        .translations
        .iter()
        .filter(|translation| translation.source.as_deref() == Some("manual"))
        .count();
    let manual_contexts = updated_again
        .contexts
        .iter()
        .filter(|context| context.source.as_deref() == Some("manual"))
        .count();
    let manual_examples = updated_again
        .examples
        .iter()
        .filter(|example| example.source.as_deref() == Some("manual"))
        .count();

    assert_eq!(updated_again.word.status, "known");
    assert_eq!(updated_again.translations[0].translation, "esgotar");
    assert_eq!(
        updated_again.contexts[0].original_text,
        "Novo contexto manual."
    );
    assert_eq!(
        updated_again.examples[0].original_text,
        "They run every morning."
    );
    assert_eq!(manual_translations, 1);
    assert_eq!(manual_contexts, 1);
    assert_eq!(manual_examples, 1);
    assert_eq!(updated_again.tags.len(), 1);
    assert_eq!(updated_again.tags[0].name, "corrida");
}

#[tokio::test]
async fn settings_can_be_created_updated_and_validated() {
    let pool = test_pool().await;

    let created = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "theme".to_string(),
            value: "dark".to_string(),
        },
    )
    .await
    .unwrap();

    let updated = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "theme".to_string(),
            value: "light".to_string(),
        },
    )
    .await
    .unwrap();

    let invalid = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "theme".to_string(),
            value: "".to_string(),
        },
    )
    .await;

    assert_eq!(created.key, "theme");
    assert_eq!(updated.value, "light");
    assert!(invalid.is_err());
}

#[tokio::test]
async fn settings_validate_theme_language_providers_and_shortcut() {
    let pool = test_pool().await;

    settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "target_language".to_string(),
            value: "pt-BR".to_string(),
        },
    )
    .await
    .unwrap();
    settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "ocr_provider".to_string(),
            value: "ocr_space".to_string(),
        },
    )
    .await
    .unwrap();
    settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "ai_provider".to_string(),
            value: "gemini".to_string(),
        },
    )
    .await
    .unwrap();
    settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "global_shortcut".to_string(),
            value: "CommandOrControl+Shift+E".to_string(),
        },
    )
    .await
    .unwrap();
    settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "pexels_api_key".to_string(),
            value: "".to_string(),
        },
    )
    .await
    .unwrap();
    settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "onboarding_completed".to_string(),
            value: "true".to_string(),
        },
    )
    .await
    .unwrap();

    let invalid_theme = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "theme".to_string(),
            value: "system".to_string(),
        },
    )
    .await;
    let invalid_language = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "target_language".to_string(),
            value: "es".to_string(),
        },
    )
    .await;
    let invalid_provider = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "ai_provider".to_string(),
            value: "unknown".to_string(),
        },
    )
    .await;
    let invalid_shortcut = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "global_shortcut".to_string(),
            value: "E".to_string(),
        },
    )
    .await;
    let invalid_onboarding = settings_service::upsert_setting(
        &pool,
        UpsertSettingRequest {
            key: "onboarding_completed".to_string(),
            value: "yes".to_string(),
        },
    )
    .await;

    assert!(invalid_theme.is_err());
    assert!(invalid_language.is_err());
    assert!(invalid_provider.is_err());
    assert!(invalid_shortcut.is_err());
    assert!(invalid_onboarding.is_err());
}

#[tokio::test]
async fn lookup_cache_persists_complete_result() {
    let pool = test_pool().await;
    let result = LookupResultDto {
        query: "I ran out of time".to_string(),
        word: "I ran out of time".to_string(),
        translation: "Fiquei sem tempo".to_string(),
        meaning: "A phrase about not having time left.".to_string(),
        meaning_translation: Some("Uma frase sobre nao ter mais tempo.".to_string()),
        contextual_explanation: "The speaker could not finish something before a limit."
            .to_string(),
        contextual_explanation_translation: Some(
            "A pessoa nao conseguiu terminar algo antes de um limite.".to_string(),
        ),
        part_of_speech: None,
        synonyms: Vec::new(),
        antonyms: Vec::new(),
        reference_image_url: None,
        examples: vec![LookupExampleDto {
            original_text: "I ran out of time".to_string(),
            translated_text: Some("Fiquei sem tempo".to_string()),
        }],
        source: "test".to_string(),
        warnings: Vec::new(),
    };

    lookup_cache_repository::upsert_lookup_result(&pool, "i ran out of time", &result)
        .await
        .unwrap();

    let cached = lookup_cache_repository::find_by_normalized_query(&pool, "i ran out of time")
        .await
        .unwrap()
        .unwrap();

    assert_eq!(cached.query, result.query);
    assert_eq!(cached.translation, result.translation);
    assert_eq!(cached.examples.len(), 1);
}

#[tokio::test]
async fn data_persists_after_reopening_database_file() {
    let database_path = std::env::temp_dir().join(format!("yocab-{}.sqlite", Uuid::new_v4()));

    {
        let pool = file_pool(&database_path).await;
        vocabulary_service::create_word(
            &pool,
            CreateWordRequest {
                term: "Persistent".to_string(),
                language: Some("en".to_string()),
                translation: None,
                context: None,
            },
        )
        .await
        .unwrap();
        pool.close().await;
    }

    {
        let pool = file_pool(&database_path).await;
        let words = word_repository::list_words(&pool).await.unwrap();
        assert_eq!(words.len(), 1);
        assert_eq!(words[0].normalized_term, "persistent");
        pool.close().await;
    }

    let _ = std::fs::remove_file(database_path);
}
