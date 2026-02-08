use sea_orm_migration::prelude::*;
use sea_orm::{DbBackend, Statement};

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .add_column(
                        ColumnDef::new(Invoice::InvoiceNumber)
                            .text()
                            .not_null()
                            .default(""),
                    )
                    .to_owned(),
            )
            .await?;

        let db = manager.get_connection();
        db.execute(Statement::from_string(
            DbBackend::Postgres,
            "WITH numbered AS (SELECT id, ROW_NUMBER() OVER (ORDER BY id) AS rn FROM invoice)\nUPDATE invoice SET invoice_number = CONCAT('IN-', LPAD(numbered.rn::text, 5, '0'))\nFROM numbered WHERE invoice.id = numbered.id".to_string(),
        ))
        .await?;

        Ok(())
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .drop_column(Invoice::InvoiceNumber)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    InvoiceNumber,
}
