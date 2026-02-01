use sea_orm_migration::prelude::*;

#[derive(DeriveMigrationName)]
pub struct Migration;

#[async_trait::async_trait]
impl MigrationTrait for Migration {
    async fn up(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .create_table(
                Table::create()
                    .table(Invoice::Table)
                    .if_not_exists()
                    .col(
                        ColumnDef::new(Invoice::Id)
                            .uuid()
                            .not_null()
                            .primary_key(),
                    )
                    .col(ColumnDef::new(Invoice::ClientName).text().not_null())
                    .col(ColumnDef::new(Invoice::Description).text().not_null())
                    .col(ColumnDef::new(Invoice::Amount).double().not_null())
                    .col(ColumnDef::new(Invoice::Currency).text().not_null())
                    .col(ColumnDef::new(Invoice::Date).date().not_null())
                    .to_owned(),
            )
            .await
    }

    async fn down(&self, manager: &SchemaManager) -> Result<(), DbErr> {
        manager
            .drop_table(Table::drop().table(Invoice::Table).to_owned())
            .await
    }
}

#[derive(DeriveIden)]
enum Invoice {
    Table,
    Id,
    ClientName,
    Description,
    Amount,
    Currency,
    Date,
}
