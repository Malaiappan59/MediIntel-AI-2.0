from sqlalchemy.orm import Session

from backend.services.erp_queries import list_inventory_items


class InventoryService:
    def list_inventory(self, db: Session) -> list[dict]:
        return list_inventory_items(db)


inventory_service = InventoryService()
