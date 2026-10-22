import * as React from "react";

import { Button, type ButtonProps } from "@/components/ui/button";
import { ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Pill CTA with a sliding arrow disc.
 *
 * Rest state: label sits at the start, arrow disc parked at the right edge.
 * Hover: paddings swap, the disc slides across to the left and rotates 45°,
 * turning the arrow to point up-left-to-right… (ArrowUpRight rotated once).
 *
 * Colors are pinned to the hero palette per owner spec:
 * - button  #14532d (deep Hayaan green)
 * - disc    #faf8f1 (hero cream) with a green arrow for contrast
 *
 * The animation lives entirely in utility classes, so overriding via
 * `className` (e.g. a different disc color) works without touching this file.
 */
interface ButtonWithIconProps extends ButtonProps {
  children: React.ReactNode;
}

const ButtonWithIcon = React.forwardRef<HTMLButtonElement, ButtonWithIconProps>(
  ({ children, className, type = "button", ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type={type}
        className={cn(
          "relative h-12 w-fit cursor-pointer overflow-hidden rounded-full p-1 ps-6 pe-14",
          "bg-[#14532d] text-[#faf8f1] hover:bg-[#14532d]",
          "text-sm font-medium transition-all duration-500",
          "group hover:ps-14 hover:pe-6",
          className,
        )}
        {...props}
      >
        <span className="relative z-10 transition-all duration-500">{children}</span>
        <div
          aria-hidden
          className="absolute right-1 flex h-10 w-10 items-center justify-center rounded-full bg-[#faf8f1] text-[#14532d] transition-all duration-500 group-hover:right-[calc(100%-44px)] group-hover:rotate-45"
        >
          <ArrowUpRight size={16} />
        </div>
      </Button>
    );
  },
);
ButtonWithIcon.displayName = "ButtonWithIcon";

export { ButtonWithIcon };
export default ButtonWithIcon;
