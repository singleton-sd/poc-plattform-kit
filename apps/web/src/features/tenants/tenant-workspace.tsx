'use client';

import {
  tenantControllerFindAll,
  useTenantControllerFindAll,
  type TenantResponseDto,
} from '@poc-plattform-kit/api-client';
import { keepPreviousData } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { PlusIcon } from '@/components/icons';
import { Toast } from '@/components/toast';
import { tenantListPayload } from './api';
import { TenantCreateDrawer } from './tenant-create-drawer';
import { TenantDetailsDrawer } from './tenant-details-drawer';
import { TenantEmptyState, TenantErrorState, TenantSearchEmptyState } from './tenant-list-states';
import { TenantMobileList } from './tenant-mobile-list';
import { TenantOpenById } from './tenant-open-by-id';
import { TenantSearch } from './tenant-search';
import { TenantTable } from './tenant-table';

const SEARCH_DEBOUNCE_MS = 300;
const LIST_LIMIT = 100;

export function TenantWorkspace() {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [items, setItems] = useState<TenantResponseDto[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput.trim()), SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const listQuery = useTenantControllerFindAll(
    { q: debouncedSearch || undefined, limit: LIST_LIMIT },
    { query: { placeholderData: keepPreviousData } },
  );

  // First page for the current search — sets the base of the accumulated,
  // load-more-extended list below. `listQuery.data` is referentially stable
  // between renders until a fetch actually resolves, so this only resets the
  // accumulator on a real first-page load (initial, search change, refetch).
  useEffect(() => {
    const page = tenantListPayload(listQuery.data);
    if (!page) return;
    setItems(page.items);
    setNextCursor(page.nextCursor);
    setLoadMoreFailed(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the query result identity, not the derived page
  }, [listQuery.data]);

  const isInitialLoading = listQuery.isLoading;
  const isError = listQuery.isError;
  const isSearching = debouncedSearch.length > 0;
  const isEmpty = !isInitialLoading && !isError && items.length === 0;

  async function handleLoadMore() {
    if (!nextCursor || isLoadingMore) return;
    setIsLoadingMore(true);
    setLoadMoreFailed(false);
    try {
      const response = await tenantControllerFindAll({
        q: debouncedSearch || undefined,
        limit: LIST_LIMIT,
        cursor: nextCursor,
      });
      const page = tenantListPayload(response);
      if (page) {
        setItems((prev) => [...prev, ...page.items]);
        setNextCursor(page.nextCursor);
      }
    } catch {
      setLoadMoreFailed(true);
    } finally {
      setIsLoadingMore(false);
    }
  }

  function handleCreated(tenant: TenantResponseDto) {
    setCreateOpen(false);
    void listQuery.refetch();
    setSelectedTenantId(tenant.id);
    setToastMessage(`${tenant.name} was created.`);
  }

  function handleUpdated(tenant: TenantResponseDto) {
    void listQuery.refetch();
    setToastMessage(`${tenant.name} was updated.`);
  }

  return (
    <div
      className="mx-auto flex w-full max-w-5xl flex-col gap-6 p-4 sm:p-6"
      data-testid="tenant-workspace"
    >
      <header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-fg">Tenants</h1>
          <p className="text-sm text-fg-muted">Browse, search, create and manage tenants.</p>
        </div>
        <div className="flex items-center gap-3">
          <TenantSearch value={searchInput} onChange={setSearchInput} />
          <button
            type="button"
            onClick={() => setCreateOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded bg-accent px-4 py-2 text-sm font-medium text-accent-on"
            data-testid="tenant-create-open"
          >
            <PlusIcon className="h-4 w-4" />
            Create Tenant
          </button>
        </div>
      </header>

      <div className="flex justify-end">
        <TenantOpenById onOpen={setSelectedTenantId} />
      </div>

      {isError ? (
        <TenantErrorState onRetry={() => void listQuery.refetch()} />
      ) : isInitialLoading ? (
        <>
          <TenantTable tenants={[]} loading onSelect={() => undefined} />
          <TenantMobileList tenants={[]} loading onSelect={() => undefined} />
        </>
      ) : isEmpty && isSearching ? (
        <TenantSearchEmptyState onClearSearch={() => setSearchInput('')} />
      ) : isEmpty ? (
        <TenantEmptyState onCreate={() => setCreateOpen(true)} />
      ) : (
        <>
          <TenantTable tenants={items} onSelect={setSelectedTenantId} />
          <TenantMobileList tenants={items} onSelect={setSelectedTenantId} />

          {nextCursor ? (
            <div className="flex flex-col items-center gap-2 py-2">
              <button
                type="button"
                onClick={() => void handleLoadMore()}
                disabled={isLoadingMore}
                className="rounded border border-fg-subtle px-4 py-2 text-sm text-fg disabled:opacity-50"
                data-testid="tenant-load-more"
              >
                {isLoadingMore ? 'Loading…' : 'Load more'}
              </button>
              {loadMoreFailed ? (
                <p className="text-sm text-fg" role="alert" data-testid="tenant-load-more-error">
                  Couldn&apos;t load more tenants.
                </p>
              ) : null}
            </div>
          ) : null}
        </>
      )}

      <TenantCreateDrawer
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
      <TenantDetailsDrawer
        tenantId={selectedTenantId}
        onClose={() => setSelectedTenantId(null)}
        onUpdated={handleUpdated}
      />
      <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} testId="tenant-toast" />
    </div>
  );
}
