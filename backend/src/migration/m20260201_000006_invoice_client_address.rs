use sea_orm_migration::prelude::*;

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
                        ColumnDef::new(Invoice::ClientAddress)
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
                    .table(Invoice::Table)
                    .drop_column(Invoice::ClientAddress)
                    .to_owned(),
            )
            .await
    }
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    ClientAddress,
}
