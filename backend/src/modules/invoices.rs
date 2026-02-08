use crate::entity::{company, invoice, invoice_line_item, invoice_template};
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
    ActiveModelTrait, ColumnTrait, EntityTrait, PaginatorTrait, QueryFilter, QuerySelect, Set,
    TransactionTrait,
};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;
use uuid::Uuid;
use std::io::Write;
use std::process::{Command, Stdio};
use handlebars::{Context, Handlebars, Helper, HelperResult, Output, RenderContext};
use serde_json::json;

#[derive(Deserialize, ToSchema)]
pub struct NewInvoice {
    pub company_id: Uuid,
    pub template_id: Option<Uuid>,
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
    pub use_quantity: Option<bool>,
}

#[derive(Serialize, ToSchema)]
pub struct LineItemResponse {
    pub id: Uuid,
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub line_total: f64,
    pub use_quantity: bool,
}

#[derive(Serialize, ToSchema)]
pub struct InvoiceResponse {
    pub id: Uuid,
    pub invoice_number: String,
    pub company_id: Option<Uuid>,
    pub user_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
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
    pub company_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub client_name: Option<String>,
    pub client_address: Option<String>,
    pub description: Option<String>,
    pub amount: Option<f64>,
    pub currency: Option<String>,
    pub date: Option<NaiveDate>,
    pub items: Option<Vec<LineItemInput>>,
}

#[derive(Deserialize, ToSchema)]
pub struct TemplateCreateRequest {
    pub name: String,
    pub html: String,
}

#[derive(Serialize, ToSchema)]
pub struct TemplateResponse {
    pub id: Uuid,
    pub name: String,
    pub html: String,
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

    let company = company::Entity::find_by_id(payload.company_id)
        .filter(company::Column::UserId.eq(user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid company".to_string()))?;

    let total_amount = payload
        .items
        .iter()
        .map(|item| {
            if item.use_quantity.unwrap_or(true) {
                item.quantity * item.unit_price
            } else {
                item.unit_price
            }
        })
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

    let template_id = resolve_template_id(&state.db, user.id, payload.template_id).await?;

    let invoice_number = next_invoice_number(&state.db, user.id).await?;
    let active = invoice::ActiveModel {
        id: Set(Uuid::new_v4()),
        invoice_number: Set(invoice_number),
        user_id: Set(Some(user.id)),
        company_id: Set(Some(company.id)),
        template_id: Set(template_id),
        client_name: Set(company.name.clone()),
        client_address: Set(company.address.clone()),
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
        let use_quantity = item.use_quantity.unwrap_or(true);
        let line_total = if use_quantity {
            item.quantity * item.unit_price
        } else {
            item.unit_price
        };
        let active_item = invoice_line_item::ActiveModel {
            id: Set(Uuid::new_v4()),
            invoice_id: Set(created.id),
            description: Set(item.description),
            quantity: Set(item.quantity),
            unit_price: Set(item.unit_price),
            line_total: Set(line_total),
            use_quantity: Set(use_quantity),
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
            use_quantity: saved.use_quantity,
        });
    }

    txn.commit()
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(InvoiceResponse {
        id: created.id,
        invoice_number: created.invoice_number,
        company_id: created.company_id,
        user_id: created.user_id,
        template_id: created.template_id,
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
    let current_user = require_user(&state, &headers).await?;
    let invoices = invoice::Entity::find()
        .filter(invoice::Column::UserId.eq(current_user.id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    let mut response = Vec::with_capacity(invoices.len());
    for item in invoices {
        let items = load_items(&state.db, item.id).await?;
        response.push(InvoiceResponse {
            id: item.id,
            invoice_number: item.invoice_number,
            company_id: item.company_id,
            user_id: item.user_id,
            template_id: item.template_id,
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
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (axum::http::StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let invoice = invoice::Entity::find()
        .filter(invoice::Column::Id.eq(id))
        .filter(invoice::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (axum::http::StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (axum::http::StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    let items = load_items(&state.db, invoice.id).await?;
    Ok(Json(InvoiceResponse {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        company_id: invoice.company_id,
        user_id: invoice.user_id,
        template_id: invoice.template_id,
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
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let existing = invoice::Entity::find()
        .filter(invoice::Column::Id.eq(id))
        .filter(invoice::Column::UserId.eq(current_user.id))
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
    if let Some(company_id) = payload.company_id {
        let company = company::Entity::find_by_id(company_id)
            .filter(company::Column::UserId.eq(current_user.id))
            .one(&state.db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .ok_or_else(|| (StatusCode::BAD_REQUEST, "Invalid company".to_string()))?;
        active.company_id = Set(Some(company.id));
        active.client_name = Set(company.name);
        active.client_address = Set(company.address);
    }
    if let Some(template_id) = payload.template_id {
        let resolved = resolve_template_id(&state.db, current_user.id, Some(template_id)).await?;
        active.template_id = Set(resolved);
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
            .map(|item| {
                if item.use_quantity.unwrap_or(true) {
                    item.quantity * item.unit_price
                } else {
                    item.unit_price
                }
            })
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
            let use_quantity = item.use_quantity.unwrap_or(true);
            let line_total = if use_quantity {
                item.quantity * item.unit_price
            } else {
                item.unit_price
            };
            let active_item = invoice_line_item::ActiveModel {
                id: Set(Uuid::new_v4()),
                invoice_id: Set(updated.id),
                description: Set(item.description),
                quantity: Set(item.quantity),
                unit_price: Set(item.unit_price),
                line_total: Set(line_total),
                use_quantity: Set(use_quantity),
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
                use_quantity: saved.use_quantity,
            });
        }

        txn.commit()
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

        return Ok(Json(InvoiceResponse {
            id: updated.id,
            invoice_number: updated.invoice_number,
            company_id: updated.company_id,
            user_id: updated.user_id,
            template_id: updated.template_id,
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
        invoice_number: updated.invoice_number,
        company_id: updated.company_id,
        user_id: updated.user_id,
        template_id: updated.template_id,
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
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;

    let invoice = invoice::Entity::find()
        .filter(invoice::Column::Id.eq(id))
        .filter(invoice::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Invoice not found".to_string()))?;

    let items = load_items(&state.db, invoice.id).await?;
    let template = load_template(&state.db, invoice.user_id, invoice.template_id).await?;
    let pdf_bytes = build_invoice_pdf(&invoice, &items, &template)
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

#[utoipa::path(
    get,
    path = "/invoice-templates",
    responses(
        (status = 200, description = "Template list", body = [TemplateResponse]),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn list_templates(
    State(state): State<AppState>,
    headers: HeaderMap,
) -> Result<Json<Vec<TemplateResponse>>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let templates = invoice_template::Entity::find()
        .filter(invoice_template::Column::UserId.eq(current_user.id))
        .all(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(
        templates
            .into_iter()
            .map(|item| TemplateResponse {
                id: item.id,
                name: item.name,
                html: item.html,
            })
            .collect(),
    ))
}

#[utoipa::path(
    post,
    path = "/invoice-templates",
    request_body = TemplateCreateRequest,
    responses(
        (status = 200, description = "Template created", body = TemplateResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn create_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(payload): Json<TemplateCreateRequest>,
) -> Result<Json<TemplateResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    if payload.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Name is required".to_string()));
    }

    let active = invoice_template::ActiveModel {
        id: Set(Uuid::new_v4()),
        user_id: Set(current_user.id),
        name: Set(payload.name),
        html: Set(payload.html),
        created_at: Set(chrono::Utc::now()),
    };

    let created = active
        .insert(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(TemplateResponse {
        id: created.id,
        name: created.name,
        html: created.html,
    }))
}

#[utoipa::path(
    patch,
    path = "/invoice-templates/{id}",
    request_body = TemplateCreateRequest,
    responses(
        (status = 200, description = "Template updated", body = TemplateResponse),
        (status = 400, description = "Invalid input"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Template not found"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn update_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<TemplateCreateRequest>,
) -> Result<Json<TemplateResponse>, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = invoice_template::Entity::find_by_id(id)
        .filter(invoice_template::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Template not found".to_string()))?;

    if payload.name.trim().is_empty() {
        return Err((StatusCode::BAD_REQUEST, "Name is required".to_string()));
    }

    let mut active: invoice_template::ActiveModel = existing.into();
    active.name = Set(payload.name);
    active.html = Set(payload.html);

    let updated = active
        .update(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(Json(TemplateResponse {
        id: updated.id,
        name: updated.name,
        html: updated.html,
    }))
}

#[utoipa::path(
    delete,
    path = "/invoice-templates/{id}",
    responses(
        (status = 204, description = "Template deleted"),
        (status = 401, description = "Not authenticated"),
        (status = 404, description = "Template not found"),
        (status = 500, description = "Server error")
    ),
    tag = "invoices"
)]
pub async fn delete_template(
    State(state): State<AppState>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> Result<StatusCode, (StatusCode, String)> {
    let current_user = require_user(&state, &headers).await?;
    let id = Uuid::parse_str(&id)
        .map_err(|_| (StatusCode::BAD_REQUEST, "Invalid id".to_string()))?;
    let existing = invoice_template::Entity::find_by_id(id)
        .filter(invoice_template::Column::UserId.eq(current_user.id))
        .one(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        .ok_or_else(|| (StatusCode::NOT_FOUND, "Template not found".to_string()))?;

    invoice_template::Entity::delete_by_id(existing.id)
        .exec(&state.db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;

    Ok(StatusCode::NO_CONTENT)
}

fn build_invoice_pdf(
    invoice: &invoice::Model,
    items: &[LineItemResponse],
    template: &InvoiceTemplateData,
) -> Result<Vec<u8>, String> {
    let mut handlebars = Handlebars::new();
    handlebars.register_escape_fn(|s| s.to_string());
    handlebars.register_helper(
        "money",
        Box::new(
            |h: &Helper<'_>,
             _: &Handlebars,
             ctx: &Context,
             _: &mut RenderContext<'_, '_>,
             out: &mut dyn Output|
             -> HelperResult {
                let value = h
                    .param(0)
                    .and_then(|v| v.value().as_f64())
                    .unwrap_or(0.0);
                let currency = h
                    .param(1)
                    .and_then(|v| v.value().as_str())
                    .or_else(|| ctx.data().get("currency").and_then(|v| v.as_str()))
                    .unwrap_or("EUR");
                out.write(&format_money(value, currency))?;
                Ok(())
            },
        ),
    );
    let subtotal: f64 = items.iter().map(|item| item.line_total).sum();
    let invoice_note = "Rechnungsbetrag ohne Umsatzsteuer gemäß § 19 Abs. 1 UStG. (Invoice amount without sales tax according to § 19 paragraph 1 UStG)".to_string();
    let ctx = json!({
        "invoice_id": invoice.id.to_string(),
        "invoice_number": invoice.invoice_number,
        "invoice_date": invoice.date.to_string(),
        "client_name": invoice.client_name,
        "client_address": invoice.client_address,
        "user_address": invoice.user_address,
        "currency": invoice.currency,
        "total_amount": invoice.total_amount,
        "subtotal": subtotal,
        "invoice_note": invoice_note,
        "items": items.iter().map(|item| {
            json!({
                "description": item.description,
                "quantity": item.quantity,
                "unit_price": item.unit_price,
                "line_total": item.line_total,
                "use_quantity": item.use_quantity,
            })
        }).collect::<Vec<_>>(),
    });

    let render = |input: &str| -> String {
        if input.trim().is_empty() {
            return String::new();
        }
        handlebars
            .render_template(input, &ctx)
            .unwrap_or_else(|_| input.to_string())
    };

    let html = if template.is_custom {
        let template_html = render(&template.html);
        if template_html.to_lowercase().contains("<html") {
            template_html
        } else {
            format!(
                r#"<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {{ font-family: "DejaVu Sans", Arial, sans-serif; color: #222; margin: 32px; }}
    h1, h2, h3 {{ margin: 0 0 8px; }}
    .section {{ margin-bottom: 18px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }}
    th {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }}
    .right {{ text-align: right; }}
  </style>
</head>
<body>
  {}
</body>
</html>"#,
                template_html
            )
        }
    } else {
        let html_template = format!(
            r#"<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    body {{ font-family: "DejaVu Sans", Arial, sans-serif; color: #222; margin: 32px; }}
    h1 {{ margin: 0 0 8px; }}
    h2 {{ margin: 0 0 6px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.08em; }}
    .row {{ display: flex; justify-content: space-between; gap: 12px; }}
    .section {{ margin-bottom: 18px; }}
    .muted {{ color: #666; font-size: 12px; }}
    table {{ width: 100%; border-collapse: collapse; margin-top: 12px; }}
    th, td {{ border-bottom: 1px solid #ddd; padding: 6px 4px; text-align: left; }}
    th {{ font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }}
    .right {{ text-align: right; }}
    .totals {{ margin-top: 10px; text-align: right; font-weight: bold; }}
  </style>
</head>
<body>
  <div class="section">
    <h1>Invoice</h1>
    <div class="muted">{}</div>
    <div class="row muted" style="margin-top:6px;">
      <div>Invoice ID: {}</div>
      <div>Date: {}</div>
    </div>
  </div>

  <div class="section">
    <h2>Bill To</h2>
    <div>{}</div>
    <div class="muted">{}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Description</th>
        <th class="right">Qty</th>
        <th class="right">Unit</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      {{#each items}}
      <tr>
        <td>{{description}}</td>
        <td class="right">{{quantity}}</td>
        <td class="right">{{unit_price}}</td>
        <td class="right">{{currency}} {{line_total}}</td>
      </tr>
      {{/each}}
    </tbody>
  </table>

  <div class="totals">
    Subtotal: {{currency}} {{subtotal}}<br/>
    Total: {{currency}} {{total_amount}}
  </div>

  <div class="section" style="margin-top:18px;">
    <h2>Notes</h2>
    <div class="muted">{{invoice_note}}</div>
  </div>
</body>
</html>"#,
            invoice.user_address,
            invoice.id,
            invoice.date,
            invoice.client_name,
            invoice.client_address
        );
        handlebars
            .render_template(&html_template, &ctx)
            .unwrap_or_else(|_| html_template)
    };

    let mut child = Command::new("wkhtmltopdf")
        .args(["-q", "--encoding", "utf-8", "-", "-"])
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("wkhtmltopdf failed to start: {}", e))?;

    if let Some(stdin) = child.stdin.as_mut() {
        stdin
            .write_all(html.as_bytes())
            .map_err(|e| format!("wkhtmltopdf stdin write failed: {}", e))?;
    }

    let output = child
        .wait_with_output()
        .map_err(|e| format!("wkhtmltopdf failed: {}", e))?;
    if !output.status.success() {
        return Err(String::from_utf8_lossy(&output.stderr).to_string());
    }

    Ok(output.stdout)
}

fn format_money(value: f64, currency: &str) -> String {
    let (thousands, decimal) = match currency {
        "EUR" => ('.', ','),
        "USD" | "GBP" => (',', '.'),
        _ => (',', '.'),
    };

    let sign = if value < 0.0 { "-" } else { "" };
    let abs_value = value.abs();
    let raw = format!("{:.2}", abs_value);
    let mut parts = raw.split('.');
    let int_part = parts.next().unwrap_or("0");
    let frac_part = parts.next().unwrap_or("00");

    let mut grouped = String::new();
    for (i, ch) in int_part.chars().rev().enumerate() {
        if i > 0 && i % 3 == 0 {
            grouped.push(thousands);
        }
        grouped.push(ch);
    }
    let int_grouped: String = grouped.chars().rev().collect();
    format!("{sign}{int_grouped}{decimal}{frac_part}")
}

#[derive(Clone)]
struct InvoiceTemplateData {
    html: String,
    is_custom: bool,
}

async fn resolve_template_id(
    db: &sea_orm::DatabaseConnection,
    user_id: Uuid,
    template_id: Option<Uuid>,
) -> Result<Option<Uuid>, (StatusCode, String)> {
    if let Some(id) = template_id {
        let exists = invoice_template::Entity::find_by_id(id)
            .filter(invoice_template::Column::UserId.eq(user_id))
            .one(db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
            .is_some();
        if !exists {
            return Err((StatusCode::BAD_REQUEST, "Invalid template".to_string()));
        }
        return Ok(Some(id));
    }
    Ok(None)
}

async fn load_template(
    db: &sea_orm::DatabaseConnection,
    user_id: Option<Uuid>,
    template_id: Option<Uuid>,
) -> Result<InvoiceTemplateData, (StatusCode, String)> {
    let default_note = "Rechnungsbetrag ohne Umsatzsteuer gemäß § 19 Abs. 1 UStG. (Invoice amount without sales tax according to § 19 paragraph 1 UStG)".to_string();
    let Some(user_id) = user_id else {
        return Ok(default_template(default_note));
    };
    if let Some(id) = template_id {
        if let Some(template) = invoice_template::Entity::find_by_id(id)
            .filter(invoice_template::Column::UserId.eq(user_id))
            .one(db)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?
        {
            return Ok(InvoiceTemplateData {
                html: template.html,
                is_custom: true,
            });
        }
    }
    Ok(default_template(default_note))
}

fn default_template(note: String) -> InvoiceTemplateData {
    InvoiceTemplateData {
        html: format!(
            r#"<div class="section">
  <h1>Invoice</h1>
  <div class="muted">{{{{user_address}}}}</div>
  <div class="row muted" style="margin-top:6px;">
    <div>Invoice ID: {{{{invoice_id}}}}</div>
    <div>Date: {{{{invoice_date}}}}</div>
  </div>
</div>

<div class="section">
  <h2>Bill To</h2>
  <div>{{{{client_name}}}}</div>
  <div class="muted">{{{{client_address}}}}</div>
</div>

<table>
  <thead>
    <tr>
      <th>Description</th>
      <th class="right">Qty</th>
      <th class="right">Unit</th>
      <th class="right">Total</th>
    </tr>
  </thead>
  <tbody>
    {{{{#each items}}}}
    <tr>
      <td>{{{{description}}}}</td>
      <td class="right">{{{{quantity}}}}</td>
      <td class="right">{{{{unit_price}}}}</td>
      <td class="right">{{{{currency}}}} {{{{line_total}}}}</td>
    </tr>
    {{{{/each}}}}
  </tbody>
</table>

<div class="totals">
  Subtotal: {{{{currency}}}} {{{{subtotal}}}}<br/>
  Total: {{{{currency}}}} {{{{total_amount}}}}
</div>

<div class="section" style="margin-top:18px;">
  <h2>Notes</h2>
  <div class="muted">{}</div>
</div>"#,
            note
        ),
        is_custom: false,
    }
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
            use_quantity: item.use_quantity,
        })
        .collect())
}

async fn next_invoice_number(
    db: &sea_orm::DatabaseConnection,
    user_id: Uuid,
) -> Result<String, (StatusCode, String)> {
    let count = invoice::Entity::find()
        .filter(invoice::Column::UserId.eq(user_id))
        .count(db)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    Ok(format!("IN-{:05}", count + 1))
}
