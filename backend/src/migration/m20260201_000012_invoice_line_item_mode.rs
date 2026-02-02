use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(InvoiceLineItem::Table)
                    .add_column(
                        ColumnDef::new(InvoiceLineItem::UseQuantity)
                            .boolean()
                            .not_null()
                            .default(true),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(InvoiceLineItem::Table)
                    .drop_column(InvoiceLineItem::UseQuantity)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum InvoiceLineItem {
    Table,
    UseQuantity,
}
