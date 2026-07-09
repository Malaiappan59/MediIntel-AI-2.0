from copy import deepcopy

from backend.database.mock_seed import create_seed_dataset


class MediIntelStore:
    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.dataset = create_seed_dataset()
        self.current_execution: dict | None = None

    def snapshot(self) -> dict:
        return deepcopy(self.dataset)


store = MediIntelStore()

