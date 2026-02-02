use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .alter_table(
                Table::alter()
                    .table(Company::Table)
                    .add_column(ColumnDef::new(Company::UserId).uuid().null())
                    .add_foreign_key(
                        &TableForeignKey::new()
                            .name("fk_company_user")
                            .from_tbl(Company::Table)
                            .from_col(Company::UserId)
                            .to_tbl(User::Table)
                            .to_col(User::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Invoice::Table)
                    .add_column(ColumnDef::new(Invoice::UserId).uuid().null())
                    .add_column(ColumnDef::new(Invoice::CompanyId).uuid().null())
                    .add_foreign_key(
                        &TableForeignKey::new()
                            .name("fk_invoice_user")
                            .from_tbl(Invoice::Table)
                            .from_col(Invoice::UserId)
                            .to_tbl(User::Table)
                            .to_col(User::Id)
                            .on_delete(ForeignKeyAction::SetNull),
                    )
                    .add_foreign_key(
                        &TableForeignKey::new()
                            .name("fk_invoice_company")
                            .from_tbl(Invoice::Table)
                            .from_col(Invoice::CompanyId)
                            .to_tbl(Company::Table)
                            .to_col(Company::Id)
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
                    .drop_foreign_key(Alias::new("fk_invoice_company"))
                    .drop_foreign_key(Alias::new("fk_invoice_user"))
                    .drop_column(Invoice::CompanyId)
                    .drop_column(Invoice::UserId)
                    .to_owned(),
            )
            .await?;

        manager
            .alter_table(
                Table::alter()
                    .table(Company::Table)
                    .drop_foreign_key(Alias::new("fk_company_user"))
                    .drop_column(Company::UserId)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Company {
    Table,
    UserId,
    Id,
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    UserId,
    CompanyId,
}

#[derive(DeriveIden)]
enum User {
    Table,
    Id,
}
