use axum::{routing::{get, post}, Router};
use migration::{Migrator, MigratorTrait};
use sea_orm::Database;
use std::net::SocketAddr;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use tower_http::cors::{Any, CorsLayer};

mod entity;
mod migration;
mod modules;

use modules::auth::{
    __path_login, __path_logout, __path_me, __path_register, login, logout, me, register,
    LoginRequest, RegisterRequest, SessionResponse, UserResponse,
};
use modules::company::{
    __path_create_company, __path_get_my_company, create_company, get_my_company,
    CompanyCreateRequest, CompanyResponse,
};
use modules::invoices::{
    __path_create_invoice, __path_get_invoice, create_invoice, get_invoice, InvoiceResponse,
    NewInvoice,
};
use modules::shared::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        root,
        create_invoice,
        get_invoice,
        create_company,
        get_my_company,
        register,
        login,
        logout,
        me
    ),
    components(schemas(
        NewInvoice,
        InvoiceResponse,
        CompanyCreateRequest,
        CompanyResponse,
        RegisterRequest,
        LoginRequest,
        UserResponse,
        SessionResponse
    )),
    tags(
        (name = "health", description = "Health check"),
        (name = "invoices", description = "Invoice management"),
        (name = "auth", description = "Authentication"),
        (name = "company", description = "Company onboarding")
    )
)]
struct ApiDoc;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenv::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set in .env");
    let db = Database::connect(database_url).await?;

    Migrator::up(&db, None).await?;

    let app = Router::new()
        .route("/", get(root))
        .route("/invoices", post(create_invoice))
        .route("/invoices/:id", get(get_invoice))
        .route("/company", post(create_company))
        .route("/company/me", get(get_my_company))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
        .merge(SwaggerUi::new("/docs").url("/api-doc/openapi.json", ApiDoc::openapi()))
        .layer(build_cors())
        .with_state(AppState { db });

    let addr = SocketAddr::from(([0, 0, 0, 0], 3000));
    println!("🚀 Running at http://{}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

#[utoipa::path(
    get,
    path = "/",
    responses(
        (status = 200, description = "API is live", body = String)
    ),
    tag = "health"
)]
async fn root() -> &'static str {
    "📋 Freelance Forge API is live"
}

fn build_cors() -> CorsLayer {
    let origin = std::env::var("FRONTEND_ORIGIN")
        .unwrap_or_else(|_| "http://localhost:5173".to_string());
    let allowed_origin = origin
        .parse::<axum::http::HeaderValue>()
        .unwrap_or_else(|_| axum::http::HeaderValue::from_static("http://localhost:5173"));

    CorsLayer::new()
        .allow_origin(allowed_origin)
        .allow_methods(Any)
        .allow_headers(Any)
        .allow_credentials(true)
}
