import { IconSearch } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import type { AuditLog } from "src/api/backend";
import { LoadingPage } from "src/components";
import { useAuditLogs } from "src/hooks";
import { intl, T } from "src/locale";
import { showEventDetailsModal } from "src/modals";
import Table from "./Table";

export default function TableWrapper() {
	const [search, setSearch] = useState("");
	const { isFetching, isLoading, isError, error, data } = useAuditLogs(["user"]);

	useEffect(() => {
		// this can happen if someone deletes the last item while searching
		if (search !== "" && !data) {
			setSearch("");
		}
	});

	if (isLoading) {
		return <LoadingPage />;
	}

	if (isError) {
		return <Alert variant="danger">{error?.message || "Unknown error"}</Alert>;
	}

	let filtered: AuditLog[] | null = null;
	if (search && data) {
		filtered = data.filter((item) => {
			const metaText = JSON.stringify(item.meta || {}).toLowerCase();
			const value = [item.objectType, item.action, metaText].filter(Boolean).join(" ").toLowerCase();

			return value.includes(search);
		});
	}

	return (
		<section className="card resource-panel mt-4">
			<div className="card-status-top bg-purple" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-100 g-3 align-items-center">
						<div className="col-12 col-md">
							<h1 className="h2 mt-1 mb-0">
								<T id="auditlogs" />
							</h1>
						</div>
						{data?.length ? (
							<div className="col-12 col-md-auto">
								<div className="resource-toolbar d-flex flex-wrap btn-list justify-content-md-end">
									<div className="input-group input-group-flat w-auto">
										<span className="input-group-text input-group-text-sm">
											<IconSearch size={16} />
										</span>
										<input
											type="text"
											aria-label={intl.formatMessage({ id: "search" })}
											className="form-control form-control-sm"
											autoComplete="off"
											onChange={(e: any) => setSearch(e.target.value.toLowerCase().trim())}
										/>
									</div>
								</div>
							</div>
						) : null}
					</div>
				</div>
				<Table data={filtered ?? data ?? []} isFetching={isFetching} onSelectItem={showEventDetailsModal} />
			</div>
		</section>
	);
}
