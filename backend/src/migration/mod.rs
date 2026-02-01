pub use sea_orm_migration::prelude::*;

mod m20260201_000001_create_invoices;

pub struct Migrator;

#[async_trait::async_trait]
impl MigratorTrait for Migrator {
    fn migrations() -> Vec<Box<dyn MigrationTrait>> {
        vec![Box::new(m20260201_000001_create_invoices::Migration)]
    }
}
