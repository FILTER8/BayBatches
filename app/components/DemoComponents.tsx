import React from "react";

export const Button: React.FC<{
  variant?: "primary" | "ghost";
  size?: "sm" | "md";
  onClick?: () => void;
  className?: string;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}> = ({ variant = "primary", size = "md", onClick, className, icon, children }) => {
  const baseStyles = "inline-flex items-center justify-center rounded";
  const variantStyles =
    variant === "primary"
      ? "bg-[#0052FF] text-[#ffffff]"
      : "bg-transparent text-[#ffffff]";
  const sizeStyles = size === "sm" ? "px-2 py-1 text-xs" : "px-4 py-2 text-sm";

  return (
    <button
      onClick={onClick}
      className={`${baseStyles} ${variantStyles} ${sizeStyles} ${className}`}
    >
      {icon && (
        <span className="inline-flex items-center mr-2 text-[#ffffff]">
          {icon}
        </span>
      )}
      {children}
    </button>
  );
};

// Placeholder Home component (empty)
export const Home: React.FC = () => {
  return <div className="text-center"></div>;
};

// Placeholder Features component
export const Features: React.FC = () => {
  return (
    <div className="text-center">
      <h2 className="text-lg">Features</h2>
      <p className="mt-2 text-gray-500">
        Discover the amazing features of BayBatches. (Placeholder)
      </p>
    </div>
  );
};