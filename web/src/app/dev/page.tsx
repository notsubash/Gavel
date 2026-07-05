import { EditorialContainer } from "@/components/app-shell";

import { DevGallery } from "./dev-gallery";

export const metadata = {
  title: "Dev gallery — Component states",
};

export default function DevGalleryPage() {
  return (
    <EditorialContainer className="py-12 md:py-16">
      <DevGallery />
    </EditorialContainer>
  );
}
