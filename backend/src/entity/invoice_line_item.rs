use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "invoice_line_item")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub invoice_id: Uuid,
    pub description: String,
    pub quantity: f64,
    pub unit_price: f64,
    pub line_total: f64,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
