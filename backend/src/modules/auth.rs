use crate::entity::{session, user};
use crate::modules::shared::AppState;
use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    extract::State,
    http::{HeaderMap, StatusCode},
    Json,
};
use chrono::{DateTime, Utc};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;

const SESSION_DURATION_DAYS: i64 = 7;

#[derive(Deserialize, ToSchema)]
pub struct RegisterRequest {
    pub email: String,
    pub password: String,
    pub address: Option<String>,
}

#[derive(Deserialize, ToSchema)]
pub struct LoginRequest {
    pub email: String,
    pub password: String,
}

#[derive(Serialize, ToSchema)]
pub struct UserResponse {
    pub id: Uuid,
    pub email: String,
    pub address: Option<String>,
    pub company_id: Option<Uuid>,
    pub created_at: DateTime<Utc>,
}

#[derive(Serialize, ToSchema)]
pub struct SessionResponse {
    pub user: UserResponse,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateProfileRequest {
    pub address: Option<String>,
}

#[utoipa::path(
    post,
    path = "/auth/register",
    request_body = RegisterRequest,
    responses(
        (status = 200, description = "Registered and logged in", body = SessionResponse),
        (status = 400, description = "Invalid input"),
        (status = 409, description = "Email already exists"),
        (status = 500, description = "Server error")
    ),
    tag = "auth"
)]
pub async fn register(
    State(state): State<AppState>,
    Json(payload): Json<RegisterRequest>,
) -> Result<(HeaderMap, Json<SessionResponse>), (StatusCode, String)> {
    if payload.email.trim().is_empty() || payload.password.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Email and password are required".to_string()));
    }

    let existing = user::Entity::find()
        .filter(user::Column::Email.eq(payload.email.clone()))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if existing.is_some() {
        return Err((StatusCode::CONFLICT, "Email already exists".to_string()));
    }

    let password_hash = hash_password(&payload.password)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let user_active = user::ActiveModel {
        id: Set(Uuid::new_v4()),
        email: Set(payload.email),
        password_hash: Set(password_hash),
        address: Set(payload.address),
        company_id: Set(None),
        created_at: Set(Utc::now()),
    };

    let user = user_active
        .insert(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let (_session, cookie) = create_session(&state.db, user.id).await?;
    let mut headers = HeaderMap::new();
    headers.insert(axum::http::header::SET_COOKIE, cookie);

    Ok((
        headers,
        Json(SessionResponse {
            user: UserResponse {
                id: user.id,
                email: user.email,
                address: user.address,
                company_id: user.company_id,
                created_at: user.created_at,
            },
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/auth/login",
    request_body = LoginRequest,
    responses(
        (status = 200, description = "Logged in", body = SessionResponse),
        (status = 401, description = "Invalid credentials"),
        (status = 500, description = "Server error")
    ),
    tag = "auth"
)]
pub async fn login(
    State(state): State<AppState>,
    Json(payload): Json<LoginRequest>,
) -> Result<(HeaderMap, Json<SessionResponse>), (StatusCode, String)> {
    let user = user::Entity::find()
        .filter(user::Column::Email.eq(payload.email))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    verify_password(&payload.password, &user.password_hash)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Invalid credentials".to_string()))?;

    let (_session, cookie) = create_session(&state.db, user.id).await?;
    let mut headers = HeaderMap::new();
    headers.insert(axum::http::header::SET_COOKIE, cookie);

    Ok((
        headers,
        Json(SessionResponse {
            user: UserResponse {
                id: user.id,
                email: user.email,
                address: user.address,
                company_id: user.company_id,
                created_at: user.created_at,
            },
        }),
    ))
}

#[utoipa::path(
    post,
    path = "/auth/logout",
    responses(
        (status = 200, description = "Logged out"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "auth"
)]
pub async fn logout(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<StatusCode, (StatusCode, String)> {
    let session_id = extract_session_id(&headers)
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session_uuid = Uuid::parse_str(&session_id)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session = session::Entity::find_by_id(session_uuid)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    if session.is_none() {
        return Err((StatusCode::UNAUTHORIZED, "Not authenticated".to_string()));
    }

    session::Entity::delete_by_id(session_uuid)
        .exec(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::OK)
}

#[utoipa::path(
    get,
    path = "/auth/me",
    responses(
        (status = 200, description = "Current user", body = UserResponse),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "auth"
)]
pub async fn me(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    let user = require_user(&state, &headers).await?;
    Ok(Json(UserResponse {
        id: user.id,
        email: user.email,
        address: user.address,
        company_id: user.company_id,
        created_at: user.created_at,
    }))
}

#[utoipa::path(
    patch,
    path = "/auth/profile",
    request_body = UpdateProfileRequest,
    responses(
        (status = 200, description = "Profile updated", body = UserResponse),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "auth"
)]
pub async fn update_profile(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<UpdateProfileRequest>,
) -> Result<Json<UserResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let mut active: user::ActiveModel = current_user.into();
    if let Some(address) = payload.address {
        active.address = Set(Some(address));
    }

    let updated = active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(UserResponse {
        id: updated.id,
        email: updated.email,
        address: updated.address,
        company_id: updated.company_id,
        created_at: updated.created_at,
    }))
}

pub async fn require_user(
    state: &AppState,
    headers: &HeaderMap,
) -> Result<user::Model, (StatusCode, String)> {
    let session_id = extract_session_id(headers)
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session_uuid = Uuid::parse_str(&session_id)
        .map_err(|_| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    let session = session::Entity::find_by_id(session_uuid)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    if session.expires_at < Utc::now() {
        return Err((StatusCode::UNAUTHORIZED, "Session expired".to_string()));
    }

    let user = user::Entity::find_by_id(session.user_id)
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::UNAUTHORIZED, "Not authenticated".to_string()))?;

    Ok(user)
}

async fn create_session(
    db: &DatabaseConnection,
    user_id: Uuid,
) -> Result<(session::Model, axum::http::HeaderValue), (StatusCode, String)> {
    let now = Utc::now();
    let expires_at = now + chrono::Duration::days(SESSION_DURATION_DAYS);
    let session_active = session::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(user_id),
        created_at: Set(now),
        expires_at: Set(expires_at),
    };

    let session = session_active
        .insert(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let max_age = SESSION_DURATION_DAYS * 24 * 60 * 60;
    let secure = std::env::var("COOKIE_SECURE").unwrap_or_else(|_| "false".to_string());
    let secure_flag = if secure == "true" { "; Secure" } else { "" };

    let cookie_value = format!(
        "session_id={}; Path=/; HttpOnly; SameSite=Lax; Max-Age={}{}",
        session.id, max_age, secure_flag
    );

    let header = axum::http::HeaderValue::from_str(&cookie_value)
        .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid cookie".to_string()))?;

    Ok((session, header))
}

fn extract_session_id(headers: &HeaderMap) -> Option<String> {
    let cookie = headers.get(axum::http::header::COOKIE)?.to_str().ok()?;
    cookie
        .split(';')
        .map(|part| part.trim())
        .find_map(|part| part.strip_prefix("session_id="))
        .map(|v| v.to_string())
}

fn hash_password(password: &str) -> Result<String, String> {
    let salt = SaltString::generate(&mut OsRng);
    let hash = Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map_err(|e| e.to_string())?
        .to_string();
    Ok(hash)
}

fn verify_password(password: &str, hash: &str) -> Result<(), String> {
    let parsed = PasswordHash::new(hash).map_err(|e| e.to_string())?;
    Argon2::default()
        .verify_password(password.as_bytes(), &parsed)
        .map_err(|e| e.to_string())?;
    Ok(())
}
