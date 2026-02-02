use sea_orm_migration::prelude::*;

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
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(InvoiceTemplate::Table)
                    .drop_column(InvoiceTemplate::Footer)
                    .drop_column(InvoiceTemplate::Body)
                    .drop_column(InvoiceTemplate::Header)
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
}
