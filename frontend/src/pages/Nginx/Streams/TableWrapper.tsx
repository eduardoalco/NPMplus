import { IconHelp, IconSearch } from "@tabler/icons-react";
import { useQueryClient } from "@tanstack/react-query";
import type { SortingState } from "@tanstack/react-table";
import { useEffect, useState } from "react";
import Alert from "react-bootstrap/Alert";
import { deleteStream, type Stream, toggleStream } from "src/api/backend";
import { Button, HasPermission, LoadingPage } from "src/components";
import { getDirectory, useStreams } from "src/hooks";
import { intl, T } from "src/locale";
import { showDeleteConfirmModal, showHelpModal, showStreamModal } from "src/modals";
import { MANAGE, STREAMS } from "src/modules/Permissions";
import { showObjectSuccess } from "src/notifications";
import Table from "./Table";

export default function TableWrapper() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [sorting, setSorting] = useState<SortingState>([]);
	const { isFetching, isLoading, isError, error, data } = useStreams(["owner", "certificate"]);

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

	const handleDelete = async (id: number) => {
		await deleteStream(id);
		showObjectSuccess("stream", "deleted");
	};

	const handleDisableToggle = async (id: number, enabled: boolean) => {
		await toggleStream(id, enabled);
		await Promise.all([
			queryClient.invalidateQueries({ queryKey: ["streams"] }),
			queryClient.invalidateQueries({ queryKey: ["stream", id] }),
		]);
		showObjectSuccess("stream", enabled ? "enabled" : "disabled");
	};

	let filtered: Stream[] | null = null;
	if (search && data) {
		filtered = data?.filter((item) => {
			const directory = getDirectory(item).toLowerCase();
			return (
				`${item.incomingPort}`.includes(search) ||
				`${item.forwardingPort}`.includes(search) ||
				item.forwardingHost.includes(search) ||
				item.npmplusDescription?.toLowerCase().includes(search.toLowerCase()) ||
				directory.includes(search)
			);
		});
	}

	const displayedStreams = filtered ?? data ?? [];
	const groupingActive = displayedStreams.some((item) => getDirectory(item));

	const sharedTableProps = {
		isFiltered: Boolean(search),
		isFetching,
		sorting,
		onSortingChange: setSorting,
		onEdit: (id: number) => showStreamModal(id),
		onDelete: (id: number) => {
			const stream = data?.find((item) => item.id === id);
			showDeleteConfirmModal({
				title: <T id="object.delete" tData={{ object: "stream" }} />,
				onConfirm: () => handleDelete(id),
				invalidations: [["streams"], ["stream", id]],
				children: <T id="object.delete.content" tData={{ object: "stream" }} />,
				subject: stream ? `${stream.incomingPort} → ${stream.forwardingHost}:${stream.forwardingPort}` : null,
				details: stream?.npmplusDescription,
			});
		},
		onDisableToggle: handleDisableToggle,
		onNew: () => showStreamModal("new"),
	};

	return (
		<section className="card resource-panel mt-4">
			<div className="card-status-top bg-blue" />
			<div className="card-table">
				<div className="card-header">
					<div className="row w-100 g-3 align-items-center">
						<div className="col-12 col-md">
							<h1 className="h2 mt-1 mb-0">
								<T id="streams" />
							</h1>
						</div>
						<div className="col-12 col-md-auto">
							<div className="resource-toolbar d-flex flex-wrap btn-list justify-content-md-end">
								{data?.length ? (
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
								) : null}
								<Button size="sm" onClick={() => showHelpModal("Streams")}>
									<IconHelp size={20} />
								</Button>
								<HasPermission section={STREAMS} permission={MANAGE} hideError>
									{data?.length ? (
										<Button size="sm" className="btn-blue" onClick={() => showStreamModal("new")}>
											<T id="object.add" tData={{ object: "stream" }} />
										</Button>
									) : null}
								</HasPermission>
							</div>
						</div>
					</div>
				</div>
				<Table
					data={displayedStreams}
					groupBy={groupingActive ? getDirectory : undefined}
					renderGroupLabel={(key) => (key === "" ? <T id="stream.no-directory" /> : key)}
					{...sharedTableProps}
				/>
			</div>
		</section>
	);
}
