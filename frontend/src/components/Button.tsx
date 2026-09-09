import cn from "clsx";
import type { ButtonHTMLAttributes, ReactNode } from "react";

interface Props extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "color"> {
	children: ReactNode;
	actionType?: "primary" | "secondary" | "success" | "warning" | "danger" | "info" | "light" | "dark";
	variant?: "ghost" | "outline" | "pill" | "square" | "action";
	size?: "sm" | "md" | "lg" | "xl";
	fullWidth?: boolean;
	isLoading?: boolean;
	color?:
		| "blue"
		| "azure"
		| "indigo"
		| "purple"
		| "pink"
		| "red"
		| "orange"
		| "yellow"
		| "lime"
		| "green"
		| "teal"
		| "cyan";
}
function Button({
	children,
	className,
	type = "button",
	actionType,
	variant,
	size,
	color,
	fullWidth,
	isLoading,
	disabled,
	...buttonProps
}: Props) {
	const cns = cn(
		"btn",
		className,
		actionType && `btn-${actionType}`,
		variant && `btn-${variant}`,
		size && `btn-${size}`,
		color && `btn-${color}`,
		fullWidth && "w-100",
		isLoading && "btn-loading",
	);

	return (
		<button
			{...buttonProps}
			type={type}
			className={cns}
			disabled={disabled || isLoading}
			aria-busy={isLoading || undefined}
		>
			{children}
		</button>
	);
}

export { Button };
