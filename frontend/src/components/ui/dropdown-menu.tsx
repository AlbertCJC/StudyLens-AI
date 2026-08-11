import React, { useState, useRef, useEffect, createContext, useContext } from "react";

interface DropdownMenuContextType {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  closeMenu: () => void;
}

const DropdownMenuContext = createContext<DropdownMenuContextType | undefined>(undefined);

export function DropdownMenu({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [open]);

  const closeMenu = () => setOpen(false);

  return (
    <DropdownMenuContext.Provider value={{ open, setOpen, closeMenu }}>
      <div ref={menuRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownMenuContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild = false,
  children,
  ...props
}: {
  asChild?: boolean;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuTrigger must be used within DropdownMenu");

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    context.setOpen((prev) => !prev);
  };

  if (asChild && React.isValidElement<{ onClick?: (e: React.MouseEvent) => void }>(children)) {
    const childProps = children.props;
    return React.cloneElement(children, {
      onClick: (e: React.MouseEvent) => {
        if (childProps.onClick) {
          childProps.onClick(e);
        }
        handleClick(e);
      },
      "aria-expanded": context.open,
    } as React.HTMLAttributes<HTMLElement>);
  }

  return (
    <button type="button" onClick={handleClick} aria-expanded={context.open} {...props}>
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = "end",
  className = "",
  children,
}: {
  align?: "start" | "end" | "center";
  className?: string;
  children: React.ReactNode;
}) {
  const context = useContext(DropdownMenuContext);
  if (!context) throw new Error("DropdownMenuContent must be used within DropdownMenu");

  if (!context.open) return null;

  const alignStyles =
    align === "end"
      ? "right-0"
      : align === "center"
      ? "left-1/2 -translate-x-1/2"
      : "left-0";

  return (
    <div
      className={`absolute top-full mt-2 z-50 rounded-lg border border-border bg-card p-1 text-card-foreground shadow-lg focus:outline-none animate-in fade-in-80 zoom-in-95 ${alignStyles} ${className}`.trim()}
    >
      {children}
    </div>
  );
}

export function DropdownMenuLabel({
  className = "",
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`px-2 py-1.5 text-xs font-semibold text-muted-foreground ${className}`.trim()}>
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({ className = "" }: { className?: string }) {
  return <div className={`-mx-1 my-1 h-px bg-border ${className}`.trim()} />;
}

export function DropdownMenuItem({
  className = "",
  onClick,
  children,
  ...props
}: {
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  children: React.ReactNode;
  [key: string]: unknown;
}) {
  const context = useContext(DropdownMenuContext);

  const handleClick = (e: React.MouseEvent) => {
    if (onClick) onClick(e);
    if (context) context.closeMenu();
  };

  return (
    <div
      role="menuitem"
      tabIndex={0}
      onClick={handleClick}
      className={`relative flex cursor-pointer select-none items-center rounded-md px-2 py-1.5 text-sm outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${className}`.trim()}
      {...props}
    >
      {children}
    </div>
  );
}
