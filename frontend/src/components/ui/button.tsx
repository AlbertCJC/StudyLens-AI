import React from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "primary" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  size?: "default" | "sm" | "lg" | "icon";
  children?: React.ReactNode;
}

const variants = {
  // primary = the single 10% focus action per view
  primary: "bg-cta-gradient text-white shadow-sm hover:brightness-110 active:brightness-95",
  default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm",
  secondary: "bg-structure text-structure-foreground hover:bg-structure-strong",
  outline: "border border-structure-strong bg-card text-structure-foreground hover:bg-structure",
  ghost: "text-muted-foreground hover:bg-structure hover:text-structure-foreground",
  destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm",
  link: "text-primary underline-offset-4 hover:underline",
};

const sizes = {
  default: "h-11 px-5 text-sm",
  sm: "h-9 px-3 text-sm",
  lg: "h-12 px-7 text-base",
  icon: "h-11 w-11 p-0",
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className = "", variant = "default", size = "default", children, ...props }, ref) => (
    <button
      ref={ref}
      className={`inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 select-none cursor-pointer ${variants[variant]} ${sizes[size]} ${className}`.trim()}
      {...props}
    >
      {children}
    </button>
  )
);

Button.displayName = "Button";
