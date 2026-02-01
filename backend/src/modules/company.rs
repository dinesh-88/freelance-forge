use crate::entity::{company, user};
use crate::modules::auth::require_user;
use crate::modules::shared::AppState;
use axum::{
    extract::State,
    http::HeaderMap,
    Json,
};
use chrono::{DateTime, Utc};
use sea_orm::{ActiveModelTrait, EntityTrait, Set};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

#[derive(Deserialize, ToSchema)]
pub struct CompanyCreateRequest {
    pub name: String,
    pub address: String,
}

#[derive(Serialize, ToSchema)]
pub struct CompanyResponse {
    pub id: Uuid,
    pub name: String,
    pub address: String,
    pub created_at: DateTime<Utc>,
}

#[utoipa::path(
    post,
    path = "/company",
    request_body = CompanyCreateRequest,
    responses(
        (status = 200, description = "Company created", body = CompanyResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "company"
)]
pub async fn create_company(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<CompanyCreateRequest>,
) -> Result<Json<CompanyResponse>, (axum::http::StatusCode, String)> {
    if payload.name.trim().is_empty() || payload.address.trim().is_empty() {
        return Err((axum::http::StatusCode::BAD_REQUEST, "Name and address are required".to_string()));
    }

    let current_user = require_user(&state, &headers).await?;

    let active = company::ActiveModel {
        id: Set(Uuid::new_v4()),
        name: Set(payload.name),
        address: Set(payload.address),
        created_at: Set(Utc::now()),
    };

    let created = active
        .insert(&state.db)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut user_active: user::ActiveModel = current_user.into();
    user_active.company_id = Set(Some(created.id));
    user_active
        .update(&state.db)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(CompanyResponse {
        id: created.id,
        name: created.name,
        address: created.address,
        created_at: created.created_at,
    }))
}

#[utoipa::path(
    get,
    path = "/company/me",
    responses(
        (status = 200, description = "Company", body = CompanyResponse),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Company not found"),
        (status = 500, description = "Server error")
    ),
    tag = "company"
)]
pub async fn get_my_company(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<CompanyResponse>, (axum::http::StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let company_id = current_user
        .company_id
        .ok_or_else(|| (axum::http::StatusCode::NOT_FOUND, "Company not found".to_string()))?;

    let company = company::Entity::find_by_id(company_id)
        .one(&state.db)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (axum::http::StatusCode::NOT_FOUND, "Company not found".to_string()))?;

    Ok(Json(CompanyResponse {
        id: company.id,
        name: company.name,
        address: company.address,
        created_at: company.created_at,
    }))
}
