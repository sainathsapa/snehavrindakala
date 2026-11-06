"use client";

import { useState } from "react";
import { Button } from "@snehavrinda-kala/ui";

interface BulkActionsToolbarProps {
  selectedIds: string[];
  type: "orders" | "products" | "partners";
  onSelectionChange: (ids: string[]) => void;
  canWrite: boolean;
}

export function BulkActionsToolbar({
  selectedIds,
  type,
  onSelectionChange,
  canWrite,
}: BulkActionsToolbarProps) {
  const [bulkAction, setBulkAction] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [exportType, setExportType] = useState(type);

  const hasSelection = selectedIds.length > 0;

  const handleBulkAction = async (action: string, data: any = {}) => {
    if (!hasSelection || !canWrite) return;
    setOpen(false);
    try {
      const res = await fetch(
        `/api/admin/bulk?type=${type}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ids: selectedIds, action, data }),
        }
      );
      if (res.ok) {
        const result = await res.json();
        alert(
          `Bulk action complete: ${result.succeeded}/${result.total} succeeded`
        );
        onSelectionChange([]);
      } else {
        alert("Bulk action failed");
      }
    } catch {
      alert("Error performing bulk action");
    }
  };

  const handleExport = async () => {
    try {
      const res = await fetch(
        `/api/admin/export?type=${exportType}`,
        { method: "GET" }
      );
      if (res.ok) {
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${exportType}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch {
      alert("Export failed");
    }
  };

  if (!canWrite && selectedIds.length === 0) return null;

  return (
    <div className="flex items-center justify-between mb-6">
      {hasSelection && canWrite ? (
        <div className="flex items-center gap-3">
          <span className="text-xs font-sans text-muted-ink">
            {selectedIds.length} selected
          </span>
          <div className="flex gap-2">
            {type === "orders" && (
              <>
                <button
                  onClick={() => {
                    setBulkAction("update_status");
                    setOpen(true);
                  }}
                  className="px-3 py-2 text-sm font-medium text-sindoor border border-sindoor rounded-md hover:bg-sindoor/10 transition-colors"
                >
                  Change Status
                </button>
                {bulkAction === "update_status" && (
                  <div className="absolute z-50 mt-2 w-48 bg-surface border border-sand-border rounded-lg shadow-lg p-3">
                    <div className="space-y-2">
                      {["pending", "processing", "completed", "cancelled"].map(
                        (status) => (
                          <button
                            key={status}
                            onClick={() => {
                              handleBulkAction("update_status", { status });
                              setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-deep-ink hover:bg-rang-paper/50 transition-colors"
                          >
                            {status}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
            {type === "products" && (
              <>
                <button
                  onClick={() => {
                    setBulkAction("update_status");
                    setOpen(true);
                  }}
                  className="px-3 py-2 text-sm font-medium text-sindoor border border-sindoor rounded-md hover:bg-sindoor/10 transition-colors"
                >
                  Change Status
                </button>
                {bulkAction === "update_status" && (
                  <div className="absolute z-50 mt-2 w-48 bg-surface border border-sand-border rounded-lg shadow-lg p-3">
                    <div className="space-y-2">
                      {["draft", "published", "archived"].map(
                        (status) => (
                          <button
                            key={status}
                            onClick={() => {
                              handleBulkAction("update_status", { status });
                              setOpen(false);
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-deep-ink hover:bg-rang-paper/50 transition-colors"
                          >
                            {status}
                          </button>
                        )
                      )}
                    </div>
                  </div>
                )}
                <button
                  onClick={() => {
                    if (
                      confirm(
                        `Delete ${selectedIds.length} products? This cannot be undone.`
                      )
                    ) {
                      handleBulkAction("delete");
                    }
                  }}
                  className="px-3 py-2 text-sm font-medium text-sindoor border border-sindoor rounded-md hover:bg-sindoor/10 transition-colors"
                >
                  Delete
                </button>
              </>
            )}
            {type === "partners" && (
              <>
                <button
                  onClick={() => {
                    setBulkAction("update_status");
                    setOpen(true);
                  }}
                  className="px-3 py-2 text-sm font-medium text-sindoor border border-sindoor rounded-md hover:bg-sindoor/10 transition-colors"
                >
                  Change Status
                </button>
                {bulkAction === "update_status" && (
                  <div className="absolute z-50 mt-2 w-48 bg-surface border border-sand-border rounded-lg shadow-lg p-3">
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          handleBulkAction("update_status", { enabled: true });
                          setOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-deep-ink hover:bg-rang-paper/50 transition-colors"
                      >
                        Enable
                      </button>
                      <button
                        onClick={() => {
                          handleBulkAction("update_status", { enabled: false });
                          setOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm text-deep-ink hover:bg-rang-paper/50 transition-colors"
                      >
                        Disable
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      ) : null}

      <div className="flex items-center gap-2">
        <select
          value={exportType}
          onChange={(e) => setExportType(e.target.value as any)}
          className="px-3 py-2 rounded-md border border-sand-border bg-surface text-sm font-sans"
        >
          <option value="orders">Export Orders</option>
          <option value="products">Export Products</option>
          <option value="customers">Export Customers</option>
        </select>
        <Button
          onClick={handleExport}
          variant="text"
          size="sm"
        >
          📥 CSV
        </Button>
      </div>
    </div>
  );
}
