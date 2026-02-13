use crate::entity::expense;
use crate::modules::auth::require_user;
use crate::modules::shared::AppState;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::NaiveDate;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use utoipa::ToSchema;
use uuid::Uuid;

use aws_sdk_s3::config::{Credentials, Region};
use aws_sdk_s3::presigning::PresigningConfig;
use aws_sdk_s3::Client;

#[derive(Deserialize, ToSchema)]
pub struct ExpenseCreateRequest {
    pub vendor: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub date: NaiveDate,
    pub category: Option<String>,
    pub receipt_url: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct ExpenseUpdateRequest {
    pub vendor: Option<String>,
    pub description: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub date: Option<NaiveDate>,
    pub category: Option<String>,
    pub receipt_url: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct ExpenseResponse {
    pub id: Uuid,
    pub vendor: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub date: NaiveDate,
    pub category: Option<String>,
    pub receipt_url: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct ReceiptUploadRequest {
    pub filename: String,
    pub content_type: String,
}

#[derive(Serialize, ToSchema)]
pub struct ReceiptUploadResponse {
    pub upload_url: String,
    pub receipt_url: String,
}

#[utoipa::path(
    get,
    path = "/expenses",
    responses(
        (status = 200, description = "Expense list", body = [ExpenseResponse]),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "expenses"
)]
pub async fn list_expenses(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<ExpenseResponse>>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let expenses = expense::Entity::find()
        .filter(expense::Column::UserId.eq(current_user.id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        expenses
            .into_iter()
            .map(|item| ExpenseResponse {
                id: item.id,
                vendor: item.vendor,
                description: item.description,
                amount: item.amount,
                currency: item.currency,
                date: item.date,
                category: item.category,
                receipt_url: item.receipt_url,
            })
            .collect(),
    ))
}

#[utoipa::path(
    post,
    path = "/expenses",
    request_body = ExpenseCreateRequest,
    responses(
        (status = 200, description = "Expense created", body = ExpenseResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "expenses"
)]
pub async fn create_expense(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ExpenseCreateRequest>,
) -> Result<Json<ExpenseResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    if payload.vendor.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Vendor is required".to_string()));
    }
    if payload.amount <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Amount must be positive".to_string()));
    }

    let active = expense::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(current_user.id),
        vendor: Set(payload.vendor),
        description: Set(payload.description),
        amount: Set(payload.amount),
        currency: Set(payload.currency),
        date: Set(payload.date),
        category: Set(payload.category),
        receipt_url: Set(payload.receipt_url),
        created_at: Set(chrono::Utc::now()),
    };

    let saved = active
        .insert(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ExpenseResponse {
        id: saved.id,
        vendor: saved.vendor,
        description: saved.description,
        amount: saved.amount,
        currency: saved.currency,
        date: saved.date,
        category: saved.category,
        receipt_url: saved.receipt_url,
    }))
}

#[utoipa::path(
    patch,
    path = "/expenses/{id}",
    request_body = ExpenseUpdateRequest,
    responses(
        (status = 200, description = "Expense updated", body = ExpenseResponse),
        (status = 400, description = "Invalid id"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Expense not found"),
        (status = 500, description = "Server error")
    ),
    tag = "expenses"
)]
pub async fn update_expense(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ExpenseUpdateRequest>,
) -> Result<Json<ExpenseResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = expense::Entity::find_by_id(id)
        .filter(expense::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Expense not found".to_string()))?;

    let mut active: expense::ActiveModel = existing.into();
    if let Some(vendor) = payload.vendor {
        active.vendor = Set(vendor);
    }
    if let Some(description) = payload.description {
        active.description = Set(description);
    }
    if let Some(amount) = payload.amount {
        active.amount = Set(amount);
    }
    if let Some(currency) = payload.currency {
        active.currency = Set(currency);
    }
    if let Some(date) = payload.date {
        active.date = Set(date);
    }
    if let Some(category) = payload.category {
        active.category = Set(Some(category));
    }
    if let Some(receipt_url) = payload.receipt_url {
        active.receipt_url = Set(Some(receipt_url));
    }

    let updated = active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ExpenseResponse {
        id: updated.id,
        vendor: updated.vendor,
        description: updated.description,
        amount: updated.amount,
        currency: updated.currency,
        date: updated.date,
        category: updated.category,
        receipt_url: updated.receipt_url,
    }))
}

#[utoipa::path(
    delete,
    path = "/expenses/{id}",
    responses(
        (status = 204, description = "Expense deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Expense not found"),
        (status = 500, description = "Server error")
    ),
    tag = "expenses"
)]
pub async fn delete_expense(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = expense::Entity::find_by_id(id)
        .filter(expense::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Expense not found".to_string()))?;

    expense::Entity::delete_by_id(existing.id)
        .exec(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

#[utoipa::path(
    post,
    path = "/expenses/receipt-url",
    request_body = ReceiptUploadRequest,
    responses(
        (status = 200, description = "Presigned upload URL", body = ReceiptUploadResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "expenses"
)]
pub async fn create_receipt_upload_url(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<ReceiptUploadRequest>,
) -> Result<Json<ReceiptUploadResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    if payload.filename.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Filename is required".to_string()));
    }
    if payload.content_type.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Content type is required".to_string()));
    }

    let bucket = std::env::var("R2_BUCKET")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "R2_BUCKET missing".to_string()))?;
    let public_base = std::env::var("R2_PUBLIC_BASE_URL")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "R2_PUBLIC_BASE_URL missing".to_string()))?;

    let extension = payload
        .filename
        .rsplit('.')
        .next()
        .unwrap_or("bin")
        .to_lowercase();
    let key = format!(
        "receipts/{}/{}.{}",
        current_user.id,
        Uuid::new_v4(),
        extension
    );

    let client = build_s3_client().await?;
    let presigned = client
        .put_object()
        .bucket(&bucket)
        .key(&key)
        .content_type(payload.content_type)
        .presigned(PresigningConfig::expires_in(Duration::from_secs(600)).map_err(|e| {
            (StatusCode::INTERNAL_SERVER_ERROR, format!("Invalid expiry: {}", e))
        })?)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(ReceiptUploadResponse {
        upload_url: presigned.uri().to_string(),
        receipt_url: format!("{}/{}", public_base.trim_end_matches('/'), key),
    }))
}

async fn build_s3_client() -> Result<Client, (StatusCode, String)> {
    let endpoint = std::env::var("R2_ENDPOINT")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "R2_ENDPOINT missing".to_string()))?;
    let access_key = std::env::var("R2_ACCESS_KEY_ID")
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "R2_ACCESS_KEY_ID missing".to_string()))?;
    let secret_key = std::env::var("R2_SECRET_ACCESS_KEY").map_err(|_| {
        (StatusCode::INTERNAL_SERVER_ERROR, "R2_SECRET_ACCESS_KEY missing".to_string())
    })?;
    let region = std::env::var("R2_REGION").unwrap_or_else(|_| "auto".to_string());

    let config = aws_sdk_s3::config::Builder::new()
        .credentials_provider(Credentials::new(
            access_key,
            secret_key,
            None,
            None,
            "r2",
        ))
        .region(Region::new(region))
        .endpoint_url(endpoint)
        .build();

    Ok(Client::from_conf(config))
}
