use crate::entity::{invoice, invoice_line_item};
use crate::modules::auth::require_user;
use crate::modules::shared::AppState;
use axum::{extract::State, http::HeaderMap, http::StatusCode, Json};
use sea_orm::{ColumnTrait, EntityTrait, QueryFilter, QueryOrder};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Deserialize, ToSchema)]
pub struct ImproveLineItemRequest {
    pub description: String,
}

#[derive(Serialize, ToSchema)]
pub struct ImproveLineItemResponse {
    pub suggestion: String,
    pub based_on: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct LastLineItemResponse {
    pub description: Option<String>,
}

#[utoipa::path(
    post,
    path = "/ai/line-item-improve",
    request_body = ImproveLineItemRequest,
    responses(
        (status = 200, description = "Improved description", body = ImproveLineItemResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "ai"
)]
pub async fn improve_line_item(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ImproveLineItemRequest>,
) -> Result<Json<ImproveLineItemResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    if payload.description.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Description is required".to_string()));
    }

    let last_description = load_last_line_item_description(&state.db, current_user.id).await?;
    let suggestion = call_openai(&payload.description, last_description.as_deref()).await?;

    Ok(Json(ImproveLineItemResponse {
        suggestion,
        based_on: last_description,
    }))
}

#[utoipa::path(
    get,
    path = "/ai/line-item-last",
    responses(
        (status = 200, description = "Last line item description", body = LastLineItemResponse),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "ai"
)]
pub async fn last_line_item(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<LastLineItemResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let last_description = load_last_line_item_description(&state.db, current_user.id).await?;
    Ok(Json(LastLineItemResponse {
        description: last_description,
    }))
}

async fn load_last_line_item_description(
    db: &sea_orm::DatabaseConnection,
    user_id: Uuid,
) -> Result<Option<String>, (StatusCode, String)> {
    let latest_invoice = invoice::Entity::find()
        .filter(invoice::Column::UserId.eq(user_id))
        .order_by_desc(invoice::Column::Date)
        .order_by_desc(invoice::Column::Id)
        .one(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let Some(latest_invoice) = latest_invoice else {
        return Ok(None);
    };

    let latest_item = invoice_line_item::Entity::find()
        .filter(invoice_line_item::Column::InvoiceId.eq(latest_invoice.id))
        .order_by_desc(invoice_line_item::Column::Id)
        .one(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(latest_item.map(|item| item.description))
}

async fn call_openai(
    description: &str,
    last_description: Option<&str>,
) -> Result<String, (StatusCode, String)> {
    let api_key = std::env::var("OPENAI_API_KEY")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "OPENAI_API_KEY missing".to_string()))?;

    let system = "You improve a single invoice line-item description. Keep it concise, professional, and specific. Return only the improved description without quotes.";
    let context = last_description
        .map(|last| format!("Previous line-item description: {last}"))
        .unwrap_or_default();
    let user_prompt = format!(
        "Current line-item description: {description}\n{context}\nImprove the current description."
    );

    let body = serde_json::json!({
        "model": "gpt-4o-mini",
        "messages": [
            { "role": "system", "content": system },
            { "role": "user", "content": user_prompt }
        ],
        "temperature": 0.3
    });

    let client = reqwest::Client::new();
    let response = client
        .post("https://api.openai.com/v1/chat/completions")
        .bearer_auth(api_key)
        .json(&body)
        .send()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if !response.status().is_success() {
        let text = response.text().await.unwrap_or_default();
        return Err((StatusCode::INTERNAL_SERVER_ERROR, text));
    }

    let value: serde_json::Value = response
        .json()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    let suggestion = value["choices"][0]["message"]["content"]
        .as_str()
        .unwrap_or(description)
        .trim()
        .to_string();

    Ok(suggestion)
}
