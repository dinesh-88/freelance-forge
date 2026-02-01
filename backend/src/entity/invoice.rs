use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "invoice")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub client_name: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub date: Date,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
