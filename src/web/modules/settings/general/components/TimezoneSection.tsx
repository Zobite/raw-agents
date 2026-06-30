import { MapPoint } from "@solar-icons/react";
import { useCallback, useEffect, useState } from "react";
import { apiClient } from "src/common/api";
import { SettingKey } from "src/common/enum";
import { Select, type SelectOption } from "src/components/ui/select";
import { toast } from "src/components/ui/toast";
import { saveSettings } from "src/modules/settings/common/settingsSlice";
import { useAppDispatch, useAppSelector } from "src/store/store";

// ─── Timezone Section ─────────────────────────────────────────────────────────
// Reusable timezone configuration used in the General settings tab.
// Uses Game-styled custom components only.

export function TimezoneSection() {
  const dispatch = useAppDispatch();

  // ── Store ────────────────────────────────────────────────────────────────────
  const storedTz = useAppSelector((s) => s.settings.data[SettingKey.Timezone] ?? "");

  // ── Local state ──────────────────────────────────────────────────────────────
  const [tzList, setTzList] = useState<{ tz: string; offset: string }[]>([]);
  const [loadingTz, setLoadingTz] = useState(true);

  // ── Load timezone list ───────────────────────────────────────────────────────
  useEffect(() => {
    apiClient
      .get<{ tz: string; offset: string }[]>("/api/settings/timezones")
      .then(setTzList)
      .catch(() => setTzList([]))
      .finally(() => setLoadingTz(false));
  }, []);

  // ── Computed ─────────────────────────────────────────────────────────────────
  const tzOptions: SelectOption[] = tzList.map(({ tz, offset }) => ({
    value: tz,
    label: `${tz} (${offset})`,
  }));

  const currentTz = storedTz || "UTC";

  // ── Handlers ─────────────────────────────────────────────────────────────────
  const handleTzChange = useCallback(
    async (value: string) => {
      try {
        await dispatch(saveSettings({ [SettingKey.Timezone]: value })).unwrap();
        toast.success("Timezone saved");
      } catch {
        toast.error("Failed to save timezone");
      }
    },
    [dispatch],
  );

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <MapPoint width={13} height={13} className="text-primary" />
        <span className="text-xs font-bold text-soft">Timezone</span>
      </div>

      <Select
        value={currentTz}
        onChange={handleTzChange}
        options={tzOptions}
        placeholder={loadingTz ? "Loading timezones…" : "Search timezone…"}
        disabled={loadingTz}
        searchable
        searchPlaceholder="Search timezone…"
      />
      <p className="text-xs text-muted mt-2 ml-3">Used for scheduled tasks &amp; time display in agent system prompts.</p>
    </div>
  );
}
