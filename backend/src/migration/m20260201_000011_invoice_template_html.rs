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
                    .table(InvoiceTemplate::Table)
                    .add_column(
                        ColumnDef::new(InvoiceTemplate::Html)
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
            "UPDATE invoice_template SET html = CONCAT('<div class=\"section\">', COALESCE(header,''), '</div><div class=\"section\">', COALESCE(body,''), '</div><div class=\"section\">', COALESCE(footer,''), '</div>')".to_string(),
        ))
        .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(InvoiceTemplate::Table)
                    .drop_column(InvoiceTemplate::Footer)
                    .drop_column(InvoiceTemplate::Body)
                    .drop_column(InvoiceTemplate::Header)
                    .drop_column(InvoiceTemplate::Note)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(InvoiceTemplate::Table)
                    .add_column(
                        ColumnDef::new(InvoiceTemplate::Header)
                            .text()
                            .not_null()
                            .default(""),
                    )
                    .add_column(
                        ColumnDef::new(InvoiceTemplate::Body)
                            .text()
                            .not_null()
                            .default(""),
                    )
                    .add_column(
                        ColumnDef::new(InvoiceTemplate::Footer)
                            .text()
                            .not_null()
                            .default(""),
                    )
                    .add_column(
                        ColumnDef::new(InvoiceTemplate::Note)
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
            "UPDATE invoice_template SET header = html, body = '', footer = ''".to_string(),
        ))
        .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(InvoiceTemplate::Table)
                    .drop_column(InvoiceTemplate::Html)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum InvoiceTemplate {
    Table,
    Header,
    Body,
    Footer,
    Note,
    Html,
}
