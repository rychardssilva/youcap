use std::{
    collections::HashMap,
    time::{Duration, SystemTime, UNIX_EPOCH},
};

use reqwest::Client;
use serde::Deserialize;

use crate::{
    errors::{AppError, AppResult},
    services::lookup_service,
};

const MIN_COMMONS_SCORE: i32 = 7;

#[derive(Debug, Deserialize)]
struct WikipediaSummary {
    title: Option<String>,
    description: Option<String>,
    #[serde(rename = "type")]
    page_type: Option<String>,
    thumbnail: Option<WikipediaImage>,
    originalimage: Option<WikipediaImage>,
}

#[derive(Debug, Deserialize)]
struct WikipediaImage {
    source: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WikipediaMediaListResponse {
    items: Option<Vec<WikipediaMediaItem>>,
}

#[derive(Debug, Deserialize)]
struct WikipediaMediaItem {
    title: Option<String>,
    #[serde(rename = "type")]
    item_type: Option<String>,
    srcset: Option<Vec<WikipediaMediaSource>>,
}

#[derive(Debug, Deserialize)]
struct WikipediaMediaSource {
    src: Option<String>,
}

#[derive(Debug, Deserialize)]
struct WikipediaSearchResponse {
    pages: Option<Vec<WikipediaSearchPage>>,
}

#[derive(Debug, Deserialize)]
struct WikipediaSearchPage {
    title: Option<String>,
    description: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CommonsSearchResponse {
    query: Option<CommonsQuery>,
}

#[derive(Debug, Deserialize)]
struct CommonsQuery {
    pages: Option<HashMap<String, CommonsPage>>,
}

#[derive(Debug, Deserialize)]
struct CommonsPage {
    title: Option<String>,
    imageinfo: Option<Vec<CommonsImageInfo>>,
}

#[derive(Debug, Deserialize)]
struct CommonsImageInfo {
    thumburl: Option<String>,
    url: Option<String>,
    extmetadata: Option<HashMap<String, CommonsMetadataValue>>,
}

#[derive(Debug, Deserialize)]
struct CommonsMetadataValue {
    value: Option<String>,
}

#[derive(Debug)]
struct ScoredImage {
    url: String,
    score: i32,
}

pub async fn lookup_reference_images(term: &str, limit: usize) -> AppResult<Vec<String>> {
    let term = sanitize_visual_term(term);

    if !is_visual_lookup_candidate(&term) {
        return Ok(Vec::new());
    }

    let client = Client::builder()
        .timeout(Duration::from_secs(4))
        .build()
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    let mut images = Vec::new();

    for candidate in visual_lookup_terms(&term) {
        if let Some(summary_image) = lookup_summary_image(&client, &candidate, &term).await? {
            images.push(summary_image);
        }

        let remaining = limit.saturating_sub(images.len());
        if remaining > 0 {
            if let Ok(mut article_images) =
                lookup_article_media_images(&client, &candidate, &term, remaining).await
            {
                images.append(&mut article_images);
            }
        }

        let remaining = limit.saturating_sub(images.len());
        if remaining > 0 {
            if let Ok(mut commons_images) =
                lookup_commons_images(&client, &candidate, &term, remaining).await
            {
                images.append(&mut commons_images);
            }
        }

        dedupe_images(&mut images);
        if images.len() >= limit {
            break;
        }
    }

    if images.is_empty() {
        if let Ok(Some(search_image)) = lookup_search_result_image(&client, &term).await {
            images.push(search_image);
        }
    }

    dedupe_images(&mut images);
    shuffle_images(&mut images);
    images.truncate(limit);
    Ok(images)
}

async fn lookup_summary_image(
    client: &Client,
    query_term: &str,
    original_term: &str,
) -> AppResult<Option<String>> {
    let response = client
        .get(format!(
            "https://en.wikipedia.org/api/rest_v1/page/summary/{}",
            encode_path_segment(query_term),
        ))
        .header(
            "User-Agent",
            "ImmersionVocabulary/0.1.0 (local desktop vocabulary app)",
        )
        .send()
        .await
        .map_err(provider_error)?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let summary = response
        .json::<WikipediaSummary>()
        .await
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    if !summary_is_safe_reference(&summary, query_term, original_term) {
        return Ok(None);
    }

    Ok(summary
        .originalimage
        .or(summary.thumbnail)
        .and_then(|image| image.source)
        .and_then(|url| normalize_wikimedia_thumb_url(&url))
        .filter(|url| image_url_is_safe(url)))
}

async fn lookup_article_media_images(
    client: &Client,
    query_term: &str,
    original_term: &str,
    limit: usize,
) -> AppResult<Vec<String>> {
    let response = client
        .get(format!(
            "https://en.wikipedia.org/api/rest_v1/page/media-list/{}",
            encode_path_segment(query_term),
        ))
        .header(
            "User-Agent",
            "ImmersionVocabulary/0.1.0 (local desktop vocabulary app)",
        )
        .send()
        .await
        .map_err(provider_error)?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let payload = response
        .json::<WikipediaMediaListResponse>()
        .await
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    let mut images = Vec::new();
    for item in payload.items.unwrap_or_default() {
        if item
            .item_type
            .as_deref()
            .is_some_and(|item_type| item_type != "image")
        {
            continue;
        }

        let title = item.title.as_deref().unwrap_or_default();
        if !article_media_title_is_relevant(title, query_term, original_term) {
            continue;
        }

        let Some(raw_url) = item
            .srcset
            .as_ref()
            .and_then(|sources| sources.last().or_else(|| sources.first()))
            .and_then(|source| source.src.as_deref())
        else {
            continue;
        };

        let Some(url) = normalize_wikimedia_thumb_url(raw_url) else {
            continue;
        };

        if image_url_is_safe(&url) {
            images.push(url);
        }

        if images.len() >= limit {
            break;
        }
    }

    Ok(images)
}

async fn lookup_search_result_image(client: &Client, term: &str) -> AppResult<Option<String>> {
    let response = client
        .get(format!(
            "https://en.wikipedia.org/w/rest.php/v1/search/page?q={}&limit=4",
            encode_query_value(term),
        ))
        .header(
            "User-Agent",
            "ImmersionVocabulary/0.1.0 (local desktop vocabulary app)",
        )
        .send()
        .await
        .map_err(provider_error)?;

    if !response.status().is_success() {
        return Ok(None);
    }

    let payload = response
        .json::<WikipediaSearchResponse>()
        .await
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    for page in payload.pages.unwrap_or_default() {
        let Some(title) = page.title else {
            continue;
        };

        if text_has_blocked_topic(page.description.as_deref().unwrap_or_default()) {
            continue;
        }

        if summary_title_matches_term(Some(&title), term) || title_matches_alias(&title, term) {
            if let Some(image) = lookup_summary_image(client, &title, term).await? {
                return Ok(Some(image));
            }
        }
    }

    Ok(None)
}

async fn lookup_commons_images(
    client: &Client,
    query_term: &str,
    original_term: &str,
    limit: usize,
) -> AppResult<Vec<String>> {
    let search_limit = (limit * 8).clamp(12, 32);
    let response = client
        .get(format!(
            "https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrlimit={search_limit}&gsrsearch={}&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=900&format=json",
            encode_query_value(&commons_search_query(query_term)),
        ))
        .header(
            "User-Agent",
            "ImmersionVocabulary/0.1.0 (local desktop vocabulary app)",
        )
        .send()
        .await
        .map_err(provider_error)?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    let payload = response
        .json::<CommonsSearchResponse>()
        .await
        .map_err(|error| AppError::new("image_provider_error", error.to_string()))?;

    let Some(pages) = payload.query.and_then(|query| query.pages) else {
        return Ok(Vec::new());
    };

    let mut scored_images = Vec::new();

    for page in pages.values() {
        let Some(image_info) = page.imageinfo.as_ref().and_then(|items| items.first()) else {
            continue;
        };

        let Some(raw_url) = image_info.thumburl.as_deref().or(image_info.url.as_deref()) else {
            continue;
        };
        let Some(url) = normalize_wikimedia_thumb_url(raw_url) else {
            continue;
        };

        if !image_url_is_safe(&url) {
            continue;
        }

        let score = score_commons_image(
            query_term,
            original_term,
            page.title.as_deref(),
            image_info.extmetadata.as_ref(),
            &url,
        );

        if score >= MIN_COMMONS_SCORE {
            scored_images.push(ScoredImage { url, score });
        }
    }

    scored_images
        .sort_by(|left, right| right.score.cmp(&left.score).then(left.url.cmp(&right.url)));

    Ok(scored_images
        .into_iter()
        .map(|image| image.url)
        .take(limit)
        .collect())
}

fn summary_is_safe_reference(
    summary: &WikipediaSummary,
    query_term: &str,
    original_term: &str,
) -> bool {
    if summary
        .page_type
        .as_deref()
        .is_some_and(|page_type| page_type.eq_ignore_ascii_case("disambiguation"))
    {
        return false;
    }

    if !summary_title_matches_term(summary.title.as_deref(), query_term)
        && !title_matches_alias(summary.title.as_deref().unwrap_or_default(), original_term)
    {
        return false;
    }

    let description = summary.description.as_deref().unwrap_or_default();
    !text_has_blocked_topic(description)
}

fn score_commons_image(
    query_term: &str,
    original_term: &str,
    title: Option<&str>,
    metadata: Option<&HashMap<String, CommonsMetadataValue>>,
    url: &str,
) -> i32 {
    let normalized_term = normalize_match_text(query_term);
    let normalized_original_term = normalize_match_text(original_term);
    let normalized_title = title
        .map(strip_file_prefix)
        .map(normalize_match_text)
        .unwrap_or_default();
    let description = metadata_value(metadata, "ImageDescription");
    let object_name = metadata_value(metadata, "ObjectName");
    let categories = metadata_value(metadata, "Categories");
    let all_text = normalize_match_text(&format!(
        "{normalized_title} {description} {object_name} {categories} {url}"
    ));

    if normalized_title.is_empty()
        || text_has_blocked_topic(&all_text)
        || (!text_mentions_term(&all_text, &normalized_term)
            && !text_mentions_term(&all_text, &normalized_original_term))
    {
        return 0;
    }

    let mut score = 0;

    if normalized_title == normalized_term {
        score += 12;
    } else if normalized_title.starts_with(&format!("{normalized_term} ")) {
        score += 8;
    } else if normalized_title.contains(&format!(" {normalized_term} ")) {
        score += 5;
    }

    if normalize_match_text(&object_name) == normalized_term {
        score += 8;
    }

    if text_mentions_term(&normalize_match_text(&description), &normalized_term) {
        score += 4;
    }

    if text_mentions_term(&normalize_match_text(&categories), &normalized_term) {
        score += 3;
    }

    if title_looks_like_clean_subject(&normalized_title, &normalized_term) {
        score += 3;
    }

    if normalized_title.split_whitespace().count() > 8 {
        score -= 3;
    }

    if all_text.contains(" svg ") || all_text.contains(" diagram ") {
        score -= 3;
    }

    score
}

fn article_media_title_is_relevant(title: &str, query_term: &str, original_term: &str) -> bool {
    let normalized_title = normalize_match_text(strip_file_prefix(title));

    if normalized_title.is_empty() || text_has_blocked_topic(&normalized_title) {
        return false;
    }

    visual_match_terms(query_term, original_term)
        .iter()
        .any(|term| text_mentions_term(&normalized_title, term))
}

fn visual_match_terms(query_term: &str, original_term: &str) -> Vec<String> {
    let mut terms = Vec::new();
    push_unique_term(&mut terms, query_term);
    push_unique_term(&mut terms, original_term);

    for alias in visual_aliases(&normalize_match_text(query_term)) {
        push_unique_term(&mut terms, alias);
    }

    for alias in visual_aliases(&normalize_match_text(original_term)) {
        push_unique_term(&mut terms, alias);
    }

    for keyword in visual_topic_keywords(&normalize_match_text(query_term)) {
        push_unique_term(&mut terms, keyword);
    }

    for keyword in visual_topic_keywords(&normalize_match_text(original_term)) {
        push_unique_term(&mut terms, keyword);
    }

    terms
        .into_iter()
        .map(|term| normalize_match_text(&term))
        .collect()
}

fn visual_lookup_terms(term: &str) -> Vec<String> {
    let mut terms = Vec::new();

    let normalized = normalize_match_text(term);
    let aliases = visual_aliases(&normalized);
    for alias in aliases {
        push_unique_term(&mut terms, alias);
    }

    push_unique_term(&mut terms, term);

    if normalized.ends_with('s') && normalized.chars().count() > 4 {
        if let Some(singular) = normalized.strip_suffix('s') {
            push_unique_term(&mut terms, singular);
        }
    }

    terms
}

fn visual_aliases(term: &str) -> &'static [&'static str] {
    match term {
        "vila" => &["villa", "village"],
        "aldeia" => &["village"],
        "povoado" => &["village", "settlement"],
        "cidade" => &["city", "town"],
        "casa" => &["house"],
        "castelo" => &["castle"],
        "floresta" => &["forest"],
        "montanha" => &["mountain"],
        "rio" => &["river"],
        "carro" => &["car"],
        _ => &[],
    }
}

fn visual_topic_keywords(term: &str) -> &'static [&'static str] {
    match term {
        "car" | "automobile" | "vehicle" => &[
            "car",
            "automobile",
            "vehicle",
            "ford",
            "benz",
            "motorwagen",
            "sedan",
            "suv",
            "taxi",
            "truck",
            "model t",
        ],
        "village" => &["village", "settlement", "hamlet", "houses"],
        "villa" => &["villa", "house", "residence"],
        _ => &[],
    }
}

fn push_unique_term(terms: &mut Vec<String>, term: &str) {
    let term = sanitize_visual_term(term);
    if term.is_empty() {
        return;
    }

    let normalized = normalize_match_text(&term);
    if !terms
        .iter()
        .any(|existing| normalize_match_text(existing) == normalized)
    {
        terms.push(term);
    }
}

fn is_visual_lookup_candidate(term: &str) -> bool {
    !term.is_empty()
        && !lookup_service::is_phrase(term)
        && term.chars().count() >= 3
        && term.chars().any(char::is_alphabetic)
        && !is_abstract_or_function_word(term)
}

fn is_abstract_or_function_word(term: &str) -> bool {
    matches!(
        normalize_match_text(term).as_str(),
        "a" | "an"
            | "the"
            | "of"
            | "to"
            | "in"
            | "on"
            | "at"
            | "by"
            | "for"
            | "from"
            | "with"
            | "without"
            | "about"
            | "into"
            | "over"
            | "under"
            | "between"
            | "through"
            | "and"
            | "or"
            | "but"
            | "because"
            | "although"
            | "if"
            | "when"
            | "while"
            | "than"
            | "that"
            | "this"
            | "these"
            | "those"
            | "it"
            | "its"
            | "he"
            | "she"
            | "they"
            | "we"
            | "you"
            | "i"
            | "me"
            | "him"
            | "her"
            | "them"
            | "us"
            | "my"
            | "your"
            | "his"
            | "their"
            | "our"
            | "is"
            | "are"
            | "was"
            | "were"
            | "be"
            | "been"
            | "being"
            | "am"
            | "have"
            | "has"
            | "had"
            | "do"
            | "does"
            | "did"
            | "can"
            | "could"
            | "should"
            | "would"
            | "will"
            | "shall"
            | "may"
            | "might"
            | "must"
            | "not"
            | "no"
            | "yes"
            | "very"
            | "just"
            | "also"
            | "too"
            | "so"
            | "then"
            | "time"
            | "ago"
            | "run"
            | "ran"
            | "running"
            | "make"
            | "made"
            | "get"
            | "got"
            | "thing"
            | "way"
            | "idea"
            | "context"
            | "word"
            | "meaning"
    )
}

fn commons_search_query(term: &str) -> String {
    format!("\"{term}\" -logo -icon -map -flag -poster -album -film -diagram -symbol")
}

fn sanitize_visual_term(term: &str) -> String {
    term.trim_matches(|character: char| !character.is_alphanumeric() && character != ' ')
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn summary_title_matches_term(title: Option<&str>, term: &str) -> bool {
    let Some(title) = title else {
        return false;
    };

    normalize_match_text(title) == normalize_match_text(term)
}

fn title_matches_alias(title: &str, term: &str) -> bool {
    let normalized_title = normalize_match_text(title);
    visual_aliases(&normalize_match_text(term))
        .iter()
        .any(|alias| normalized_title == normalize_match_text(alias))
}

fn text_mentions_term(text: &str, normalized_term: &str) -> bool {
    text == normalized_term
        || text.starts_with(&format!("{normalized_term} "))
        || text.ends_with(&format!(" {normalized_term}"))
        || text.contains(&format!(" {normalized_term} "))
}

fn title_looks_like_clean_subject(title: &str, normalized_term: &str) -> bool {
    title == normalized_term
        || (title.starts_with(&format!("{normalized_term} "))
            && !title.contains(" in ")
            && !title.contains(" at ")
            && !title.contains(" near "))
}

fn text_has_blocked_topic(text: &str) -> bool {
    let normalized = normalize_match_text(text);

    [
        "album",
        "book",
        "coat of arms",
        "company",
        "diagram",
        "disambiguation",
        "emblem",
        "episode",
        "fictional",
        "film",
        "flag",
        "given name",
        "icon",
        "logo",
        "map",
        "novel",
        "painting",
        "poster",
        "seal",
        "single cover",
        "song",
        "surname",
        "symbol",
        "television",
        "video game",
    ]
    .iter()
    .any(|blocked| text_mentions_term(&normalized, blocked))
}

fn image_url_is_safe(url: &str) -> bool {
    looks_like_display_image(url) && !url_has_blocked_topic(url)
}

fn looks_like_display_image(url: &str) -> bool {
    let lower_url = url.to_lowercase();

    [".jpg", ".jpeg", ".png", ".webp"]
        .iter()
        .any(|extension| lower_url.contains(extension))
}

fn url_has_blocked_topic(url: &str) -> bool {
    text_has_blocked_topic(&url.replace(['_', '-', '/', '.'], " "))
}

fn normalize_wikimedia_thumb_url(url: &str) -> Option<String> {
    if !looks_like_display_image(url) {
        return None;
    }

    let url = if url.starts_with("//") {
        format!("https:{url}")
    } else {
        url.to_string()
    };

    Some(
        url.replace("/320px-", "/900px-")
            .replace("/500px-", "/900px-")
            .replace("/640px-", "/900px-")
            .replace("/800px-", "/900px-"),
    )
}

fn strip_file_prefix(value: &str) -> &str {
    value
        .trim_start_matches("File:")
        .trim_start_matches("Image:")
        .trim()
}

fn metadata_value(metadata: Option<&HashMap<String, CommonsMetadataValue>>, key: &str) -> String {
    metadata
        .and_then(|metadata| metadata.get(key))
        .and_then(|value| value.value.as_deref())
        .map(strip_html)
        .unwrap_or_default()
}

fn strip_html(value: &str) -> String {
    let mut result = String::new();
    let mut inside_tag = false;

    for character in value.chars() {
        match character {
            '<' => inside_tag = true,
            '>' => inside_tag = false,
            _ if !inside_tag => result.push(character),
            _ => {}
        }
    }

    result
}

fn normalize_match_text(value: &str) -> String {
    value
        .trim()
        .to_lowercase()
        .replace(['_', '-', '/', '.', ',', ':', ';', '(', ')', '"'], " ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ")
}

fn dedupe_images(images: &mut Vec<String>) {
    let mut seen = std::collections::HashSet::new();
    images.retain(|image| seen.insert(normalize_image_identity(image)));
}

fn shuffle_images(images: &mut [String]) {
    if images.len() < 2 {
        return;
    }

    let mut seed = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_nanos() as usize)
        .unwrap_or(0);

    for index in (1..images.len()).rev() {
        seed = seed.wrapping_mul(1_664_525).wrapping_add(1_013_904_223);
        images.swap(index, seed % (index + 1));
    }
}

fn normalize_image_identity(image: &str) -> String {
    let without_query = image.split('?').next().unwrap_or(image);
    let filename = without_query
        .rsplit('/')
        .find(|segment| {
            let lower = segment.to_lowercase();
            lower.ends_with(".jpg")
                || lower.ends_with(".jpeg")
                || lower.ends_with(".png")
                || lower.ends_with(".webp")
        })
        .unwrap_or(without_query);

    filename
        .trim_start_matches(|character: char| character.is_ascii_digit())
        .trim_start_matches("px-")
        .to_lowercase()
}

fn encode_path_segment(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            b' ' => vec!['_'],
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

fn encode_query_value(value: &str) -> String {
    value
        .bytes()
        .flat_map(|byte| match byte {
            b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' => {
                vec![byte as char]
            }
            b' ' => vec!['+'],
            _ => format!("%{byte:02X}").chars().collect(),
        })
        .collect()
}

fn provider_error(error: reqwest::Error) -> AppError {
    if error.is_timeout() {
        AppError::new("image_timeout", "A busca de imagem demorou demais.")
    } else {
        AppError::new("image_provider_error", error.to_string())
    }
}

#[cfg(test)]
mod tests {
    use super::{
        article_media_title_is_relevant, dedupe_images, is_visual_lookup_candidate,
        score_commons_image, visual_lookup_terms,
    };

    #[test]
    fn abstract_words_are_not_visual_candidates() {
        assert!(!is_visual_lookup_candidate("time"));
        assert!(!is_visual_lookup_candidate("ago"));
    }

    #[test]
    fn concrete_words_are_visual_candidates() {
        assert!(is_visual_lookup_candidate("village"));
        assert!(is_visual_lookup_candidate("villa"));
        assert!(is_visual_lookup_candidate("vila"));
        assert!(is_visual_lookup_candidate("castle"));
        assert!(is_visual_lookup_candidate("hidden"));
    }

    #[test]
    fn portuguese_visual_terms_can_fallback_to_english_aliases() {
        let terms = visual_lookup_terms("vila");

        assert_eq!(terms[0], "villa");
        assert_eq!(terms[1], "village");
        assert!(terms.contains(&"vila".to_string()));
    }

    #[test]
    fn commons_score_rejects_unrelated_or_blocked_titles() {
        assert_eq!(
            score_commons_image(
                "village",
                "village",
                Some("File:Village logo.png"),
                None,
                "https://example.test/village_logo.png"
            ),
            0
        );
        assert!(
            score_commons_image(
                "village",
                "village",
                Some("File:Village street.jpg"),
                None,
                "https://example.test/village_street.jpg"
            ) >= 7
        );
    }

    #[test]
    fn car_images_reject_unrelated_places_and_accept_vehicle_titles() {
        assert!(article_media_title_is_relevant(
            "File:1925_Ford_Model_T_touring.jpg",
            "car",
            "car"
        ));
        assert!(article_media_title_is_relevant(
            "File:Benz_Patent-Motorwagen_Nr_2.jpg",
            "car",
            "car"
        ));
        assert!(!article_media_title_is_relevant(
            "File:Carro-panorama.jpg",
            "car",
            "car"
        ));
        assert_eq!(
            score_commons_image(
                "car",
                "car",
                Some("File:Carro-panorama.jpg"),
                None,
                "https://example.test/Carro-panorama.jpg"
            ),
            0
        );
    }

    #[test]
    fn image_dedupe_ignores_thumbnail_size_and_query_params() {
        let mut images = vec![
            "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/1925_Ford_Model_T_touring.jpg/500px-1925_Ford_Model_T_touring.jpg?x=1".to_string(),
            "https://upload.wikimedia.org/wikipedia/commons/thumb/1/12/1925_Ford_Model_T_touring.jpg/900px-1925_Ford_Model_T_touring.jpg?x=2".to_string(),
            "https://upload.wikimedia.org/wikipedia/commons/thumb/d/d0/Benz_Patent-Motorwagen_Nr_2.jpg/900px-Benz_Patent-Motorwagen_Nr_2.jpg".to_string(),
        ];

        dedupe_images(&mut images);

        assert_eq!(images.len(), 2);
    }
}
