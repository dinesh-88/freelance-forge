use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Budget::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Budget::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Budget::UserId).uuid().not_null())
                    .col(ColumnDef::new(Budget::Category).text().not_null())
                    .col(ColumnDef::new(Budget::MonthlyLimit).double().not_null())
                    .col(ColumnDef::new(Budget::Currency).text().not_null())
                    .col(
                        ColumnDef::new(Budget::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .foreign_key(
                        ForeignKey::create()
                            .name("fk_budget_user")
                            .from(Budget::Table, Budget::UserId)
                            .to(User::Table, User::Id)
                            .on_delete(ForeignKeyAction::Cascade),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .create_index(
                Index::create()
                    .name("idx_budget_user_category")
                    .table(Budget::Table)
                    .col(Budget::UserId)
                    .col(Budget::Category)
                    .unique()
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Budget::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Budget {
    Table,
    Id,
    UserId,
    Category,
    MonthlyLimit,
    Currency,
    CreatedAt,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}
