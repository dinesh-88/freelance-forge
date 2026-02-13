use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Expense::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Expense::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Expense::UserId).uuid().not_null())
                    .col(ColumnDef::new(Expense::Vendor).text().not_null())
                    .col(ColumnDef::new(Expense::Description).text().not_null())
                    .col(ColumnDef::new(Expense::Amount).double().not_null())
                    .col(ColumnDef::new(Expense::Currency).text().not_null())
                    .col(ColumnDef::new(Expense::Date).date().not_null())
                    .col(ColumnDef::new(Expense::Category).text().null())
                    .col(ColumnDef::new(Expense::ReceiptUrl).text().null())
                    .col(
                        ColumnDef::new(Expense::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_expense_user")
                            .from(Expense::Table, Expense::UserId)
                            .to(User::Table, User::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Expense::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Expense {
    Table,
    Id,
    UserId,
    Vendor,
    Description,
    Amount,
    Currency,
    Date,
    Category,
    ReceiptUrl,
    CreatedAt,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}
