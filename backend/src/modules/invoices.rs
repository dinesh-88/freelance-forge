use crate::entity::invoice;
use crate::modules::auth::require_user;
use crate::modules::shared::AppState;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::NaiveDate;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use printpdf::{BuiltinFont, Mm, PdfDocument};
use std::io::{BufWriter, Cursor};

#[derive(Deserialize, ToSchema)]
pub struct NewInvoice {
    pub client_name: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub date: NaiveDate,
}

#[derive(Serialize, ToSchema)]
pub struct InvoiceResponse {
    pub id: Uuid,
    pub client_name: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub user_address: String,
    pub date: NaiveDate,
}

#[utoipa::path(
    post,
    path = "/invoices",
    request_body = NewInvoice,
    responses(
        (status = 200, description = "Invoice created", body = InvoiceResponse),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn create_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<NewInvoice>,
) -> Result<Json<InvoiceResponse>, (axum::http::StatusCode, String)> {
    let user = require_user(&state, &headers).await?;
    let user_address = user
        .address
        .ok_or_else(|| (axum::http::StatusCode::BAD_REQUEST, "User address is required".to_string()))?;
    let active = invoice::ActiveModel {
        id: Set(Uuid::new_v4()),
        client_name: Set(payload.client_name),
        description: Set(payload.description),
        amount: Set(payload.amount),
        currency: Set(payload.currency),
        user_address: Set(user_address.clone()),
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
        user_address: invoice.user_address,
        date: invoice.date,
    }))
}

#[utoipa::path(
    get,
    path = "/invoices/{id}",
    params(
        ("id" = String, Path, description = "Invoice id (UUID)")
    ),
    responses(
        (status = 200, description = "Invoice found", body = InvoiceResponse),
        (status = 400, description = "Invalid id"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Invoice not found"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn get_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Json<InvoiceResponse>, (axum::http::StatusCode, String)> {
    let _user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (axum::http::StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let invoice = invoice::Entity::find()
        .filter(invoice::Column::Id.eq(id))
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
        user_address: invoice.user_address,
        date: invoice.date,
    }))
}

#[utoipa::path(
    get,
    path = "/invoices/{id}/pdf",
    params(
        ("id" = String, Path, description = "Invoice id (UUID)")
    ),
    responses(
        (status = 200, description = "Invoice PDF"),
        (status = 400, description = "Invalid id"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Invoice not found"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn get_invoice_pdf(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<Response, (StatusCode, String)> {
    let _user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let invoice = invoice::Entity::find()
        .filter(invoice::Column::Id.eq(id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    let pdf_bytes = build_invoice_pdf(&invoice)
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e))?;

    let mut response_headers = HeaderMap::new();
    response_headers.insert(
        axum::http::header::CONTENT_TYPE,
        HeaderValue::from_static("application/pdf"),
    );
    response_headers.insert(
        axum::http::header::CONTENT_DISPOSITION,
        HeaderValue::from_str(&format!("attachment; filename=\"invoice-{}.pdf\"", invoice.id))
            .map_err(|_| (StatusCode::INTERNAL_SERVER_ERROR, "Invalid filename".to_string()))?,
    );

    Ok((response_headers, pdf_bytes).into_response())
}

fn build_invoice_pdf(invoice: &invoice::Model) -> Result<Vec<u8>, String> {
    let (doc, page, layer) = PdfDocument::new("Invoice", Mm(210.0), Mm(297.0), "Layer 1");
    let layer = doc.get_page(page).get_layer(layer);
    let font = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;

    let lines = vec![
        ("Invoice", 24.0, 270.0),
        (&format!("Invoice ID: {}", invoice.id), 12.0, 250.0),
        (&format!("Client: {}", invoice.client_name), 12.0, 235.0),
        (&format!("Description: {}", invoice.description), 12.0, 220.0),
        (&format!("Amount: {} {}", invoice.currency, invoice.amount), 12.0, 205.0),
        (&format!("Date: {}", invoice.date), 12.0, 190.0),
        ("User Address Snapshot:", 12.0, 175.0),
        (&invoice.user_address, 12.0, 160.0),
    ];

    for (text, size, y) in lines {
        layer.use_text(text, size, Mm(20.0), Mm(y), &font);
    }

    let mut buffer = BufWriter::new(Cursor::new(Vec::new()));
    doc.save(&mut buffer).map_err(|e| e.to_string())?;
    let cursor = buffer.into_inner().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}
