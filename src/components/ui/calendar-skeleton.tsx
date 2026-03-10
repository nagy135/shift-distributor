import { cn } from "@/lib/utils";

type CalendarSkeletonProps = {
  size?: "default" | "sm";
  className?: string;
  bodyClassName?: string;
  dayClassName?: string;
  monthLabelClassName?: string;
};

export function CalendarSkeleton({
  size = "default",
  className,
  bodyClassName,
  dayClassName,
  monthLabelClassName,
}: CalendarSkeletonProps) {
  const isSmall = size === "sm";

  return (
    <div
      className={cn(
        "w-full animate-pulse",
        isSmall ? "p-2 w-[300px]" : "p-3",
        className,
      )}
    >
      <div
        className={cn(
          "rounded-md bg-muted",
          isSmall ? "mb-2 ml-5 h-4 w-7" : "mb-4 ml-12 h-7 w-28",
          monthLabelClassName,
        )}
      />
      <div
        className={cn(
          "grid grid-cols-7",
          isSmall ? "mb-2 gap-px" : "mb-3 gap-1",
        )}
      >
        {Array.from({ length: 7 }).map((_, index) => (
          <div
            key={`weekday-${index}`}
            className={cn(
              "mx-auto rounded bg-muted/80",
              isSmall ? "h-2 w-4" : "h-3 w-6",
            )}
          />
        ))}
      </div>
      <div
        className={cn(
          "grid grid-cols-7",
          isSmall ? "min-h-[5.5rem] gap-px" : "min-h-[15rem] gap-1",
          bodyClassName,
        )}
      >
        {Array.from({ length: 42 }).map((_, index) => (
          <div
            key={`day-${index}`}
            className={cn(
              "aspect-square bg-muted/80",
              isSmall ? "rounded-[2px]" : "rounded-md",
              dayClassName,
            )}
          />
        ))}
      </div>
    </div>
  );
}
