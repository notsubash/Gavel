import { EditorialContainer } from "@/components/app-shell";
import { AdvancedSettingsPanel } from "@/features/settings/advanced-settings-panel";

export default function SettingsPage() {
  return (
    <EditorialContainer className="py-12 md:py-16 lg:py-24">
      <div className="col-span-12 lg:col-span-8 lg:col-start-3">
        <AdvancedSettingsPanel />
      </div>
    </EditorialContainer>
  );
}
