import type { InventoryItem } from "@/types/medintel";

export function ConsumptionBars({ items }: { items: InventoryItem[] }) {
  const topItems = [...items].sort((left, right) => right.dailyConsumption - left.dailyConsumption).slice(0, 6);
  const max = Math.max(...topItems.map((item) => item.dailyConsumption), 1);

  return (
    <div className="space-y-4">
      {topItems.map((item) => (
        <div key={item.id} className="space-y-2">
          <div className="flex items-center justify-between gap-3 text-sm">
            <p className="font-medium text-slate-700">{item.name}</p>
            <p className="text-slate-500">{item.dailyConsumption}/{item.unit} per day</p>
          </div>
          <div className="h-3 rounded-full bg-sky-100">
            <div
              className="h-3 rounded-full bg-gradient-to-r from-sky-500 via-cyan-400 to-blue-300"
              style={{ width: `${(item.dailyConsumption / max) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

