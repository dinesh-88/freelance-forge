use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Income::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Income::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Income::UserId).uuid().not_null())
                    .col(ColumnDef::new(Income::Source).text().not_null())
                    .col(ColumnDef::new(Income::Description).text().not_null())
                    .col(ColumnDef::new(Income::Amount).double().not_null())
                    .col(ColumnDef::new(Income::Currency).text().not_null())
                    .col(ColumnDef::new(Income::Date).date().not_null())
                    .col(ColumnDef::new(Income::Category).text().null())
                    .col(
                        ColumnDef::new(Income::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_income_user")
                            .from(Income::Table, Income::UserId)
                            .to(User::Table, User::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Income::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Income {
    Table,
    Id,
    UserId,
    Source,
    Description,
    Amount,
    Currency,
    Date,
    Category,
    CreatedAt,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}
