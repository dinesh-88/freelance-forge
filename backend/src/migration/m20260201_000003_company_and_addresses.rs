use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Company::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Company::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Company::Name).text().not_null())
                    .col(ColumnDef::new(Company::Address).text().not_null())
                    .col(
                        ColumnDef::new(Company::CreatedAt)
                            .timestamp_with_time_zone()
                            .not_null(),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(User::Table)
                    .add_column(ColumnDef::new(User::Address).text().null())
                    .add_column(ColumnDef::new(User::CompanyId).uuid().null())
                    .add_foreign_key(
                        &TableForeignKey::new()
                            .name("fk_user_company")
                            .from_tbl(User::Table)
                            .from_col(User::CompanyId)
                            .to_tbl(Company::Table)
                            .to_col(Company::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .add_column(ColumnDef::new(Invoice::UserAddress).text().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .drop_column(Invoice::UserAddress)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(User::Table)
                    .drop_foreign_key(Alias::new("fk_user_company"))
                    .drop_column(User::CompanyId)
                    .drop_column(User::Address)
                    .to_owned(),
            )
            .await?;

        manager
            .drop_table(Table::drop().table(Company::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Company {
    Table,
    Id,
    Name,
    Address,
    CreatedAt,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Address,
    CompanyId,
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    UserAddress,
}
