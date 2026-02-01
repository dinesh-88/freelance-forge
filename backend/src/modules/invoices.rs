use crate::entity::{invoice, invoice_line_item};
use crate::modules::auth::require_user;
use crate::modules::shared::AppState;
use axum::{
    extract::{Path, State},
    http::{HeaderMap, HeaderValue, StatusCode},
    response::{IntoResponse, Response},
    Json,
};
use chrono::NaiveDate;
use sea_orm::{
    ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set, TransactionTrait,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use printpdf::{BuiltinFont, Mm, PdfDocument};
use std::io::{BufWriter, Cursor};

#[derive(Deserialize, ToSchema)]
pub struct NewInvoice {
    pub client_name: String,
    pub client_address: String,
    pub currency: String,
    pub date: NaiveDate,
    pub items: Vec<LineItemInput>,
}

#[derive(Deserialize, ToSchema)]
pub struct LineItemInput {
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
}

#[derive(Serialize, ToSchema)]
pub struct LineItemResponse {
    pub id: Uuid,
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub line_total: f64,
}

#[derive(Serialize, ToSchema)]
pub struct InvoiceResponse {
    pub id: Uuid,
    pub client_name: String,
    pub client_address: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub user_address: String,
    pub total_amount: f64,
    pub date: NaiveDate,
    pub items: Vec<LineItemResponse>,
}

#[derive(Deserialize, ToSchema)]
pub struct UpdateInvoiceRequest {
    pub client_name: Option<String>,
    pub client_address: Option<String>,
    pub description: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub date: Option<NaiveDate>,
    pub items: Option<Vec<LineItemInput>>,
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
    if payload.items.is_empty() {
        return Err((StatusCode::BAD_REQUEST, "At least one line item is required".to_string()));
    }

    if payload.client_address.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Client address is required".to_string()));
    }

    let total_amount = payload
        .items
        .iter()
        .map(|item| item.quantity * item.unit_price)
        .sum::<f64>();

    let description = payload
        .items
        .get(0)
        .map(|item| item.description.clone())
        .unwrap_or_else(|| "Line items".to_string());

    let txn = state
        .db
        .begin()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let active = invoice::ActiveModel {
        id: Set(Uuid::new_v4()),
        client_name: Set(payload.client_name),
        client_address: Set(payload.client_address),
        description: Set(description),
        amount: Set(total_amount),
        currency: Set(payload.currency),
        user_address: Set(user_address.clone()),
        total_amount: Set(total_amount),
        date: Set(payload.date),
    };

    let created = active
        .insert(&txn)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut items_response = Vec::with_capacity(payload.items.len());
    for item in payload.items {
        let line_total = item.quantity * item.unit_price;
        let active_item = invoice_line_item::ActiveModel {
            id: Set(Uuid::new_v4()),
            invoice_id: Set(created.id),
            description: Set(item.description),
            quantity: Set(item.quantity),
            unit_price: Set(item.unit_price),
            line_total: Set(line_total),
        };
        let saved = active_item
            .insert(&txn)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
        items_response.push(LineItemResponse {
            id: saved.id,
            description: saved.description,
            quantity: saved.quantity,
            unit_price: saved.unit_price,
            line_total: saved.line_total,
        });
    }

    txn.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(InvoiceResponse {
        id: created.id,
        client_name: created.client_name,
        client_address: created.client_address,
        description: created.description,
        amount: created.amount,
        currency: created.currency,
        user_address: created.user_address,
        total_amount: created.total_amount,
        date: created.date,
        items: items_response,
    }))
}

#[utoipa::path(
    get,
    path = "/invoices",
    responses(
        (status = 200, description = "Invoice list", body = [InvoiceResponse]),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn list_invoices(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<InvoiceResponse>>, (StatusCode, String)> {
    let _user = require_user(&state, &headers).await?;
    let invoices = invoice::Entity::find()
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut response = Vec::with_capacity(invoices.len());
    for item in invoices {
        let items = load_items(&state.db, item.id).await?;
        response.push(InvoiceResponse {
            id: item.id,
            client_name: item.client_name,
            client_address: item.client_address,
            description: item.description,
            amount: item.amount,
            currency: item.currency,
            user_address: item.user_address,
            total_amount: item.total_amount,
            date: item.date,
            items,
        });
    }

    Ok(Json(response))
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

    let items = load_items(&state.db, invoice.id).await?;
    Ok(Json(InvoiceResponse {
        id: invoice.id,
        client_name: invoice.client_name,
        client_address: invoice.client_address,
        description: invoice.description,
        amount: invoice.amount,
        currency: invoice.currency,
        user_address: invoice.user_address,
        total_amount: invoice.total_amount,
        date: invoice.date,
        items,
    }))
}

#[utoipa::path(
    patch,
    path = "/invoices/{id}",
    params(
        ("id" = String, Path, description = "Invoice id (UUID)")
    ),
    request_body = UpdateInvoiceRequest,
    responses(
        (status = 200, description = "Invoice updated", body = InvoiceResponse),
        (status = 400, description = "Invalid id"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Invoice not found"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn update_invoice(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<UpdateInvoiceRequest>,
) -> Result<Json<InvoiceResponse>, (StatusCode, String)> {
    let _user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let existing = invoice::Entity::find()
        .filter(invoice::Column::Id.eq(id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    let mut active: invoice::ActiveModel = existing.into();
    if let Some(client_name) = payload.client_name {
        active.client_name = Set(client_name);
    }
    if let Some(client_address) = payload.client_address {
        active.client_address = Set(client_address);
    }
    if let Some(description) = payload.description {
        active.description = Set(description);
    }
    if let Some(amount) = payload.amount {
        active.amount = Set(amount);
        active.total_amount = Set(amount);
    }
    if let Some(currency) = payload.currency {
        active.currency = Set(currency);
    }
    if let Some(date) = payload.date {
        active.date = Set(date);
    }
    if let Some(items) = payload.items {
        if items.is_empty() {
            return Err((StatusCode::BAD_REQUEST, "At least one line item is required".to_string()));
        }
        let total_amount = items
            .iter()
            .map(|item| item.quantity * item.unit_price)
            .sum::<f64>();
        active.amount = Set(total_amount);
        active.total_amount = Set(total_amount);
        if let Some(first) = items.get(0) {
            active.description = Set(first.description.clone());
        }

        let txn = state
            .db
            .begin()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let updated = active
            .update(&txn)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        invoice_line_item::Entity::delete_many()
            .filter(invoice_line_item::Column::InvoiceId.eq(updated.id))
            .exec(&txn)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        let mut items_response = Vec::with_capacity(items.len());
        for item in items {
            let line_total = item.quantity * item.unit_price;
            let active_item = invoice_line_item::ActiveModel {
                id: Set(Uuid::new_v4()),
                invoice_id: Set(updated.id),
                description: Set(item.description),
                quantity: Set(item.quantity),
                unit_price: Set(item.unit_price),
                line_total: Set(line_total),
            };
            let saved = active_item
                .insert(&txn)
                .await
                .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            items_response.push(LineItemResponse {
                id: saved.id,
                description: saved.description,
                quantity: saved.quantity,
                unit_price: saved.unit_price,
                line_total: saved.line_total,
            });
        }

        txn.commit()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(InvoiceResponse {
            id: updated.id,
            client_name: updated.client_name,
            client_address: updated.client_address,
            description: updated.description,
            amount: updated.amount,
            currency: updated.currency,
            user_address: updated.user_address,
            total_amount: updated.total_amount,
            date: updated.date,
            items: items_response,
        }));
    }

    let updated = active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let items = load_items(&state.db, updated.id).await?;

    Ok(Json(InvoiceResponse {
        id: updated.id,
        client_name: updated.client_name,
        client_address: updated.client_address,
        description: updated.description,
        amount: updated.amount,
        currency: updated.currency,
        user_address: updated.user_address,
        total_amount: updated.total_amount,
        date: updated.date,
        items,
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

    let items = load_items(&state.db, invoice.id).await?;
    let pdf_bytes = build_invoice_pdf(&invoice, &items)
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

fn build_invoice_pdf(
    invoice: &invoice::Model,
    items: &[LineItemResponse],
) -> Result<Vec<u8>, String> {
    let (doc, page, layer) = PdfDocument::new("Invoice", Mm(210.0), Mm(297.0), "Layer 1");
    let mut layer = doc.get_page(page).get_layer(layer);
    let font_regular = doc
        .add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| e.to_string())?;
    let font_bold = doc
        .add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| e.to_string())?;

    let left = 20.0f32;
    let right = 190.0f32;
    let mut y = 275.0f32;

    // Header
    layer.use_text("Invoice", 28.0, Mm(left), Mm(y), &font_bold);
    y -= 12.0;
    layer.use_text(
        format!("Invoice ID: {}", invoice.id),
        10.5,
        Mm(left),
        Mm(y),
        &font_regular,
    );
    y -= 8.0;
    layer.use_text(
        format!("Date: {}", invoice.date),
        10.5,
        Mm(left),
        Mm(y),
        &font_regular,
    );

    // Client block
    y -= 16.0;
    layer.use_text("Bill To", 12.0, Mm(left), Mm(y), &font_bold);
    y -= 7.0;
    layer.use_text(
        invoice.client_name.clone(),
        11.0,
        Mm(left),
        Mm(y),
        &font_regular,
    );
    y -= 6.5;
    layer.use_text(
        invoice.client_address.clone(),
        10.0,
        Mm(left),
        Mm(y),
        &font_regular,
    );

    // Description + amount row
    y -= 18.0;
    layer.use_text("Description", 11.0, Mm(left), Mm(y), &font_bold);
    layer.use_text("Qty", 11.0, Mm(right - 70.0), Mm(y), &font_bold);
    layer.use_text("Unit", 11.0, Mm(right - 50.0), Mm(y), &font_bold);
    layer.use_text("Total", 11.0, Mm(right - 25.0), Mm(y), &font_bold);
    y -= 8.0;

    for item in items {
        if y < 40.0 {
            let (page, layer_ref) = doc.add_page(Mm(210.0), Mm(297.0), "Layer");
            let next_layer = doc.get_page(page).get_layer(layer_ref);
            y = 275.0;
            next_layer.use_text("Invoice (cont.)", 18.0, Mm(left), Mm(y), &font_bold);
            y -= 12.0;
            next_layer.use_text(
                format!("Invoice ID: {}", invoice.id),
                10.0,
                Mm(left),
                Mm(y),
                &font_regular,
            );
            y -= 12.0;
            next_layer.use_text("Description", 11.0, Mm(left), Mm(y), &font_bold);
            next_layer.use_text("Qty", 11.0, Mm(right - 70.0), Mm(y), &font_bold);
            next_layer.use_text("Unit", 11.0, Mm(right - 50.0), Mm(y), &font_bold);
            next_layer.use_text("Total", 11.0, Mm(right - 25.0), Mm(y), &font_bold);
            y -= 8.0;
            y -= 2.0;
            for_item_row(&next_layer, &font_regular, &font_bold, left, right, &mut y, item, &invoice.currency);
            layer = next_layer;
            continue;
        }
        for_item_row(&layer, &font_regular, &font_bold, left, right, &mut y, item, &invoice.currency);
    }

    // Total row
    y -= 6.0;
    layer.use_text("Total", 11.0, Mm(right - 25.0), Mm(y), &font_bold);
    layer.use_text(
        format!("{} {:.2}", invoice.currency, invoice.total_amount),
        11.0,
        Mm(right - 25.0),
        Mm(y - 6.0),
        &font_bold,
    );

    // Footer
    y -= 20.0;
    layer.use_text("Notes", 10.0, Mm(left), Mm(y), &font_bold);
    y -= 6.0;
    layer.use_text(
        "Thank you for your business.",
        9.5,
        Mm(left),
        Mm(y),
        &font_regular,
    );

    let mut buffer = BufWriter::new(Cursor::new(Vec::new()));
    doc.save(&mut buffer).map_err(|e| e.to_string())?;
    let cursor = buffer.into_inner().map_err(|e| e.to_string())?;
    Ok(cursor.into_inner())
}

fn for_item_row(
    layer: &printpdf::PdfLayerReference,
    font_regular: &printpdf::IndirectFontRef,
    font_bold: &printpdf::IndirectFontRef,
    left: f32,
    right: f32,
    y: &mut f32,
    item: &LineItemResponse,
    currency: &str,
) {
    layer.use_text(&item.description, 10.0, Mm(left), Mm(*y), font_regular);
    layer.use_text(
        format!("{:.2}", item.quantity),
        10.0,
        Mm(right - 70.0),
        Mm(*y),
        font_regular,
    );
    layer.use_text(
        format!("{:.2}", item.unit_price),
        10.0,
        Mm(right - 50.0),
        Mm(*y),
        font_regular,
    );
    layer.use_text(
        format!("{} {:.2}", currency, item.line_total),
        10.5,
        Mm(right - 25.0),
        Mm(*y),
        font_bold,
    );
    *y -= 8.0;
}

async fn load_items(
    db: &sea_orm::DatabaseConnection,
    invoice_id: Uuid,
) -> Result<Vec<LineItemResponse>, (StatusCode, String)> {
    let items = invoice_line_item::Entity::find()
        .filter(invoice_line_item::Column::InvoiceId.eq(invoice_id))
        .all(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(items
        .into_iter()
        .map(|item| LineItemResponse {
            id: item.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            line_total: item.line_total,
        })
        .collect())
}
