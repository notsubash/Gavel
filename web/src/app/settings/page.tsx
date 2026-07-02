import { EditorialContainer } from "@/components/app-shell";
import { AdvancedSettingsPanel } from "@/features/settings/advanced-settings-panel";
import { isUiShellV2Enabled } from "@/lib/feature-flags";

export default function SettingsPage() {
  return (
    <EditorialContainer className={isUiShellV2Enabled() ? "py-4 md:py-6" : "py-12 md:py-16 lg:py-24"}>
      <AdvancedSettingsPanel />
    </EditorialContainer>
  );
}
