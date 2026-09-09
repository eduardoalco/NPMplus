import { NavLink as RouterNavLink } from "react-router";

interface Props {
	children: React.ReactNode;
	to?: string;
	href?: string;
	isDropdownItem?: boolean;
	onClick?: () => void;
}

export function NavLink({ children, to, href, isDropdownItem, onClick }: Props) {
	const baseClass = isDropdownItem ? "dropdown-item" : "nav-link";

	if (href) {
		return (
			<a className={baseClass} href={href} target="_blank" rel="noopener noreferrer" onClick={onClick}>
				{children}
			</a>
		);
	}

	if (!to) return null;

	return (
		<RouterNavLink
			to={to}
			end={to === "/"}
			className={({ isActive }) => `${baseClass}${isActive ? " active" : ""}`}
			onClick={onClick}
		>
			{children}
		</RouterNavLink>
	);
}
