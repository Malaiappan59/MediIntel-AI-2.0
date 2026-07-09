ROLE_PERMISSIONS: dict[str, list[str]] = {
    "Admin": [
        "inventory.read",
        "forecast.read",
        "recommendation.generate",
        "approval.approve",
        "approval.reject",
        "purchase_order.generate",
        "knowledge.upload",
        "knowledge.delete",
        "audit.read",
        "settings.manage",
        "api.manage",
    ],
    "Inventory Manager": [
        "inventory.read",
        "forecast.read",
        "recommendation.generate",
        "knowledge.upload",
    ],
    "Procurement Manager": [
        "inventory.read",
        "forecast.read",
        "recommendation.generate",
        "approval.approve",
        "approval.reject",
        "purchase_order.generate",
        "audit.read",
    ],
    "Pharmacist": [
        "inventory.read",
        "forecast.read",
        "recommendation.generate",
    ],
    "Auditor": [
        "inventory.read",
        "forecast.read",
        "audit.read",
    ],
    "Viewer": [
        "inventory.read",
        "forecast.read",
    ],
}


def all_permission_codes() -> list[str]:
    codes = {code for permissions in ROLE_PERMISSIONS.values() for code in permissions}
    return sorted(codes)
