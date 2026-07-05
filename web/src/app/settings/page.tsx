import { EditorialContainer } from "@/components/app-shell";
import { AdvancedSettingsPanel } from "@/features/settings/advanced-settings-panel";

export default function SettingsPage() {
  return (
    <EditorialContainer className={"py-4 md:py-6"}>
      <AdvancedSettingsPanel />
    </EditorialContainer>
  );
}
