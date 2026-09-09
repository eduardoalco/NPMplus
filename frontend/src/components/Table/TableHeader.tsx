import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";
import { flexRender, type RowData, type TableFeatures } from "@tanstack/react-table";
import type { MouseEventHandler } from "react";
import type { TableLayoutProps } from "src/components";

interface ColumnMeta {
	className?: string;
}

interface SortableColumn {
	getCanSort: () => boolean;
	getIsSorted: () => false | "asc" | "desc";
	getToggleSortingHandler: () => MouseEventHandler<HTMLButtonElement>;
}

function TableHeader<TFeatures extends TableFeatures, T extends RowData>(props: TableLayoutProps<TFeatures, T>) {
	const { tableInstance } = props;
	const headerGroups = tableInstance.getHeaderGroups();

	return (
		<thead>
			{headerGroups.map((headerGroup) => (
				<tr key={headerGroup.id}>
					{headerGroup.headers.map((header) => {
						const { column } = header;
						const sortableColumn = column as typeof column & SortableColumn;
						const { className } = (column.columnDef.meta as ColumnMeta | undefined) ?? {};
						const canSort = sortableColumn.getCanSort();
						const sorted = sortableColumn.getIsSorted();
						const content = header.isPlaceholder
							? null
							: flexRender(column.columnDef.header, header.getContext());
						const sortIcon =
							sorted === "asc" ? (
								<IconChevronUp size={14} aria-hidden="true" />
							) : sorted === "desc" ? (
								<IconChevronDown size={14} aria-hidden="true" />
							) : null;

						return (
							<th
								key={header.id}
								className={className}
								scope="col"
								colSpan={header.colSpan}
								aria-sort={
									sorted === "asc"
										? "ascending"
										: sorted === "desc"
											? "descending"
											: canSort
												? "none"
												: undefined
								}
							>
								{canSort ? (
									<button
										type="button"
										className="border-0 bg-transparent p-0 text-reset"
										onClick={sortableColumn.getToggleSortingHandler()}
									>
										<span className="d-inline-flex align-items-center gap-1">
											{content}
											{sortIcon}
										</span>
									</button>
								) : (
									content
								)}
							</th>
						);
					})}
				</tr>
			))}
		</thead>
	);
}

export { TableHeader };
