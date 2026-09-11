use crate::entity::budget;
use crate::modules::auth::require_user;
use crate::modules::shared::AppState;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, StatusCode},
    Json,
};
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Deserialize, ToSchema)]
pub struct BudgetCreateRequest {
    pub category: String,
    pub monthly_limit: f64,
    pub currency: String,
}

#[derive(Deserialize, ToSchema)]
pub struct BudgetUpdateRequest {
    pub monthly_limit: Option<f64>,
    pub currency: Option<String>,
}

#[derive(Serialize, ToSchema)]
pub struct BudgetResponse {
    pub id: Uuid,
    pub category: String,
    pub monthly_limit: f64,
    pub currency: String,
}

#[utoipa::path(
    get,
    path = "/budgets",
    responses(
        (status = 200, description = "Budget list", body = [BudgetResponse]),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "budgets"
)]
pub async fn list_budgets(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<BudgetResponse>>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let entries = budget::Entity::find()
        .filter(budget::Column::UserId.eq(current_user.id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        entries
            .into_iter()
            .map(|item| BudgetResponse {
                id: item.id,
                category: item.category,
                monthly_limit: item.monthly_limit,
                currency: item.currency,
            })
            .collect(),
    ))
}

#[utoipa::path(
    post,
    path = "/budgets",
    request_body = BudgetCreateRequest,
    responses(
        (status = 200, description = "Budget created or updated", body = BudgetResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "budgets"
)]
pub async fn create_budget(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<BudgetCreateRequest>,
) -> Result<Json<BudgetResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    if payload.category.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Category is required".to_string()));
    }
    if payload.monthly_limit <= 0.0 {
        return Err((
            StatusCode::BAD_REQUEST,
            "Monthly limit must be positive".to_string(),
        ));
    }

    let existing = budget::Entity::find()
        .filter(budget::Column::UserId.eq(current_user.id))
        .filter(budget::Column::Category.eq(payload.category.clone()))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let saved = if let Some(existing) = existing {
        let mut active: budget::ActiveModel = existing.into();
        active.monthly_limit = Set(payload.monthly_limit);
        active.currency = Set(payload.currency);
        active
            .update(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    } else {
        let active = budget::ActiveModel {
            id: Set(Uuid::new_v4()),
            user_id: Set(current_user.id),
            category: Set(payload.category),
            monthly_limit: Set(payload.monthly_limit),
            currency: Set(payload.currency),
            created_at: Set(chrono::Utc::now()),
        };
        active
            .insert(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
    };

    Ok(Json(BudgetResponse {
        id: saved.id,
        category: saved.category,
        monthly_limit: saved.monthly_limit,
        currency: saved.currency,
    }))
}

#[utoipa::path(
    patch,
    path = "/budgets/{id}",
    request_body = BudgetUpdateRequest,
    responses(
        (status = 200, description = "Budget updated", body = BudgetResponse),
        (status = 400, description = "Invalid id"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Budget not found"),
        (status = 500, description = "Server error")
    ),
    tag = "budgets"
)]
pub async fn update_budget(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<BudgetUpdateRequest>,
) -> Result<Json<BudgetResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = budget::Entity::find_by_id(id)
        .filter(budget::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Budget not found".to_string()))?;

    let mut active: budget::ActiveModel = existing.into();
    if let Some(monthly_limit) = payload.monthly_limit {
        active.monthly_limit = Set(monthly_limit);
    }
    if let Some(currency) = payload.currency {
        active.currency = Set(currency);
    }

    let updated = active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(BudgetResponse {
        id: updated.id,
        category: updated.category,
        monthly_limit: updated.monthly_limit,
        currency: updated.currency,
    }))
}

#[utoipa::path(
    delete,
    path = "/budgets/{id}",
    responses(
        (status = 204, description = "Budget deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Budget not found"),
        (status = 500, description = "Server error")
    ),
    tag = "budgets"
)]
pub async fn delete_budget(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = budget::Entity::find_by_id(id)
        .filter(budget::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Budget not found".to_string()))?;

    budget::Entity::delete_by_id(existing.id)
        .exec(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}
