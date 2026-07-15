import Image from "next/image";

import { cn } from "@/lib/utils";

type GavelLogoProps = {
  className?: string;
  size?: number;
};

export function GavelLogo({ className, size = 32 }: GavelLogoProps) {
  return (
    <Image
      src="/logo-gavel.webp"
      alt="Gavel"
      width={size}
      height={size}
      className={cn("shrink-0", className)}
      priority
    />
  );
}
