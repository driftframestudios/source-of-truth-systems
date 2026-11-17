import { useMemo, useRef, useState } from "react";
import {
  useTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Dna,
  FileCheck2,
  FlaskConical,
  LayoutGrid,
  Lock,
  Search,
  ShieldAlert,
  Table2,
} from "lucide-react";
import { useSpecimens } from "../../services/recordSessionContext";
import { summarizeSpecimens } from "../../services/recordSession";
import {
  ASSAY_LABELS,
  COLUMN_SPEC,
  FACETS,
  specimenColumns,
  specimenFeatures,
  specimenSearchText,
  TOPICS,
  words,
} from "../specimen/specimenCollection";
import {
  SpecimenCards,
  type OpenSpecimenTopic,
} from "../specimen/SpecimenCards";
import { SpecimenCell } from "../specimen/SpecimenCell";
import {
  SpecimenDialog,
  type SpecimenSelection,
} from "../specimen/SpecimenDialog";
import "../specimen/specimen-table.css";

export function SpecimenView() {
  const specimens = useSpecimens();
  const data = useMemo(() => [...specimens], [specimens]);
  const [view, setView] = useState<"cards" | "table">("cards");
  const [query, setQuery] = useState("");
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [selection, setSelection] = useState<SpecimenSelection | null>(null);
  const origin = useRef<HTMLButtonElement | null>(null);
  const register = useRef<HTMLDivElement>(null);
  const table = useTable({
    features: specimenFeatures,
    columns: specimenColumns,
    data,
    getRowId: (row) => row.id,
    state: { sorting, columnFilters, globalFilter: query },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setQuery,
    globalFilterFn: (row, _column, value: string) =>
      specimenSearchText(row.original).includes(value.trim().toLowerCase()),
    enableMultiSort: false,
  });
  const rows = table.getRowModel().rows;
  const visible = rows.map((row) => row.original);
  const { total, onHold, rescinded, reported } = summarizeSpecimens(specimens);
  const clearFilters = () => {
    setQuery("");
    setColumnFilters([]);
  };
  const open: OpenSpecimenTopic = (specimen, topic, trigger) => {
    const bounds = trigger.getBoundingClientRect();
    origin.current = trigger;
    setSelection({
      id: specimen.id,
      topic,
      origin: {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
      },
    });
  };
  return (
    <div
      className="specimen-register specimen-surface"
      ref={register}
      tabIndex={-1}
    >
      <div className="specimen-toolbar">
        <h2>
          <FlaskConical size={15} aria-hidden="true" />
          Specimen register
        </h2>
        <div
          className="specimen-view-switch"
          role="group"
          aria-label="Specimen view"
        >
          {(["cards", "table"] as const).map((mode) => (
            <button
              type="button"
              key={mode}
              aria-pressed={view === mode}
              onClick={() => setView(mode)}
            >
              {mode === "cards" ? (
                <LayoutGrid size={13} aria-hidden="true" />
              ) : (
                <Table2 size={13} aria-hidden="true" />
              )}
              {mode === "cards" ? "Cards" : "Table"}
            </button>
          ))}
        </div>
        <label className="specimen-search">
          <Search size={13} aria-hidden="true" />
          <span className="sr-only">Find a specimen</span>
          <input
            type="search"
            placeholder="Specimen, patient, assay or state"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <span className="specimen-toolbar__count" role="status">
          {rows.length} of {total} shown
        </span>
      </div>
      <div className="specimen-filters" aria-label="Specimen filters">
        {FACETS.map((facet) => {
          const values = [
            ...new Set(specimens.map((item) => item[facet.key])),
          ].sort();
          const column = table.getColumn(facet.column);
          return (
            <label key={facet.column}>
              {facet.label}
              <select
                value={(column?.getFilterValue() as string) ?? ""}
                onChange={(event) =>
                  column?.setFilterValue(event.target.value || undefined)
                }
              >
                <option value="">All</option>
                {values.map((value) => (
                  <option key={value} value={value}>
                    {facet.key === "assay"
                      ? (ASSAY_LABELS[value] ?? value)
                      : words(value)}
                  </option>
                ))}
              </select>
            </label>
          );
        })}
        <label>
          Quality
          <select
            value={
              (table.getColumn("quality")?.getFilterValue() as string) ?? ""
            }
            onChange={(event) =>
              table
                .getColumn("quality")
                ?.setFilterValue(event.target.value || undefined)
            }
          >
            <option value="">All</option>
            <option value="flagged">With QC flags</option>
            <option value="clear">No QC flags</option>
          </select>
        </label>
        <button
          type="button"
          onClick={clearFilters}
          disabled={!query && !columnFilters.length}
        >
          Clear filters
          {columnFilters.length ? ` (${columnFilters.length})` : ""}
        </button>
      </div>
      <div className="specimen-summary">
        <span>
          <Dna size={12} aria-hidden="true" />
          <strong>{total}</strong> specimens
        </span>
        <span>
          <Lock size={12} aria-hidden="true" />
          <strong>{onHold}</strong>
          <span>orders held</span>
        </span>
        <span>
          <ShieldAlert size={12} aria-hidden="true" />
          <strong>{rescinded}</strong> consent rescinded
        </span>
        <span>
          <FileCheck2 size={12} aria-hidden="true" />
          <strong>{reported}</strong> samples reported
        </span>
        <label className="specimen-sort">
          Sort by
          <select
            aria-label="Sort specimens by"
            value={sorting[0]?.id ?? ""}
            onChange={(event) =>
              setSorting(
                event.target.value
                  ? [{ id: event.target.value, desc: false }]
                  : [],
              )
            }
          >
            <option value="">Original order</option>
            {COLUMN_SPEC.map((column) => (
              <option key={column.id} value={column.id}>
                {column.label}
              </option>
            ))}
          </select>
        </label>
        {sorting.length > 0 && (
          <>
            <button
              type="button"
              aria-label={
                sorting[0].desc ? "Sort ascending" : "Sort descending"
              }
              onClick={() =>
                setSorting([{ ...sorting[0], desc: !sorting[0].desc }])
              }
            >
              {sorting[0].desc ? (
                <ArrowDown size={13} />
              ) : (
                <ArrowUp size={13} />
              )}
            </button>
            <button type="button" onClick={() => setSorting([])}>
              Reset sort
            </button>
          </>
        )}
      </div>
      <div
        className="specimen-table-scroll"
        tabIndex={0}
        role="region"
        aria-label={
          view === "table" ? "Specimen comparison" : "Specimen masonry"
        }
      >
        {!rows.length ? (
          <div className="specimen-table__empty">
            <p>No specimens match these filters.</p>
            <button type="button" onClick={clearFilters}>
              Clear filters
            </button>
          </div>
        ) : view === "cards" ? (
          <SpecimenCards specimens={visible} onOpen={open} />
        ) : (
          <table className="specimen-table">
            <caption>
              Compare specimens. Select a cell to explore that topic.
            </caption>
            <thead>
              <tr>
                {COLUMN_SPEC.map((spec) => {
                  const column = table.getColumn(spec.id)!;
                  const direction = column.getIsSorted();
                  return (
                    <th
                      scope="col"
                      key={spec.id}
                      aria-sort={
                        direction === "asc"
                          ? "ascending"
                          : direction === "desc"
                            ? "descending"
                            : "none"
                      }
                    >
                      <button
                        type="button"
                        onClick={column.getToggleSortingHandler()}
                      >
                        {spec.label}
                        {direction === "asc" ? (
                          <ArrowUp size={12} aria-hidden="true" />
                        ) : direction === "desc" ? (
                          <ArrowDown size={12} aria-hidden="true" />
                        ) : (
                          <ArrowUpDown size={12} aria-hidden="true" />
                        )}
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr
                  key={row.id}
                  data-specimen-id={row.id}
                  className="specimen-table__record"
                >
                  {COLUMN_SPEC.map((spec, index) => {
                    const Cell = index === 0 ? "th" : "td";
                    return (
                      <Cell
                        key={spec.id}
                        scope={index === 0 ? "row" : undefined}
                      >
                        <button
                          type="button"
                          className="specimen-table__cell"
                          aria-label={`${row.id} · ${TOPICS[spec.topic]}${spec.id === "assay" ? " · assay and material" : ""}`}
                          aria-haspopup="dialog"
                          onClick={(event) =>
                            open(row.original, spec.topic, event.currentTarget)
                          }
                        >
                          <SpecimenCell
                            specimen={row.original}
                            column={spec.id}
                          />
                        </button>
                      </Cell>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <SpecimenDialog
        selection={selection}
        specimens={visible}
        allSpecimens={specimens}
        returnFocus={() => {
          if (origin.current?.isConnected)
            origin.current.focus({ preventScroll: true });
          else register.current?.focus({ preventScroll: true });
        }}
        onTopic={(topic) =>
          setSelection((current) => current && { ...current, topic })
        }
        onRecord={(id) =>
          setSelection((current) => current && { ...current, id })
        }
        onClose={() => setSelection(null)}
      />
    </div>
  );
}
