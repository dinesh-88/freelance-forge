use axum::{routing::{get, post}, Router};
use migration::{Migrator, MigratorTrait};
use sea_orm::Database;
use std::net::SocketAddr;
use utoipa::OpenApi;
use utoipa_swagger_ui::SwaggerUi;
use tower_http::cors::CorsLayer;

mod entity;
mod migration;
mod modules;

use modules::auth::{
    __path_login, __path_logout, __path_me, __path_register, __path_update_profile, login,
    logout, me, register, update_profile, LoginRequest, RegisterRequest, SessionResponse,
    UpdateProfileRequest, UserResponse,
};
use modules::ai::{
    __path_improve_line_item, __path_last_line_item, improve_line_item, last_line_item,
    ImproveLineItemRequest, ImproveLineItemResponse, LastLineItemResponse,
};
use modules::company::{
    __path_create_company, __path_get_my_company, __path_list_companies, __path_update_company,
    create_company, get_my_company, list_companies, update_company, CompanyCreateRequest,
    CompanyResponse, CompanyUpdateRequest,
};
use modules::expenses::{
    __path_create_expense, __path_create_receipt_upload_url, __path_delete_expense,
    __path_list_expenses, __path_update_expense, create_expense, create_receipt_upload_url,
    delete_expense, list_expenses, update_expense, ExpenseCreateRequest, ExpenseResponse,
    ExpenseUpdateRequest, ReceiptUploadRequest, ReceiptUploadResponse,
};
use modules::invoices::{
    __path_create_invoice, __path_get_invoice, __path_get_invoice_pdf, __path_list_invoices,
    __path_update_invoice, __path_create_template, __path_list_templates, __path_update_template,
    __path_delete_template, create_invoice, create_template, delete_template, get_invoice,
    get_invoice_pdf, list_invoices, list_templates, update_invoice, update_template,
    InvoiceResponse, LineItemInput, LineItemResponse, NewInvoice, TemplateCreateRequest,
    TemplateResponse, UpdateInvoiceRequest,
};
use modules::shared::AppState;

#[derive(OpenApi)]
#[openapi(
    paths(
        root,
        create_invoice,
        list_invoices,
        get_invoice,
        update_invoice,
        get_invoice_pdf,
        list_templates,
        create_template,
        update_template,
        delete_template,
        create_company,
        update_company,
        get_my_company,
        list_companies,
        list_expenses,
        create_expense,
        update_expense,
        delete_expense,
        create_receipt_upload_url,
        improve_line_item,
        last_line_item,
        register,
        update_profile,
        login,
        logout,
        me
    ),
    components(schemas(
        NewInvoice,
        LineItemInput,
        LineItemResponse,
        InvoiceResponse,
        UpdateInvoiceRequest,
        TemplateCreateRequest,
        TemplateResponse,
        CompanyCreateRequest,
        CompanyUpdateRequest,
        CompanyResponse,
        ExpenseCreateRequest,
        ExpenseUpdateRequest,
        ExpenseResponse,
        ReceiptUploadRequest,
        ReceiptUploadResponse,
        ImproveLineItemRequest,
        ImproveLineItemResponse,
        LastLineItemResponse,
        RegisterRequest,
        LoginRequest,
        UpdateProfileRequest,
        UserResponse,
        SessionResponse
    )),
    tags(
        (name = "health", description = "Health check"),
        (name = "invoices", description = "Invoice management"),
        (name = "auth", description = "Authentication"),
        (name = "company", description = "Company onboarding"),
        (name = "expenses", description = "Expense management"),
        (name = "ai", description = "AI helpers")
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
        .route("/invoices", get(list_invoices))
        .route("/invoices/:id", get(get_invoice))
        .route("/invoices/:id", axum::routing::patch(update_invoice))
        .route("/invoices/:id/pdf", get(get_invoice_pdf))
        .route("/invoice-templates", get(list_templates))
        .route("/invoice-templates", post(create_template))
        .route("/invoice-templates/:id", axum::routing::patch(update_template))
        .route("/invoice-templates/:id", axum::routing::delete(delete_template))
        .route("/company", post(create_company))
        .route("/company", axum::routing::patch(update_company))
        .route("/company", get(list_companies))
        .route("/company/me", get(get_my_company))
        .route("/expenses", get(list_expenses))
        .route("/expenses", post(create_expense))
        .route("/expenses/:id", axum::routing::patch(update_expense))
        .route("/expenses/:id", axum::routing::delete(delete_expense))
        .route("/expenses/receipt-url", post(create_receipt_upload_url))
        .route("/ai/line-item-improve", post(improve_line_item))
        .route("/ai/line-item-last", get(last_line_item))
        .route("/auth/register", post(register))
        .route("/auth/login", post(login))
        .route("/auth/logout", post(logout))
        .route("/auth/me", get(me))
        .route("/auth/profile", axum::routing::patch(update_profile))
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
    let origin = std::env::var("CORS_ORIGIN")
        .or_else(|_| std::env::var("FRONTEND_ORIGIN"))
        .unwrap_or_else(|_| "http://localhost:5173".to_string());
    let allowed_origin = origin
        .parse::<axum::http::HeaderValue>()
        .unwrap_or_else(|_| axum::http::HeaderValue::from_static("http://localhost:5173"));

    CorsLayer::new()
        .allow_origin(allowed_origin)
        .allow_methods([
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::PATCH,
            axum::http::Method::DELETE,
        ])
        .allow_headers([axum::http::header::CONTENT_TYPE])
        .allow_credentials(true)
}
