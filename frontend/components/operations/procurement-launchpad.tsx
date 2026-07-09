"use client";

import { PackageCheck, ShieldAlert, Sparkles, Truck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/experience";
import type { InventoryItem, Supplier } from "@/types/medintel";

type ProcurementLaunchpadProps = {
  inventoryOptions: InventoryItem[];
  quickPicks: InventoryItem[];
  selectedItem: InventoryItem | null;
  selectedSupplier: Supplier | null;
  quantity: number;
  recommendedQuantity: number;
  estimatedCost: number;
  isSubmitting: boolean;
  onMedicineChange: (medicineId: string) => void;
  onQuantityChange: (quantity: number) => void;
  onUseRecommended: () => void;
  onQuickSelect: (medicineId: string) => void;
  onSubmit: () => void;
};

function getInventoryTone(status: InventoryItem["status"]) {
  if (status === "critical") {
    return "rose" as const;
  }

  if (status === "watch") {
    return "amber" as const;
  }

  return "emerald" as const;
}

export function ProcurementLaunchpad({
  inventoryOptions,
  quickPicks,
  selectedItem,
  selectedSupplier,
  quantity,
  recommendedQuantity,
  estimatedCost,
  isSubmitting,
  onMedicineChange,
  onQuantityChange,
  onUseRecommended,
  onQuickSelect,
  onSubmit,
}: ProcurementLaunchpadProps) {
  return (
    <Card className="border border-sky-100">
      <CardHeader className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <CardTitle>Procurement Launchpad</CardTitle>
            <CardDescription>
              Build a purchase request from the live medicine watchlist, validate supplier readiness, and route the order into approvals without leaving the operations console.
            </CardDescription>
          </div>
          <div className="surface-azure flex items-center gap-3 rounded-[1.5rem] px-4 py-3 text-sm text-slate-700">
            <Sparkles className="h-4 w-4 text-sky-700" />
            MediIntel will attach approval and audit trace records automatically.
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {quickPicks.map((item) => (
            <Button key={item.id} type="button" size="sm" variant={selectedItem?.id === item.id ? "default" : "outline"} onClick={() => onQuickSelect(item.id)}>
              {item.name}
            </Button>
          ))}
        </div>
      </CardHeader>

      <CardContent className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="space-y-2">
              <Label htmlFor="procurement-medicine">Medicine</Label>
              <Select value={selectedItem?.id ?? undefined} onValueChange={onMedicineChange}>
                <SelectTrigger id="procurement-medicine">
                  <SelectValue placeholder="Select a medicine from the live inventory watchlist" />
                </SelectTrigger>
                <SelectContent>
                  {inventoryOptions.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="procurement-quantity">Quantity</Label>
              <Input
                id="procurement-quantity"
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(quantity) ? quantity : ""}
                onChange={(event) => onQuantityChange(Number(event.target.value))}
              />
            </div>
          </div>

          <div className="surface-subtle space-y-4 p-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-950">Recommended replenishment</p>
                <p className="mt-1 text-sm text-slate-600">
                  Recommended quantity is based on current stock, reorder level, and projected 10-day consumption.
                </p>
              </div>
              <Button type="button" variant="outline" size="sm" onClick={onUseRecommended} disabled={!selectedItem}>
                Use {recommendedQuantity} units
              </Button>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="surface-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Current Stock</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{selectedItem?.stockOnHand ?? "--"} units</p>
              </div>
              <div className="surface-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Minimum Stock</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{selectedItem?.reorderLevel ?? "--"} units</p>
              </div>
              <div className="surface-card p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Projected Spend</p>
                <p className="mt-2 text-sm font-semibold text-slate-950">{selectedItem ? formatCurrency(estimatedCost) : "--"}</p>
              </div>
            </div>
          </div>

          <Button className="w-full sm:w-auto" type="button" disabled={!selectedItem || quantity < 1 || isSubmitting} onClick={onSubmit}>
            <PackageCheck className="mr-2 h-4 w-4" />
            {isSubmitting ? "Generating Purchase Request..." : "Generate Purchase Request"}
          </Button>
        </div>

        <div className="space-y-4">
          <div className="surface-subtle space-y-4 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-950">{selectedItem?.name ?? "Select a medicine"}</p>
                <p className="mt-1 text-sm text-slate-600">
                  {selectedSupplier ? `${selectedSupplier.name} will be used for the next replenishment route.` : "Supplier posture will appear after selecting a medicine."}
                </p>
              </div>
              {selectedItem ? <Badge tone={getInventoryTone(selectedItem.status)}>{selectedItem.status}</Badge> : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="surface-card p-4">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="h-4 w-4 text-amber-600" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Shortage Risk</p>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{selectedItem?.shortageRisk ?? "--"}%</p>
                <p className="mt-1 text-sm text-slate-500">{selectedItem ? `${selectedItem.daysRemaining} days of runway remaining.` : "Runway will update from inventory telemetry."}</p>
              </div>
              <div className="surface-card p-4">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-sky-700" />
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Supplier ETA</p>
                </div>
                <p className="mt-3 text-sm font-semibold text-slate-950">{selectedSupplier ? `${selectedSupplier.leadTimeDays} days` : "--"}</p>
                <p className="mt-1 text-sm text-slate-500">
                  {selectedSupplier ? `${selectedSupplier.onTimeRate}% on-time with ${selectedSupplier.fulfillmentRate}% fulfillment.` : "Delivery reliability will appear here."}
                </p>
              </div>
            </div>

            <div className="surface-card space-y-3 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Request preview</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Supplier</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedSupplier?.name ?? "--"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Contact</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedSupplier?.contact ?? "--"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Quantity</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedItem ? `${quantity} units` : "--"}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.16em] text-slate-400">Estimated Cost</p>
                  <p className="mt-2 text-sm font-semibold text-slate-950">{selectedItem ? formatCurrency(estimatedCost) : "--"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
