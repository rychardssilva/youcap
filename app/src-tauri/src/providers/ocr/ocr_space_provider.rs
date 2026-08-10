use std::{fs, io::Cursor, time::Duration};

use image::{codecs::jpeg::JpegEncoder, GenericImageView};
use reqwest::{
    multipart::{Form, Part},
    Client,
};
use serde::Deserialize;

use crate::{
    dto::ocr_dto::OcrResultDto,
    errors::{AppError, AppResult},
};

const OCR_SPACE_ENDPOINT: &str = "https://api.ocr.space/parse/image";
const OCR_PROVIDER_NAME: &str = "ocr-space";
const OCR_SPACE_PUBLIC_TEST_KEY: &str = "helloworld";
const OCR_TIMEOUT_SECONDS: u64 = 8;
const OCR_MAX_IMAGE_SIDE: u32 = 1400;
const OCR_JPEG_QUALITY: u8 = 80;
const OCR_ORIGINAL_IMAGE_MAX_BYTES: usize = 700_000;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct OcrSpaceResponse {
    parsed_results: Option<Vec<OcrSpaceParsedResult>>,
    is_errored_on_processing: Option<bool>,
    error_message: Option<serde_json::Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "PascalCase")]
struct OcrSpaceParsedResult {
    parsed_text: Option<String>,
}

pub async fn recognize_text(image_path: &str, api_key: Option<String>) -> AppResult<OcrResultDto> {
    let mut warnings = Vec::new();
    let configured_api_key = api_key
        .map(|key| key.trim().to_string())
        .filter(|key| !key.is_empty());

    if configured_api_key.is_none() {
        warnings.push(
            "Usando chave publica de teste do OCR.space. Configure uma chave gratuita para uso real."
                .to_string(),
        );
    }

    let payload = prepare_image_payload(image_path)?;

    let client = Client::builder()
        .timeout(Duration::from_secs(OCR_TIMEOUT_SECONDS))
        .build()
        .map_err(|error| AppError::new("ocr_provider_error", error.to_string()))?;

    let mut response = match send_ocr_with_fallback(
        &client,
        configured_api_key.as_deref(),
        &payload,
    )
    .await
    {
        Ok(response) => response,
        Err(error) if configured_api_key.is_some() => {
            warnings.push(
                "A chave configurada do OCR.space demorou para responder. Tentando chave publica de teste."
                    .to_string(),
            );

            send_ocr_request(&client, OCR_SPACE_PUBLIC_TEST_KEY, &payload)
                .await
                .or(Err(error))?
        }
        Err(error) => return Err(error),
    };

    if !response.status().is_success() && configured_api_key.is_some() {
        warnings.push(
            "A chave configurada do OCR.space foi recusada. Tentando chave publica de teste."
                .to_string(),
        );
        response = send_ocr_request(&client, OCR_SPACE_PUBLIC_TEST_KEY, &payload).await?;
    }

    if !response.status().is_success() {
        return Err(AppError::new(
            "ocr_provider_error",
            "OCR.space recusou a imagem ou a credencial.",
        ));
    }

    let payload = response
        .json::<OcrSpaceResponse>()
        .await
        .map_err(|error| AppError::new("ocr_provider_error", error.to_string()))?;

    if payload.is_errored_on_processing.unwrap_or(false) {
        return Err(AppError::new(
            "ocr_provider_error",
            ocr_error_message(payload.error_message),
        ));
    }

    let text = payload
        .parsed_results
        .unwrap_or_default()
        .into_iter()
        .filter_map(|result| result.parsed_text)
        .collect::<Vec<_>>()
        .join("\n");

    Ok(OcrResultDto {
        image_path: image_path.to_string(),
        text: normalize_ocr_text(&text)?,
        provider: OCR_PROVIDER_NAME.to_string(),
        warnings,
    })
}

async fn send_ocr_request(
    client: &Client,
    api_key: &str,
    payload: &OcrImagePayload,
) -> AppResult<reqwest::Response> {
    let file = Part::bytes(payload.bytes.clone())
        .file_name(payload.file_name.clone())
        .mime_str(payload.mime_type)
        .map_err(|error| AppError::new("ocr_provider_error", error.to_string()))?;

    let form = Form::new()
        .part("file", file)
        .text("language", "eng")
        .text("isOverlayRequired", "false")
        .text("detectOrientation", "false")
        .text("scale", "true")
        .text("isTable", "false")
        .text("OCREngine", "1");

    client
        .post(OCR_SPACE_ENDPOINT)
        .header("apikey", api_key)
        .multipart(form)
        .send()
        .await
        .map_err(|error| {
            if error.is_timeout() {
                AppError::new(
                    "ocr_timeout",
                    "O OCR.space demorou demais para responder. Tente uma area menor ou tente novamente.",
                )
            } else {
                AppError::new("ocr_provider_error", error.to_string())
            }
        })
}

async fn send_ocr_with_fallback(
    client: &Client,
    configured_api_key: Option<&str>,
    payload: &OcrImagePayload,
) -> AppResult<reqwest::Response> {
    let api_key = configured_api_key.unwrap_or(OCR_SPACE_PUBLIC_TEST_KEY);

    send_ocr_request(client, api_key, payload).await
}

#[derive(Debug, Clone)]
struct OcrImagePayload {
    bytes: Vec<u8>,
    file_name: String,
    mime_type: &'static str,
}

fn prepare_image_payload(image_path: &str) -> AppResult<OcrImagePayload> {
    let original_bytes = fs::read(image_path)?;
    let image = image::open(image_path)
        .map_err(|error| AppError::new("ocr_image_error", error.to_string()))?;
    let (width, height) = image.dimensions();
    let extension = std::path::Path::new(image_path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_lowercase();

    if original_bytes.len() <= OCR_ORIGINAL_IMAGE_MAX_BYTES
        && width.max(height) <= OCR_MAX_IMAGE_SIDE
        && extension == "png"
    {
        return Ok(OcrImagePayload {
            bytes: original_bytes,
            file_name: "capture-ocr.png".to_string(),
            mime_type: "image/png",
        });
    }

    Ok(OcrImagePayload {
        bytes: prepare_jpeg_image_bytes(image)?,
        file_name: "capture-ocr.jpg".to_string(),
        mime_type: "image/jpeg",
    })
}

fn prepare_jpeg_image_bytes(image: image::DynamicImage) -> AppResult<Vec<u8>> {
    let (width, height) = image.dimensions();
    let max_side = width.max(height);
    let prepared_image = if max_side > OCR_MAX_IMAGE_SIDE {
        image.resize(
            scaled_dimension(width, max_side),
            scaled_dimension(height, max_side),
            image::imageops::FilterType::Triangle,
        )
    } else {
        image
    };
    let rgb = prepared_image.to_rgb8();
    let mut buffer = Vec::new();
    let mut encoder = JpegEncoder::new_with_quality(Cursor::new(&mut buffer), OCR_JPEG_QUALITY);

    encoder
        .encode_image(&rgb)
        .map_err(|error| AppError::new("ocr_image_error", error.to_string()))?;

    Ok(buffer)
}

fn scaled_dimension(value: u32, max_side: u32) -> u32 {
    ((value as f32 / max_side as f32) * OCR_MAX_IMAGE_SIDE as f32)
        .round()
        .max(1.0) as u32
}

fn normalize_ocr_text(text: &str) -> AppResult<String> {
    let normalized = text
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect::<Vec<_>>()
        .join(" ")
        .split_whitespace()
        .collect::<Vec<_>>()
        .join(" ");

    if normalized.is_empty() {
        return Err(AppError::new(
            "ocr_empty_text",
            "Nenhum texto foi reconhecido nessa area.",
        ));
    }

    Ok(normalized)
}

fn ocr_error_message(value: Option<serde_json::Value>) -> String {
    let message = match value {
        Some(serde_json::Value::String(message)) => message,
        Some(serde_json::Value::Array(messages)) => messages
            .into_iter()
            .filter_map(|message| message.as_str().map(str::to_string))
            .collect::<Vec<_>>()
            .join(" "),
        Some(other) => other.to_string(),
        None => "Falha ao processar OCR.".to_string(),
    };

    translate_ocr_provider_message(&message)
}

fn translate_ocr_provider_message(message: &str) -> String {
    let lower_message = message.to_lowercase();

    if lower_message.contains("api key")
        || lower_message.contains("apikey")
        || lower_message.contains("credential")
    {
        return "A chave do OCR.space parece invalida. Confira a chave nas configuracoes."
            .to_string();
    }

    if lower_message.contains("file") && lower_message.contains("size") {
        return "A imagem enviada ao OCR ficou grande demais. Tente selecionar uma area menor."
            .to_string();
    }

    if lower_message.contains("no text") || lower_message.contains("unable to recognize") {
        return "Nenhum texto foi reconhecido nessa area. Tente selecionar uma area mais nitida."
            .to_string();
    }

    if lower_message.contains("quota")
        || lower_message.contains("limit")
        || lower_message.contains("maximum")
    {
        return "O limite gratuito do OCR.space foi atingido. Tente novamente mais tarde."
            .to_string();
    }

    message.to_string()
}

#[cfg(test)]
mod tests {
    use image::{ImageBuffer, Rgba};
    use uuid::Uuid;

    use super::{normalize_ocr_text, prepare_image_payload};

    #[test]
    fn normalize_ocr_text_collapses_lines_and_spaces() {
        let normalized = normalize_ocr_text(" Twelve \r\n\r\n years   ago ").unwrap();

        assert_eq!(normalized, "Twelve years ago");
    }

    #[test]
    fn small_png_is_sent_without_jpeg_conversion() {
        let image_path = std::env::temp_dir().join(format!("ocr-test-{}.png", Uuid::new_v4()));
        let image = ImageBuffer::from_pixel(20, 20, Rgba([255u8, 255u8, 255u8, 255u8]));

        image.save(&image_path).unwrap();

        let payload = prepare_image_payload(image_path.to_str().unwrap()).unwrap();

        assert_eq!(payload.file_name, "capture-ocr.png");
        assert_eq!(payload.mime_type, "image/png");

        let _ = std::fs::remove_file(image_path);
    }
}
