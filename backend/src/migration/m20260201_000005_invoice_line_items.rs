use sea_orm_migration::prelude::*;
use sea_orm::Statement;

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
                        ColumnDef::new(Invoice::TotalAmount)
                            .double()
                            .not_null()
                            .default(0.0),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .get_connection()
            .execute(Statement::from_string(
                manager.get_database_backend(),
                "UPDATE invoice SET total_amount = amount",
            ))
            .await?;

        manager
            .create_table(
                Table::create()
                    .table(InvoiceLineItem::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(InvoiceLineItem::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(InvoiceLineItem::InvoiceId).uuid().not_null())
                    .col(
                        ColumnDef::new(InvoiceLineItem::Description)
                            .text()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(InvoiceLineItem::Quantity)
                            .double()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(InvoiceLineItem::UnitPrice)
                            .double()
                            .not_null(),
                    )
                    .col(
                        ColumnDef::new(InvoiceLineItem::LineTotal)
                            .double()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_invoice_line_item_invoice")
                            .from(InvoiceLineItem::Table, InvoiceLineItem::InvoiceId)
                            .to(Invoice::Table, Invoice::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_invoice_line_item_invoice")
                    .table(InvoiceLineItem::Table)
                    .col(InvoiceLineItem::InvoiceId)
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_index(Index::drop().name("idx_invoice_line_item_invoice").to_owned())
            .await?;

        manager
            .drop_table(Table::drop().table(InvoiceLineItem::Table).to_owned())
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .drop_column(Invoice::TotalAmount)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    Id,
    TotalAmount,
}

#[derive(DeriveIden)]
enum InvoiceLineItem {
    Table,
    Id,
    InvoiceId,
    Description,
    Quantity,
    UnitPrice,
    LineTotal,
}
