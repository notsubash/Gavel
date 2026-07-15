import { cn } from "@/lib/utils";

type GavelLogoProps = {
  className?: string;
  size?: number;
  /** Show the product name next to the mark (preferred in nav / chrome). */
  showName?: boolean;
};

export function GavelLogo({ className, size = 32, showName = false }: GavelLogoProps) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <img
        src="/logo-color.svg"
        alt={showName ? "" : "Gavel"}
        width={size}
        height={size}
        className="shrink-0"
        style={{ width: size, height: size }}
      />
      {showName ? (
        <span className="font-sans text-base font-semibold tracking-tight text-ink">
          Gavel
        </span>
      ) : null}
    </span>
  );
}
