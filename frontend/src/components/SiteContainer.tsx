interface Props {
	children: React.ReactNode;
}
export function SiteContainer({ children }: Props) {
	return (
		<main id="main-content" className="container-xl py-4 min-w-0 overflow-x-auto">
			{children}
		</main>
	);
}
