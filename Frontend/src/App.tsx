import {
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
  startTransition,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Download,
  Filter,
  LineChart,
  LogIn,
  LogOut,
  Package,
  Search,
  ShieldCheck,
  Sparkles,
  Store,
  TrendingUp,
  Utensils,
  WalletCards,
  X,
  type LucideIcon,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  clearToken,
  clearUser,
  downloadCsv,
  fetchDashboard,
  fetchFilterOptions,
  fetchInsights,
  fetchMe,
  getStoredUser,
  login,
  register,
  saveToken,
  saveUser,
} from "./lib/api";
import type {
  AuthMeResponse,
  AuthUser,
  DashboardData,
  DashboardFilters,
  FilterOptions,
  Granularity,
  Insight,
  InsightsResponse,
} from "./types";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const compactFormatter = new Intl.NumberFormat("en-IN", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const numberFormatter = new Intl.NumberFormat("en-IN");
const chartColors = ["#0f9f8f", "#f26b4f", "#6366f1", "#eab308", "#14b8a6", "#64748b"];

const emptyFilters: FilterOptions = {
  outlets: [],
  brands: [],
  groups: [],
  orderTypes: [],
  settlements: [],
  minDate: null,
  maxDate: null,
};

const initialFilters: DashboardFilters = {
  from: "",
  to: "",
  outlet: "",
  brand: "",
  group: "",
  orderType: "",
  settlement: "",
  itemSearch: "",
  granularity: "day",
};

type AuthMode = "login" | "register";

function formatCurrency(value = 0): string {
  return currencyFormatter.format(value);
}

function formatCompactCurrency(value = 0): string {
  return `Rs ${compactFormatter.format(value)}`;
}

function formatNumber(value = 0): string {
  return numberFormatter.format(Math.round(value));
}

function formatCompactNumber(value = 0): string {
  return compactFormatter.format(value);
}

function toDateInput(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return toDateInput(date);
}

function buildPresetRange(
  preset: "7d" | "30d" | "90d" | "all",
  options: FilterOptions,
): Pick<DashboardFilters, "from" | "to"> {
  const to = options.maxDate || toDateInput(new Date());
  if (preset === "all") {
    return {
      from: options.minDate || "",
      to,
    };
  }

  const days = preset === "7d" ? 7 : preset === "30d" ? 30 : 90;
  return { from: daysAgo(days), to };
}

function severityStyles(severity: Insight["severity"]): string {
  if (severity === "positive") {
    return "border-emerald-200 bg-emerald-50 text-emerald-900";
  }

  if (severity === "warning") {
    return "border-amber-200 bg-amber-50 text-amber-900";
  }

  return "border-zinc-200 bg-zinc-50 text-zinc-800";
}

interface SessionState {
  loading: boolean;
  authRequired: boolean;
  authAllowRegistration: boolean;
  user: AuthUser | null;
}

interface MetricCardProps {
  icon: LucideIcon;
  label: string;
  value: string;
  detail: string;
  accent: string;
  loading: boolean;
}

function MetricCard({ icon: Icon, label, value, detail, accent, loading }: MetricCardProps) {
  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-panel">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-zinc-500">{label}</span>
        <span
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-white"
          style={{ backgroundColor: accent }}
        >
          <Icon size={18} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-4 min-h-8 text-2xl font-semibold tracking-normal text-ink">
        {loading ? <span className="block h-8 w-28 animate-pulse rounded bg-zinc-100" /> : value}
      </div>
      <div className="mt-2 min-h-5 text-sm text-zinc-500">{loading ? "" : detail}</div>
    </section>
  );
}

function ChartPanel({
  title,
  icon: Icon,
  children,
  action,
}: {
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-panel">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-100 text-ink">
            <Icon size={17} aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-ink">{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function SectionHeading({
  title,
  action,
}: {
  title: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3">
      <h2 className="text-base font-semibold text-ink">{title}</h2>
      {action}
    </div>
  );
}

function SelectControl({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0">
      <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
        {label}
      </span>
      <select
        className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        <option value="">All</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function InsightCard({ insight }: { insight: Insight }) {
  return (
    <article className={`rounded-lg border p-4 ${severityStyles(insight.severity)}`}>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70">
          {insight.severity === "positive" ? (
            <CheckCircle2 size={18} aria-hidden="true" />
          ) : insight.severity === "warning" ? (
            <AlertTriangle size={18} aria-hidden="true" />
          ) : (
            <Sparkles size={18} aria-hidden="true" />
          )}
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold">{insight.title}</h3>
          <p className="mt-1 text-sm leading-6 text-inherit/85">{insight.detail}</p>
        </div>
      </div>
    </article>
  );
}

function AuthForm({
  mode,
  allowRegistration,
  busy,
  error,
  onModeChange,
  onSubmit,
}: {
  mode: AuthMode;
  allowRegistration: boolean;
  busy: boolean;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <form className="space-y-4" onSubmit={onSubmit}>
      <div className="flex gap-2 rounded-lg bg-zinc-100 p-1">
        <button
          className={`h-9 flex-1 rounded-md text-sm font-semibold ${
            mode === "login" ? "bg-ink text-white" : "text-zinc-600"
          }`}
          type="button"
          onClick={() => onModeChange("login")}
        >
          Login
        </button>
        <button
          className={`h-9 flex-1 rounded-md text-sm font-semibold ${
            mode === "register" ? "bg-ink text-white" : "text-zinc-600"
          } ${allowRegistration ? "" : "opacity-40"}`}
          type="button"
          disabled={!allowRegistration}
          onClick={() => onModeChange("register")}
        >
          Register
        </button>
      </div>

      {mode === "register" && allowRegistration && (
        <label className="block">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
            Name
          </span>
          <input
            className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
            name="name"
            placeholder="Your name"
            required
          />
        </label>
      )}

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
          Email
        </span>
        <input
          className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
          name="email"
          type="email"
          placeholder="you@company.com"
          autoComplete="email"
          required
        />
      </label>

      <label className="block">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
          Password
        </span>
        <input
          className="h-11 w-full rounded-lg border border-zinc-200 px-3 text-sm outline-none focus:border-teal focus:ring-2 focus:ring-teal/20"
          name="password"
          type="password"
          placeholder="Minimum 8 characters"
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </label>

      {error && (
        <div className="rounded-lg border border-tomato/30 bg-tomato/10 px-3 py-2 text-sm text-[#9f2f22]">
          {error}
        </div>
      )}

      <button
        className="flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-ink px-4 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
        type="submit"
        disabled={busy}
      >
        <LogIn size={16} aria-hidden="true" />
        {busy ? "Working..." : mode === "login" ? "Sign in" : "Create account"}
      </button>
    </form>
  );
}

function AuthScreen({
  mode,
  allowRegistration,
  busy,
  error,
  onModeChange,
  onSubmit,
}: {
  mode: AuthMode;
  allowRegistration: boolean;
  busy: boolean;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-ink sm:px-6 lg:px-8">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] w-full max-w-5xl place-items-center">
        <section className="grid w-full gap-6 rounded-2xl border border-black/5 bg-white p-6 shadow-panel lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-xl bg-ink p-6 text-white">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-lg bg-teal text-white">
                <Utensils size={22} aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-2xl font-semibold">California Burrito Analytics</h1>
                <p className="mt-1 text-sm text-white/70">Sign in to view the sales dashboard</p>
              </div>
            </div>

            <div className="mt-8 grid gap-3 text-sm text-white/85 sm:grid-cols-2">
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">Fast summaries</p>
                <p className="mt-1 text-white/70">MySQL aggregates and Redis caching keep the page responsive.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">Future-ready auth</p>
                <p className="mt-1 text-white/70">The login flow is ready now and can be enforced later with one env flag.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">Mobile-friendly</p>
                <p className="mt-1 text-white/70">The dashboard collapses cleanly on phones instead of fighting the viewport.</p>
              </div>
              <div className="rounded-lg border border-white/10 bg-white/5 p-4">
                <p className="font-semibold">Export and insights</p>
                <p className="mt-1 text-white/70">CSV export and AI/rule-based insights sit on top of the same filtered data.</p>
              </div>
            </div>
          </div>

          <div className="self-center">
            <div className="mb-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">
                Account access
              </p>
              <h2 className="mt-1 text-xl font-semibold text-ink">
                {mode === "login" ? "Welcome back" : "Create the first admin account"}
              </h2>
            </div>
            <AuthForm
              mode={mode}
              allowRegistration={allowRegistration}
              busy={busy}
              error={error}
              onModeChange={onModeChange}
              onSubmit={onSubmit}
            />
          </div>
        </section>
      </div>
    </main>
  );
}

function AuthModal({
  open,
  onClose,
  mode,
  allowRegistration,
  busy,
  error,
  onModeChange,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  mode: AuthMode;
  allowRegistration: boolean;
  busy: boolean;
  error: string | null;
  onModeChange: (mode: AuthMode) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Session</p>
            <h2 className="mt-1 text-lg font-semibold text-ink">Sign in</h2>
          </div>
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-200 text-zinc-600"
            type="button"
            onClick={onClose}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <AuthForm
          mode={mode}
          allowRegistration={allowRegistration}
          busy={busy}
          error={error}
          onModeChange={onModeChange}
          onSubmit={onSubmit}
        />
      </div>
    </div>
  );
}

function FiltersPanel({
  filters,
  options,
  open,
  onToggleOpen,
  onChange,
  onPreset,
  onReset,
  onExport,
  exporting,
}: {
  filters: DashboardFilters;
  options: FilterOptions;
  open: boolean;
  onToggleOpen: () => void;
  onChange: <K extends keyof DashboardFilters>(key: K, value: DashboardFilters[K]) => void;
  onPreset: (preset: "7d" | "30d" | "90d" | "all") => void;
  onReset: () => void;
  onExport: () => void;
  exporting: boolean;
}) {
  const panel = (
    <section className="rounded-lg border border-black/5 bg-white p-4 shadow-panel">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-8">
        <label className="min-w-0 xl:col-span-2">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
            Item search
          </span>
          <div className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 focus-within:border-teal focus-within:ring-2 focus-within:ring-teal/20">
            <Search size={16} className="text-zinc-400" aria-hidden="true" />
            <input
              className="h-full w-full border-0 bg-transparent text-sm outline-none"
              type="text"
              value={filters.itemSearch}
              placeholder="Search item name"
              onChange={(event) => onChange("itemSearch", event.target.value)}
            />
          </div>
        </label>

        <label className="min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
            From
          </span>
          <input
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20"
            type="date"
            value={filters.from}
            min={options.minDate ?? undefined}
            max={filters.to || options.maxDate || undefined}
            onChange={(event) => onChange("from", event.target.value)}
          />
        </label>

        <label className="min-w-0">
          <span className="mb-1 block text-xs font-semibold uppercase tracking-normal text-zinc-500">
            To
          </span>
          <input
            className="h-10 w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-ink outline-none transition focus:border-teal focus:ring-2 focus:ring-teal/20"
            type="date"
            value={filters.to}
            min={filters.from || options.minDate || undefined}
            max={options.maxDate ?? undefined}
            onChange={(event) => onChange("to", event.target.value)}
          />
        </label>

        <SelectControl label="Outlet" value={filters.outlet} options={options.outlets} onChange={(value) => onChange("outlet", value)} />
        <SelectControl label="Brand" value={filters.brand} options={options.brands} onChange={(value) => onChange("brand", value)} />
        <SelectControl label="Category" value={filters.group} options={options.groups} onChange={(value) => onChange("group", value)} />
        <SelectControl label="Order Type" value={filters.orderType} options={options.orderTypes} onChange={(value) => onChange("orderType", value)} />
        <SelectControl label="Payment" value={filters.settlement} options={options.settlements} onChange={(value) => onChange("settlement", value)} />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {(["7d", "30d", "90d", "all"] as const).map((preset) => (
          <button
            key={preset}
            className="rounded-lg border border-zinc-200 bg-zinc-50 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-zinc-600 transition hover:bg-zinc-100"
            type="button"
            onClick={() => onPreset(preset)}
          >
            {preset === "all" ? "All time" : `Last ${preset.replace("d", "")} days`}
          </button>
        ))}

        <div className="ml-auto flex items-center gap-2">
          <button
            className="flex h-10 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-semibold text-ink transition hover:bg-zinc-50"
            type="button"
            onClick={onReset}
          >
            <Filter size={16} aria-hidden="true" />
            Reset
          </button>
          <button
            className="flex h-10 items-center gap-2 rounded-lg bg-ink px-3 text-sm font-semibold text-white transition hover:bg-ink/90 disabled:cursor-not-allowed disabled:opacity-60"
            type="button"
            disabled={exporting}
            onClick={onExport}
          >
            <Download size={16} aria-hidden="true" />
            {exporting ? "Exporting..." : "Export CSV"}
          </button>
        </div>
      </div>
    </section>
  );

  return (
    <>
      <div className="hidden md:block">{panel}</div>
      <div className="md:hidden">
        <button
          className="flex h-11 w-full items-center justify-between rounded-lg border border-black/5 bg-white px-4 text-sm font-semibold text-ink shadow-panel"
          type="button"
          onClick={onToggleOpen}
        >
          <span className="flex items-center gap-2">
            <Filter size={16} aria-hidden="true" />
            Filters
          </span>
          <ChevronDown
            size={16}
            className={`transition ${open ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>
        <div className={`${open ? "mt-3 block" : "hidden"} `}>{panel}</div>
      </div>
    </>
  );
}

function TopItemsBlock({
  items,
}: {
  items: DashboardData["topItems"];
}) {
  return (
    <>
      <div className="grid gap-3 md:hidden">
        {items.map((item) => (
          <article key={`${item.name}-${item.group}`} className="rounded-lg border border-zinc-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{item.name}</p>
                <p className="mt-1 text-xs uppercase tracking-wide text-zinc-500">{item.group}</p>
              </div>
              <div className="text-right text-sm font-semibold text-ink">{formatCompactCurrency(item.revenue)}</div>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2 text-xs text-zinc-500">
              <div>
                <p className="font-semibold text-ink">{formatCompactNumber(item.orders)}</p>
                <p>Orders</p>
              </div>
              <div>
                <p className="font-semibold text-ink">{formatCompactNumber(item.quantity)}</p>
                <p>Qty</p>
              </div>
              <div>
                <p className="font-semibold text-ink">{formatCurrency(item.averagePrice)}</p>
                <p>Avg</p>
              </div>
            </div>
          </article>
        ))}
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[760px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-xs uppercase tracking-normal text-zinc-500">
              <th className="py-3 pr-4 font-semibold">Item</th>
              <th className="py-3 pr-4 font-semibold">Category</th>
              <th className="py-3 pr-4 text-right font-semibold">Revenue</th>
              <th className="py-3 pr-4 text-right font-semibold">Orders</th>
              <th className="py-3 pr-4 text-right font-semibold">Quantity</th>
              <th className="py-3 text-right font-semibold">Avg Price</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={`${item.name}-${item.group}`} className="border-b border-zinc-100 last:border-0">
                <td className="max-w-[260px] py-3 pr-4 font-semibold text-ink">{item.name}</td>
                <td className="py-3 pr-4 text-zinc-500">{item.group}</td>
                <td className="py-3 pr-4 text-right font-semibold">{formatCompactCurrency(item.revenue)}</td>
                <td className="py-3 pr-4 text-right">{formatCompactNumber(item.orders)}</td>
                <td className="py-3 pr-4 text-right">{formatCompactNumber(item.quantity)}</td>
                <td className="py-3 text-right">{formatCurrency(item.averagePrice)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

export default function App() {
  const [session, setSession] = useState<SessionState>({
    loading: true,
    authRequired: false,
    authAllowRegistration: true,
    user: getStoredUser(),
  });
  const [authMode, setAuthMode] = useState<AuthMode>("login");
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);

  const [filterOptions, setFilterOptions] = useState<FilterOptions>(emptyFilters);
  const [filters, setFilters] = useState<DashboardFilters>(initialFilters);
  const deferredFilters = useDeferredValue(filters);

  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [insights, setInsights] = useState<InsightsResponse | null>(null);
  const [loadingData, setLoadingData] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mixMode, setMixMode] = useState<"orderTypes" | "settlements">("orderTypes");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    let ignore = false;

    fetchMe()
      .then((response: AuthMeResponse) => {
        if (ignore) {
          return;
        }

        if (response.user) {
          saveUser(response.user);
        } else {
          clearUser();
        }

        setSession({
          loading: false,
          authRequired: response.authRequired,
          authAllowRegistration: response.authAllowRegistration,
          user: response.user,
        });
      })
      .catch(() => {
        if (ignore) {
          return;
        }

        setSession((current) => ({
          ...current,
          loading: false,
        }));
      });

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (session.loading || (session.authRequired && !session.user)) {
      return;
    }

    let ignore = false;

    fetchFilterOptions()
      .then((options) => {
        if (ignore) {
          return;
        }

        setFilterOptions(options);
        setFilters((current) => {
          const next = { ...current };

          if (!next.from) {
            next.from = options.minDate || "";
          }

          if (!next.to) {
            next.to = options.maxDate || "";
          }

          return next;
        });
      })
      .catch(() => {
        if (!ignore) {
          setDataError("Unable to load filter options.");
          setLoadingData(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [session.loading, session.authRequired, session.user]);

  useEffect(() => {
    if (session.loading || (session.authRequired && !session.user)) {
      return;
    }

    if (!filterOptions.minDate && !filterOptions.maxDate) {
      return;
    }

    if (!deferredFilters.from || !deferredFilters.to) {
      return;
    }

    let ignore = false;
    setLoadingData(true);
    setDataError(null);

    Promise.all([
      fetchDashboard(deferredFilters, deferredFilters.granularity, 10),
      fetchInsights(deferredFilters, deferredFilters.granularity),
    ])
      .then(([dashboardData, insightsData]) => {
        if (ignore) {
          return;
        }

        setDashboard(dashboardData);
        setInsights(insightsData);
        setLastUpdated(
          new Date().toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        );
      })
      .catch(() => {
        if (!ignore) {
          setDataError("Unable to load analytics. Check the backend and database connection.");
        }
      })
      .finally(() => {
        if (!ignore) {
          setLoadingData(false);
        }
      });

    return () => {
      ignore = true;
    };
  }, [deferredFilters, filterOptions.maxDate, filterOptions.minDate, session.loading, session.authRequired, session.user]);

  const currentMix = useMemo(
    () => (dashboard ? dashboard.channelMix[mixMode] : []),
    [dashboard, mixMode],
  );

  const updateFilter = <K extends keyof DashboardFilters>(
    key: K,
    value: DashboardFilters[K],
  ) => {
    startTransition(() => {
      setFilters((current) => ({
        ...current,
        [key]: value,
      }));
    });
  };

  const resetFilters = () => {
    setFilters({
      ...initialFilters,
      from: filterOptions.minDate || "",
      to: filterOptions.maxDate || "",
    });
  };

  const applyPreset = (preset: "7d" | "30d" | "90d" | "all") => {
    const range = buildPresetRange(preset, filterOptions);
    setFilters((current) => ({
      ...current,
      ...range,
    }));
  };

  const handleAuthSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthBusy(true);
    setAuthError(null);

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") ?? "").trim();
    const password = String(formData.get("password") ?? "");
    const name = String(formData.get("name") ?? "").trim();

    try {
      const result =
        authMode === "login"
          ? await login({ email, password })
          : await register({ name, email, password });

      saveToken(result.token);
      saveUser(result.user);
      setSession((current) => ({
        ...current,
        user: result.user,
        loading: false,
      }));
      setShowAuthModal(false);
      setAuthError(null);
      event.currentTarget.reset();
    } catch (error) {
      setAuthError(
        error instanceof Error ? error.message : "Authentication failed. Please try again.",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const handleLogout = () => {
    clearToken();
    clearUser();
    setSession((current) => ({
      ...current,
      user: null,
    }));
    setDashboard(null);
    setInsights(null);
    setShowAuthModal(session.authRequired);
    setAuthMode("login");
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await downloadCsv(deferredFilters, 500000);
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "sales-export.csv";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  if (session.loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f6f7f9] text-ink">
        <div className="flex items-center gap-3 rounded-lg border border-black/5 bg-white px-4 py-3 shadow-panel">
          <span className="h-4 w-4 animate-pulse rounded-full bg-teal" />
          <p className="text-sm font-medium">Loading analytics workspace...</p>
        </div>
      </main>
    );
  }

  if (session.authRequired && !session.user) {
    return (
      <AuthScreen
        mode={authMode}
        allowRegistration={session.authAllowRegistration}
        busy={authBusy}
        error={authError}
        onModeChange={(mode) => setAuthMode(mode)}
        onSubmit={handleAuthSubmit}
      />
    );
  }

  return (
    <main className="min-h-screen bg-[#f6f7f9] text-ink">
      <div className="mx-auto flex w-full max-w-[1500px] flex-col gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-4 rounded-lg bg-ink px-4 py-4 text-white shadow-panel">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-teal text-white">
                <Utensils size={22} aria-hidden="true" />
              </span>
              <div>
                <h1 className="text-xl font-semibold tracking-normal sm:text-2xl">
                  California Burrito Analytics
                </h1>
                <p className="mt-1 text-sm text-white/70">Sales performance workspace</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-sm text-white/80">
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                <ShieldCheck size={16} aria-hidden="true" />
                {session.authRequired ? "Auth required" : "Open access"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                <CalendarRange size={16} aria-hidden="true" />
                {lastUpdated || "Loading"}
              </span>
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2">
                <Sparkles size={16} aria-hidden="true" />
                {insights?.source === "openai" ? "AI insights" : "Rule insights"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {session.user ? (
              <span className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85">
                <CheckCircle2 size={16} aria-hidden="true" />
                {session.user.name}
              </span>
            ) : (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85 transition hover:bg-white/15"
                type="button"
                onClick={() => setShowAuthModal(true)}
              >
                <LogIn size={16} aria-hidden="true" />
                Sign in
              </button>
            )}

            {session.user && (
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85 transition hover:bg-white/15"
                type="button"
                onClick={handleLogout}
              >
                <LogOut size={16} aria-hidden="true" />
                Logout
              </button>
            )}

            <div className="ml-auto hidden gap-2 md:flex">
              <button
                className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/85 transition hover:bg-white/15"
                type="button"
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <Filter size={16} aria-hidden="true" />
                Filters
              </button>
            </div>
          </div>
        </header>

        <FiltersPanel
          filters={filters}
          options={filterOptions}
          open={filtersOpen}
          onToggleOpen={() => setFiltersOpen((current) => !current)}
          onChange={updateFilter}
          onPreset={applyPreset}
          onReset={resetFilters}
          onExport={handleExport}
          exporting={exporting}
        />

        {dataError && (
          <div className="rounded-lg border border-tomato/30 bg-tomato/10 px-4 py-3 text-sm font-medium text-[#9f2f22]">
            {dataError}
          </div>
        )}

        <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <MetricCard
            icon={CircleDollarSign}
            label="Revenue"
            value={formatCurrency(dashboard?.summary.totalRevenue)}
            detail={`${formatNumber(dashboard?.summary.totalOrders)} orders`}
            accent="#0f9f8f"
            loading={loadingData}
          />
          <MetricCard
            icon={TrendingUp}
            label="Average Order"
            value={formatCurrency(dashboard?.summary.averageOrderValue)}
            detail={`${dashboard?.summary.itemsPerOrder?.toFixed(1) ?? "0.0"} items/order`}
            accent="#6366f1"
            loading={loadingData}
          />
          <MetricCard
            icon={Package}
            label="Items Sold"
            value={formatNumber(dashboard?.summary.totalQuantity)}
            detail={`${formatNumber(dashboard?.summary.totalRecords)} line items`}
            accent="#eab308"
            loading={loadingData}
          />
          <MetricCard
            icon={Store}
            label="Date Range"
            value={dashboard?.summary.firstOrderAt ? dashboard.summary.firstOrderAt.slice(0, 10) : "-"}
            detail={dashboard?.summary.lastOrderAt ? `to ${dashboard.summary.lastOrderAt.slice(0, 10)}` : ""}
            accent="#14b8a6"
            loading={loadingData}
          />
          <MetricCard
            icon={WalletCards}
            label="Top Item"
            value={dashboard?.topItems[0]?.name || "-"}
            detail={dashboard?.topItems[0] ? formatCompactCurrency(dashboard.topItems[0].revenue) : ""}
            accent="#f26b4f"
            loading={loadingData}
          />
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <ChartPanel
              title="Revenue Trend"
              icon={LineChart}
              action={
                <div className="flex gap-1 rounded-lg bg-zinc-50 p-1">
                  {(["day", "week", "month"] as Granularity[]).map((granularity) => (
                    <button
                      key={granularity}
                      className={`h-8 rounded-lg px-3 text-sm font-semibold transition ${
                        filters.granularity === granularity
                          ? "bg-ink text-white"
                          : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                      }`}
                      type="button"
                      onClick={() => updateFilter("granularity", granularity)}
                    >
                      {granularity[0].toUpperCase() + granularity.slice(1)}
                    </button>
                  ))}
                </div>
              }
            >
              {dashboard?.trend.length ? (
                <div className="h-64 sm:h-72 lg:h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dashboard.trend} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0f9f8f" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#0f9f8f" stopOpacity={0.02} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                      <XAxis dataKey="bucket" tick={{ fontSize: 12 }} minTickGap={28} />
                      <YAxis tickFormatter={(value) => compactFormatter.format(Number(value))} tick={{ fontSize: 12 }} />
                      <Tooltip
                        formatter={(value, name) => [
                          name === "Revenue" ? formatCurrency(Number(value)) : formatNumber(Number(value)),
                          String(name),
                        ]}
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        name="Revenue"
                        stroke="#0f9f8f"
                        strokeWidth={2}
                        fill="url(#revenueFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-500">
                  No trend data
                </div>
              )}
            </ChartPanel>
          </div>

          <ChartPanel
            title={mixMode === "orderTypes" ? "Order Type Mix" : "Payment Mix"}
            icon={mixMode === "orderTypes" ? WalletCards : CircleDollarSign}
            action={
              <div className="flex gap-1 rounded-lg bg-zinc-50 p-1">
                <button
                  className={`h-8 rounded-lg px-3 text-sm font-semibold transition ${
                    mixMode === "orderTypes"
                      ? "bg-ink text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                  type="button"
                  onClick={() => setMixMode("orderTypes")}
                >
                  Type
                </button>
                <button
                  className={`h-8 rounded-lg px-3 text-sm font-semibold transition ${
                    mixMode === "settlements"
                      ? "bg-ink text-white"
                      : "bg-zinc-100 text-zinc-600 hover:bg-zinc-200"
                  }`}
                  type="button"
                  onClick={() => setMixMode("settlements")}
                >
                  Pay
                </button>
              </div>
            }
          >
            {currentMix.length ? (
              <div className="h-64 sm:h-72 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={currentMix}
                      dataKey="revenue"
                      nameKey="name"
                      innerRadius={54}
                      outerRadius={90}
                      paddingAngle={2}
                    >
                      {currentMix.map((entry, index) => (
                        <Cell key={entry.name} fill={chartColors[index % chartColors.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(value, name) => [
                        formatCurrency(Number(value)),
                        String(name),
                      ]}
                    />
                    <Legend iconType="circle" />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-500">
                No mix data
              </div>
            )}
          </ChartPanel>
        </section>

        <section className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <ChartPanel title="Category Sales" icon={BarChart3}>
            {dashboard?.categories.length ? (
              <div className="h-64 sm:h-72 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dashboard.categories} margin={{ top: 8, right: 14, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis dataKey="name" tick={{ fontSize: 12 }} interval={0} angle={-15} height={58} />
                    <YAxis tickFormatter={(value) => compactFormatter.format(Number(value))} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Revenue"]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#f26b4f" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-500">
                No category data
              </div>
            )}
          </ChartPanel>

          <ChartPanel title="Outlet Performance" icon={Store}>
            {dashboard?.outlets.length ? (
              <div className="h-64 sm:h-72 lg:h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dashboard.outlets}
                    layout="vertical"
                    margin={{ top: 8, right: 18, left: 20, bottom: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e4e4e7" />
                    <XAxis type="number" tickFormatter={(value) => compactFormatter.format(Number(value))} tick={{ fontSize: 12 }} />
                    <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 12 }} />
                    <Tooltip formatter={(value) => [formatCurrency(Number(value)), "Revenue"]} />
                    <Bar dataKey="revenue" name="Revenue" fill="#6366f1" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex h-64 items-center justify-center rounded-lg border border-dashed border-zinc-200 text-sm text-zinc-500">
                No outlet data
              </div>
            )}
          </ChartPanel>
        </section>

        <section className="rounded-lg border border-black/5 bg-white p-4 shadow-panel">
          <SectionHeading
            title="Insights"
            action={
              insights ? (
                <span className="rounded-full border border-zinc-200 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  {insights.source}
                </span>
              ) : null
            }
          />
          {insights?.insights.length ? (
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {insights.insights.map((insight) => (
                <InsightCard key={`${insight.title}-${insight.detail.slice(0, 16)}`} insight={insight} />
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-zinc-200 px-4 py-8 text-center text-sm text-zinc-500">
              No insights available yet.
            </div>
          )}
        </section>

        <section className="rounded-lg border border-black/5 bg-white p-4 shadow-panel">
          <SectionHeading title="Top Items" />
          <TopItemsBlock items={dashboard?.topItems || []} />
        </section>
      </div>

      <AuthModal
        open={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        mode={authMode}
        allowRegistration={session.authAllowRegistration}
        busy={authBusy}
        error={authError}
        onModeChange={setAuthMode}
        onSubmit={handleAuthSubmit}
      />
    </main>
  );
}
