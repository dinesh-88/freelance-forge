use crate::entity::income;
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
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Deserialize, ToSchema)]
pub struct IncomeCreateRequest {
    pub source: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub date: NaiveDate,
    pub category: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct IncomeUpdateRequest {
    pub source: Option<String>,
    pub description: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub date: Option<NaiveDate>,
    pub category: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct IncomeResponse {
    pub id: Uuid,
    pub source: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub date: NaiveDate,
    pub category: Option<String>,
}

#[utoipa::path(
    get,
    path = "/income",
    responses(
        (status = 200, description = "Income list", body = [IncomeResponse]),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "income"
)]
pub async fn list_income(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<IncomeResponse>>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let entries = income::Entity::find()
        .filter(income::Column::UserId.eq(current_user.id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        entries
            .into_iter()
            .map(|item| IncomeResponse {
                id: item.id,
                source: item.source,
                description: item.description,
                amount: item.amount,
                currency: item.currency,
                date: item.date,
                category: item.category,
            })
            .collect(),
    ))
}

#[utoipa::path(
    post,
    path = "/income",
    request_body = IncomeCreateRequest,
    responses(
        (status = 200, description = "Income created", body = IncomeResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "income"
)]
pub async fn create_income(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<IncomeCreateRequest>,
) -> Result<Json<IncomeResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    if payload.source.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Source is required".to_string()));
    }
    if payload.amount <= 0.0 {
        return Err((StatusCode::BAD_REQUEST, "Amount must be positive".to_string()));
    }

    let active = income::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(current_user.id),
        source: Set(payload.source),
        description: Set(payload.description),
        amount: Set(payload.amount),
        currency: Set(payload.currency),
        date: Set(payload.date),
        category: Set(payload.category),
        created_at: Set(chrono::Utc::now()),
    };

    let saved = active
        .insert(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(IncomeResponse {
        id: saved.id,
        source: saved.source,
        description: saved.description,
        amount: saved.amount,
        currency: saved.currency,
        date: saved.date,
        category: saved.category,
    }))
}

#[utoipa::path(
    patch,
    path = "/income/{id}",
    request_body = IncomeUpdateRequest,
    responses(
        (status = 200, description = "Income updated", body = IncomeResponse),
        (status = 400, description = "Invalid id"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Income not found"),
        (status = 500, description = "Server error")
    ),
    tag = "income"
)]
pub async fn update_income(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<IncomeUpdateRequest>,
) -> Result<Json<IncomeResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = income::Entity::find_by_id(id)
        .filter(income::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Income not found".to_string()))?;

    let mut active: income::ActiveModel = existing.into();
    if let Some(source) = payload.source {
        active.source = Set(source);
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

    let updated = active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(IncomeResponse {
        id: updated.id,
        source: updated.source,
        description: updated.description,
        amount: updated.amount,
        currency: updated.currency,
        date: updated.date,
        category: updated.category,
    }))
}

#[utoipa::path(
    delete,
    path = "/income/{id}",
    responses(
        (status = 204, description = "Income deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Income not found"),
        (status = 500, description = "Server error")
    ),
    tag = "income"
)]
pub async fn delete_income(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = income::Entity::find_by_id(id)
        .filter(income::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Income not found".to_string()))?;

    income::Entity::delete_by_id(existing.id)
        .exec(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
