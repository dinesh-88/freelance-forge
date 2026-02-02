use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(InvoiceTemplate::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(InvoiceTemplate::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(InvoiceTemplate::UserId).uuid().not_null())
                    .col(ColumnDef::new(InvoiceTemplate::Name).text().not_null())
                    .col(ColumnDef::new(InvoiceTemplate::Note).text().not_null())
                    .col(
                        ColumnDef::new(InvoiceTemplate::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_invoice_template_user")
                            .from(InvoiceTemplate::Table, InvoiceTemplate::UserId)
                            .to(User::Table, User::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .add_column(ColumnDef::new(Invoice::TemplateId).uuid().null())
                    .add_foreign_key(
                        &TableForeignKey::new()
                            .name("fk_invoice_template")
                            .from_tbl(Invoice::Table)
                            .from_col(Invoice::TemplateId)
                            .to_tbl(InvoiceTemplate::Table)
                            .to_col(InvoiceTemplate::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .drop_foreign_key(Alias::new("fk_invoice_template"))
                    .drop_column(Invoice::TemplateId)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(InvoiceTemplate::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum InvoiceTemplate {
    Table,
    Id,
    UserId,
    Name,
    Note,
    CreatedAt,
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    TemplateId,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}
