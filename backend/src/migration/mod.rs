pub use sea_orm_migration::prelude::*;

mod m20260201_000001_create_invoices;
mod m20260201_000002_create_auth;
mod m20260201_000003_company_and_addresses;
mod m20260201_000004_company_registration_number;
mod m20260201_000005_invoice_line_items;
mod m20260201_000006_invoice_client_address;

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
        ]
    }
}
