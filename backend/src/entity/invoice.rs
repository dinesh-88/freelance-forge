use sea_orm::entity::prelude::*;

#[derive(Clone, Debug, PartialEq, DeriveEntityModel)]
#[sea_orm(table_name = "invoice")]
pub struct Model {
    #[sea_orm(primary_key)]
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub company_id: Option<Uuid>,
    pub template_id: Option<Uuid>,
    pub client_name: String,
    pub client_address: String,
    pub description: String,
    pub amount: f64,
    pub currency: String,
    pub user_address: String,
    pub total_amount: f64,
    pub date: Date,
}

#[derive(Copy, Clone, Debug, EnumIter, DeriveRelation)]
pub enum Relation {}

impl ActiveModelBehavior for ActiveModel {}
