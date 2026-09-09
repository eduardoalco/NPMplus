import {
	IconBook,
	IconChartBar,
	IconDeviceDesktop,
	IconExternalLink,
	IconHome,
	IconSettings,
	IconShield,
	IconUser,
} from "@tabler/icons-react";
import cn from "clsx";
import React from "react";
import { useLocation } from "react-router";
import { HasPermission, NavLink } from "src/components";
import { useUser } from "src/hooks";
import { T } from "src/locale";
import {
	ACCESS_LISTS,
	ADMIN,
	CERTIFICATES,
	DEAD_HOSTS,
	hasPermission,
	type MANAGE,
	PROXY_HOSTS,
	REDIRECTION_HOSTS,
	type Section,
	STREAMS,
	VIEW,
} from "src/modules/Permissions";

interface MenuItem {
	label: string;
	icon?: React.ElementType;
	to?: string;
	href?: string;
	items?: MenuItem[];
	permissionSection?: Section | typeof ADMIN;
	permission?: typeof VIEW | typeof MANAGE;
}

const menuItems: MenuItem[] = [
	{
		to: "/",
		icon: IconHome,
		label: "dashboard",
	},
	{
		icon: IconDeviceDesktop,
		label: "navigation.routing",
		items: [
			{
				to: "/nginx/proxy",
				label: "proxy-hosts",
				permissionSection: PROXY_HOSTS,
				permission: VIEW,
			},
			{
				to: "/nginx/redirection",
				label: "redirection-hosts",
				permissionSection: REDIRECTION_HOSTS,
				permission: VIEW,
			},
			{
				to: "/nginx/stream",
				label: "streams",
				permissionSection: STREAMS,
				permission: VIEW,
			},
			{
				to: "/nginx/404",
				label: "dead-hosts",
				permissionSection: DEAD_HOSTS,
				permission: VIEW,
			},
		],
	},
	{
		icon: IconShield,
		label: "navigation.security",
		items: [
			{
				to: "/access",
				label: "access-lists",
				permissionSection: ACCESS_LISTS,
				permission: VIEW,
			},
			{
				to: "/certificates",
				label: "certificates",
				permissionSection: CERTIFICATES,
				permission: VIEW,
			},
		],
	},
	{
		icon: IconSettings,
		label: "navigation.administration",
		permissionSection: ADMIN,
		items: [
			{ to: "/users", icon: IconUser, label: "users", permissionSection: ADMIN },
			{ to: "/audit-log", icon: IconBook, label: "auditlogs", permissionSection: ADMIN },
			{ to: "/settings", icon: IconSettings, label: "settings", permissionSection: ADMIN },
		],
	},
];

const getMenuItem = (item: MenuItem, pathname: string, onClick?: () => void) => {
	if (item.items && item.items.length > 0) {
		return getMenuDropown(item, pathname, onClick);
	}

	return (
		<HasPermission
			key={`item-${item.label}`}
			section={item.permissionSection}
			permission={item.permission || VIEW}
			hideError
		>
			<li className="nav-item">
				<NavLink to={item.to} href={item.href} onClick={onClick}>
					<span className="nav-link-icon d-md-none d-lg-inline-block">
						{item.icon && React.createElement(item.icon, { height: 24, width: 24 })}
					</span>
					<span className="nav-link-title d-flex align-items-center gap-1">
						{item.href ? item.label : <T id={item.label} />}
						{item.href && <IconExternalLink height={16} width={16} />}
					</span>
				</NavLink>
			</li>
		</HasPermission>
	);
};

const getMenuDropown = (item: MenuItem, pathname: string, onClick?: () => void) => {
	const isActive = item.items?.some((subitem) => subitem.to && pathname.startsWith(subitem.to));
	const cns = cn("nav-item", "dropdown", isActive && "active");
	return (
		<HasPermission
			key={`item-${item.label}`}
			section={item.permissionSection}
			permission={item.permission || VIEW}
			hideError
		>
			<li className={cns}>
				<button
					type="button"
					className={cn("nav-link", "dropdown-toggle", isActive && "active")}
					data-bs-toggle="dropdown"
					aria-expanded="false"
				>
					<span className="nav-link-icon d-md-none d-lg-inline-block">
						{item.icon && React.createElement(item.icon, { height: 24, width: 24 })}
					</span>
					<span className="nav-link-title">
						<T id={item.label} />
					</span>
				</button>
				<div className="dropdown-menu">
					{item.items?.map((subitem, idx) => (
						<HasPermission
							key={`${idx}-${subitem.to}`}
							section={subitem.permissionSection}
							permission={subitem.permission || VIEW}
							hideError
						>
							<NavLink to={subitem.to} isDropdownItem onClick={onClick}>
								<T id={subitem.label} />
							</NavLink>
						</HasPermission>
					))}
				</div>
			</li>
		</HasPermission>
	);
};

export function SiteMenu() {
	const { data: user } = useUser("me");
	const { pathname } = useLocation();
	const canAccess = (item: MenuItem) =>
		!item.permissionSection ||
		hasPermission(item.permissionSection, item.permission || VIEW, user?.permissions, user?.roles);
	const visibleMenuItems = menuItems
		.filter(canAccess)
		.map((item) => (item.items ? { ...item, items: item.items.filter(canAccess) } : item))
		.filter((item) => !item.items || item.items.length > 0);

	const closeMenu = () =>
		setTimeout(() => {
			const navbarToggler = document.querySelector<HTMLElement>(".navbar-toggler");
			const navbarMenu = document.querySelector("#navbar-menu");
			if (navbarToggler && navbarMenu?.classList.contains("show")) {
				navbarToggler.click();
			}
		}, 300);

	return (
		<nav className="navbar-expand-md" aria-label="Primary navigation">
			<div className="collapse navbar-collapse" id="navbar-menu">
				<div className="navbar">
					<div className="container-xl">
						<div className="row flex-column flex-md-row flex-fill align-items-center">
							<div className="col">
								<ul className="navbar-nav">
									{[
										...visibleMenuItems,
										...(user?.goaccess
											? ([
													{
														href: "/goaccess",
														icon: IconChartBar,
														label: "GoAccess",
														permissionSection: ADMIN,
													},
												] as MenuItem[])
											: []),
									].map((item) => getMenuItem(item, pathname, closeMenu))}
								</ul>
							</div>
						</div>
					</div>
				</div>
			</div>
		</nav>
	);
}
