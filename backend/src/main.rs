use axum::{
    extract::{Path, State},
    routing::{get, post},
    Json, Router,
};
use chrono::NaiveDate;
use migration::{Migrator, MigratorTrait};
use sea_orm::{
    ActiveModelTrait, ColumnTrait, Database, DatabaseConnection, EntityTrait, QueryFilter, Set,
};
use serde::{Deserialize, Serialize};
use std::net::SocketAddr;
use uuid::Uuid;

#[derive(Clone)]
struct AppState {
    db: DatabaseConnection,
}

// ---------- Create Invoice Payload ----------
#[derive(Deserialize)]
struct NewInvoice {
    client_name: String,
    description: String,
    amount: f64,
    currency: String,
    date: NaiveDate,
}

#[derive(Serialize)]
struct InvoiceResponse {
    id: Uuid,
    client_name: String,
    description: String,
    amount: f64,
    currency: String,
    date: NaiveDate,
}

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
        .with_state(AppState { db });

    let addr = SocketAddr::from(([127, 0, 0, 1], 3000));
    println!("🚀 Running at http://{}", addr);
    axum::Server::bind(&addr)
        .serve(app.into_make_service())
        .await?;

    Ok(())
}

async fn root() -> &'static str {
    "📋 Freelance Forge API is live"
}

async fn create_invoice(
    State(state): State<AppState>,
    Json(payload): Json<NewInvoice>,
) -> Result<Json<InvoiceResponse>, (axum::http::StatusCode, String)> {
    let active = entity::invoice::ActiveModel {
        id: Set(Uuid::new_v4()),
        client_name: Set(payload.client_name),
        description: Set(payload.description),
        amount: Set(payload.amount),
        currency: Set(payload.currency),
        date: Set(payload.date),
    };

    let invoice = active
        .insert(&state.db)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(InvoiceResponse {
        id: invoice.id,
        client_name: invoice.client_name,
        description: invoice.description,
        amount: invoice.amount,
        currency: invoice.currency,
        date: invoice.date,
    }))
}

async fn get_invoice(
    State(state): State<AppState>,
    Path(id): Path<String>,
) -> Result<Json<InvoiceResponse>, (axum::http::StatusCode, String)> {
    let id = Uuid::parse_str(&id)
        .map_err(|_| (axum::http::StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let invoice = entity::invoice::Entity::find()
        .filter(entity::invoice::Column::Id.eq(id))
        .one(&state.db)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (axum::http::StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    Ok(Json(InvoiceResponse {
        id: invoice.id,
        client_name: invoice.client_name,
        description: invoice.description,
        amount: invoice.amount,
        currency: invoice.currency,
        date: invoice.date,
    }))
}

mod entity {
    use sea_orm::entity::prelude::*;

    #[derive(Clone, Debug, PartialEq, DeriveEntityModel, Eq)]
    #[sea_orm(table_name = "invoices")]
    pub struct Model {
        #[sea_orm(primary_key)]
        pub id: Uuid,
        pub client_name: String,
        pub description: String,
        pub amount: f64,
        pub currency: String,
        pub date: Date,
    }

    #[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
    pub enum Relation {}

    impl ActiveModelBehavior for ActiveModel {}
}

mod migration;
