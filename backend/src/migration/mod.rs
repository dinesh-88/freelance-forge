pub use sea_orm_migration::prelude::*;

mod m20260201_000001_create_invoices;
mod m20260201_000002_create_auth;
mod m20260201_000003_company_and_addresses;
mod m20260201_000004_company_registration_number;
mod m20260201_000005_invoice_line_items;
mod m20260201_000006_invoice_client_address;
mod m20260201_000007_company_invoice_owner;
mod m20260201_000008_invoice_templates;
mod m20260201_000009_invoice_template_layout;
mod m20260201_000010_invoice_template_note_default;
mod m20260201_000011_invoice_template_html;
mod m20260201_000012_invoice_line_item_mode;
mod m20260201_000013_invoice_number;
mod m20260201_000014_expenses;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![
            Box::new(m20260201_000001_create_invoices::Migration),
            Box::new(m20260201_000002_create_auth::Migration),
            Box::new(m20260201_000003_company_and_addresses::Migration),
            Box::new(m20260201_000004_company_registration_number::Migration),
            Box::new(m20260201_000005_invoice_line_items::Migration),
            Box::new(m20260201_000006_invoice_client_address::Migration),
            Box::new(m20260201_000007_company_invoice_owner::Migration),
            Box::new(m20260201_000008_invoice_templates::Migration),
            Box::new(m20260201_000009_invoice_template_layout::Migration),
            Box::new(m20260201_000010_invoice_template_note_default::Migration),
            Box::new(m20260201_000011_invoice_template_html::Migration),
            Box::new(m20260201_000012_invoice_line_item_mode::Migration),
            Box::new(m20260201_000013_invoice_number::Migration),
            Box::new(m20260201_000014_expenses::Migration),
        ]
    }
}
