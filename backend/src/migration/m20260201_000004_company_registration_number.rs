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
                    .add_column(
                        ColumnDef::new(Company::RegistrationNumber)
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
                    .table(Company::Table)
                    .drop_column(Company::RegistrationNumber)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Company {
    Table,
    RegistrationNumber,
}
