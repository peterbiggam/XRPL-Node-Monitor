import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { MetricCard } from "@/components/metric-card";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search,
  DollarSign,
  Hash,
  User,
  ArrowRightLeft,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Coins,
  TrendingUp,
  TrendingDown,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { NodeInfo, AccountInfo, FeeInfo, TransactionInfo } from "@shared/schema";

interface NodeResponse {
  status: string;
  data: NodeInfo | null;
}

interface TxResponse {
  status: string;
  data: (TransactionInfo & { raw?: Record<string, unknown> }) | null;
  message?: string;
}

interface AccountResponse {
  status: string;
  data: AccountInfo | null;
  message?: string;
}

interface AccountTxResponse {
  status: string;
  data: TransactionInfo[];
  message?: string;
}

interface FeeResponse {
  status: string;
  data: FeeInfo | null;
  message?: string;
}

type SearchType = "none" | "tx" | "account";

function detectSearchType(input: string): SearchType {
  const trimmed = input.trim();
  if (!trimmed) return "none";
  if (/^[A-Fa-f0-9]{64}$/.test(trimmed)) return "tx";
  if (/^r[1-9A-HJ-NP-Za-km-z]{24,34}$/.test(trimmed)) return "account";
  if (trimmed.length === 64) return "tx";
  if (trimmed.startsWith("r")) return "account";
  return "none";
}

function dropsToXrp(drops: string): string {
  const num = parseInt(drops, 10);
  if (isNaN(num)) return "0";
  return (num / 1_000_000).toFixed(6);
}

function formatXrpBalance(drops: string): string {
  const xrp = parseFloat(dropsToXrp(drops));
  return xrp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}

function xrplTimeToDate(xrplTimestamp: number): string {
  if (!xrplTimestamp) return "N/A";
  const rippleEpoch = 946684800;
  const date = new Date((xrplTimestamp + rippleEpoch) * 1000);
  return date.toLocaleString();
}

function parseLedgerGaps(completeLedgers: string): { ranges: [number, number][]; gaps: [number, number][] } {
  if (!completeLedgers || completeLedgers === "empty") return { ranges: [], gaps: [] };
  const parts = completeLedgers.split(",").map((s) => s.trim());
  const ranges: [number, number][] = parts.map((p) => {
    const [start, end] = p.split("-").map(Number);
    return [start, end || start];
  });
  const gaps: [number, number][] = [];
  for (let i = 0; i < ranges.length - 1; i++) {
    const gapStart = ranges[i][1] + 1;
    const gapEnd = ranges[i + 1][0] - 1;
    if (gapStart <= gapEnd) {
      gaps.push([gapStart, gapEnd]);
    }
  }
  return { ranges, gaps };
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function TransactionDetail({ data }: { data: TxResponse["data"] }) {
  if (!data) return null;
  const isSuccess = data.result === "tesSUCCESS";
  const raw = data.raw || {};

  return (
    <motion.div variants={itemVariants} data-testid="section-tx-detail">
      <Card className="cyber-border overflow-visible">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Transaction Detail
              </span>
            </div>
            <Badge
              variant={isSuccess ? "default" : "secondary"}
              className={isSuccess ? "cyber-glow no-default-active-elevate" : "no-default-active-elevate"}
              data-testid="badge-tx-result"
            >
              {isSuccess ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <XCircle className="w-3 h-3 mr-1" />}
              {data.result}
            </Badge>
          </div>

          <div className="neon-line" />

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Hash</p>
              <p className="text-xs font-mono text-primary/80 break-all" data-testid="text-tx-hash">{data.hash}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Type</p>
              <p className="text-sm font-mono" data-testid="text-tx-type">{data.type}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Account</p>
              <p className="text-xs font-mono text-primary/80 break-all" data-testid="text-tx-account">{data.account}</p>
            </div>
            {data.destination && (
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Destination</p>
                <p className="text-xs font-mono text-primary/80 break-all" data-testid="text-tx-destination">{data.destination}</p>
              </div>
            )}
            {data.amount && (
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Amount</p>
                <p className="text-sm font-mono text-primary text-glow" data-testid="text-tx-amount">
                  {dropsToXrp(data.amount)} XRP
                </p>
              </div>
            )}
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Fee</p>
              <p className="text-sm font-mono" data-testid="text-tx-fee">{dropsToXrp(data.fee)} XRP</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Ledger</p>
              <p className="text-sm font-mono" data-testid="text-tx-ledger">{data.ledgerIndex.toLocaleString()}</p>
            </div>
            <div className="space-y-1">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Date</p>
              <p className="text-sm font-mono" data-testid="text-tx-date">{xrplTimeToDate(data.date)}</p>
            </div>
          </div>

          {Object.keys(raw).length > 0 && (
            <details className="mt-2">
              <summary className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground cursor-pointer" data-testid="button-raw-toggle">
                RAW TRANSACTION DATA
              </summary>
              <pre className="mt-2 text-[10px] font-mono text-muted-foreground overflow-auto max-h-60 bg-muted/20 p-3 rounded-md" data-testid="text-raw-data">
                {JSON.stringify(raw, null, 2)}
              </pre>
            </details>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AccountDetail({ data, transactions }: { data: AccountInfo; transactions: TransactionInfo[] }) {
  return (
    <motion.div variants={containerVariants} initial="hidden" animate="visible" className="space-y-4" data-testid="section-account-detail">
      <motion.div variants={itemVariants}>
        <Card className="cyber-border overflow-visible">
          <CardContent className="p-4 space-y-4">
            <div className="flex items-center gap-2">
              <User className="w-4 h-4 text-primary" />
              <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                Account Info
              </span>
            </div>
            <div className="neon-line" />

            <div className="text-center py-4">
              <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">XRP Balance</p>
              <p
                className="text-4xl font-bold font-mono text-primary text-glow"
                data-testid="text-account-balance"
              >
                {formatXrpBalance(data.balance)}
              </p>
              <p className="text-sm text-muted-foreground font-mono mt-1">XRP</p>
            </div>

            <div className="neon-line" />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Address</p>
                <p className="text-xs font-mono text-primary/80 break-all" data-testid="text-account-address">{data.address}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Sequence</p>
                <p className="text-sm font-mono" data-testid="text-account-sequence">{data.sequence.toLocaleString()}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Owner Count</p>
                <p className="text-sm font-mono" data-testid="text-account-owner-count">{data.ownerCount}</p>
              </div>
              <div className="space-y-1">
                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Flags</p>
                <p className="text-sm font-mono" data-testid="text-account-flags">{data.flags}</p>
              </div>
              {data.previousTxnID && (
                <div className="space-y-1 sm:col-span-2">
                  <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Previous TxnID</p>
                  <p className="text-xs font-mono text-muted-foreground break-all" data-testid="text-account-prev-txn">{data.previousTxnID}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {transactions.length > 0 && (
        <motion.div variants={itemVariants}>
          <Card className="cyber-border overflow-visible">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Recent Transactions
                </span>
              </div>
              <div className="neon-line mb-3" />
              <div className="space-y-2">
                {transactions.map((tx, i) => {
                  const isSuccess = tx.result === "tesSUCCESS";
                  return (
                    <div
                      key={tx.hash || i}
                      className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/20 flex-wrap"
                      data-testid={`row-account-tx-${i}`}
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        {isSuccess ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                        ) : (
                          <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-mono truncate">{tx.type}</p>
                          <p className="text-[10px] font-mono text-muted-foreground truncate">{tx.hash}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        {tx.amount && (
                          <p className="text-xs font-mono text-primary">{dropsToXrp(tx.amount)} XRP</p>
                        )}
                        <p className="text-[10px] font-mono text-muted-foreground">
                          Ledger {tx.ledgerIndex.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  );
}

function FeeSection({ data }: { data: FeeInfo }) {
  return (
    <motion.div variants={itemVariants}>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="section-fees">
        <MetricCard
          icon={TrendingDown}
          label="Minimum Fee"
          value={`${dropsToXrp(data.minimumFee)} XRP`}
          subValue={`${data.minimumFee} drops`}
          testId="card-fee-minimum"
        />
        <MetricCard
          icon={Coins}
          label="Median Fee"
          value={`${dropsToXrp(data.medianFee)} XRP`}
          subValue={`${data.medianFee} drops`}
          testId="card-fee-median"
        />
        <MetricCard
          icon={TrendingUp}
          label="Open Ledger Fee"
          value={`${dropsToXrp(data.openLedgerFee)} XRP`}
          subValue={`${data.openLedgerFee} drops`}
          testId="card-fee-open"
        />
      </div>
    </motion.div>
  );
}

function LedgerGapSection({ completeLedgers }: { completeLedgers: string }) {
  const { ranges, gaps } = parseLedgerGaps(completeLedgers);

  if (ranges.length === 0) return null;

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border overflow-visible" data-testid="section-ledger-gaps">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Layers className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Ledger Coverage
            </span>
          </div>
          <div className="neon-line mb-3" />

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-mono text-muted-foreground">Range:</span>
              <span className="text-sm font-mono text-primary" data-testid="text-ledger-range">{completeLedgers}</span>
            </div>

            {gaps.length === 0 ? (
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-green-500" />
                <span className="text-sm font-mono" data-testid="text-no-gaps">No ledger gaps detected</span>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-sm font-mono" data-testid="text-gaps-found">
                    {gaps.length} gap{gaps.length > 1 ? "s" : ""} detected
                  </span>
                </div>
                {gaps.map(([start, end], i) => (
                  <div
                    key={i}
                    className="flex items-center gap-2 p-2 rounded-md bg-destructive/5"
                    data-testid={`row-gap-${i}`}
                  >
                    <span className="text-xs font-mono text-destructive">
                      Missing: {start.toLocaleString()} - {end.toLocaleString()} ({(end - start + 1).toLocaleString()} ledgers)
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function ExplorerPage() {
  const [searchInput, setSearchInput] = useState("");
  const [activeSearch, setActiveSearch] = useState<{ type: SearchType; value: string }>({ type: "none", value: "" });

  const searchType = detectSearchType(searchInput);

  const { data: feeResp, isLoading: feeLoading } = useQuery<FeeResponse>({
    queryKey: ["/api/node/fee"],
    refetchInterval: 15000,
  });

  const { data: nodeResp } = useQuery<{ status: string; data: NodeInfo | null }>({
    queryKey: ["/api/node/info"],
    refetchInterval: 30000,
  });

  const { data: txResp, isLoading: txLoading } = useQuery<TxResponse>({
    queryKey: ["/api/node/tx", activeSearch.value],
    enabled: activeSearch.type === "tx" && activeSearch.value.length > 0,
  });

  const { data: accountResp, isLoading: accountLoading } = useQuery<AccountResponse>({
    queryKey: ["/api/node/account", activeSearch.value],
    enabled: activeSearch.type === "account" && activeSearch.value.length > 0,
  });

  const { data: accountTxResp, isLoading: accountTxLoading } = useQuery<AccountTxResponse>({
    queryKey: ["/api/node/account", activeSearch.value, "transactions"],
    enabled: activeSearch.type === "account" && activeSearch.value.length > 0,
  });

  function handleSearch() {
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    const type = detectSearchType(trimmed);
    if (type === "none") return;
    setActiveSearch({ type, value: trimmed });
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter") handleSearch();
  }

  const isSearching = (activeSearch.type === "tx" && txLoading) || (activeSearch.type === "account" && (accountLoading || accountTxLoading));
  const completeLedgers = nodeResp?.data?.completeLedgers || "";

  return (
    <div className="p-4 overflow-y-auto h-full">
      <div className="mb-6">
        <div className="relative scanline">
          <h1
            className="text-xl font-bold font-mono uppercase tracking-widest text-glow"
            data-testid="text-page-title"
          >
            Network Explorer
          </h1>
        </div>
        <div className="neon-line mt-2" />
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-4"
      >
        <motion.div variants={itemVariants}>
          <Card className="cyber-border overflow-visible">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Search className="w-4 h-4 text-primary" />
                <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
                  Search
                </span>
              </div>
              <div className="neon-line mb-3" />
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <Input
                    type="search"
                    placeholder="Enter transaction hash or account address (r...)..."
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="font-mono text-sm pr-20"
                    data-testid="input-search"
                  />
                  {searchInput && searchType !== "none" && (
                    <Badge
                      variant="secondary"
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] no-default-active-elevate"
                      data-testid="badge-search-type"
                    >
                      {searchType === "tx" ? "TX HASH" : "ACCOUNT"}
                    </Badge>
                  )}
                </div>
                <Button
                  onClick={handleSearch}
                  disabled={searchType === "none" || !searchInput.trim()}
                  data-testid="button-search"
                >
                  <Search className="w-4 h-4 mr-2" />
                  Search
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {isSearching && (
          <motion.div variants={itemVariants}>
            <Card className="cyber-border overflow-visible">
              <CardContent className="p-4 space-y-3">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          </motion.div>
        )}

        <AnimatePresence>
          {activeSearch.type === "tx" && !txLoading && txResp && (
            <>
              {txResp.status === "connected" && txResp.data ? (
                <TransactionDetail data={txResp.data} />
              ) : (
                <motion.div variants={itemVariants}>
                  <Card className="cyber-border overflow-visible">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <p className="text-sm font-mono" data-testid="text-tx-error">
                        {txResp.message || "Transaction not found"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}

          {activeSearch.type === "account" && !accountLoading && accountResp && (
            <>
              {accountResp.status === "connected" && accountResp.data ? (
                <AccountDetail
                  data={accountResp.data}
                  transactions={accountTxResp?.data || []}
                />
              ) : (
                <motion.div variants={itemVariants}>
                  <Card className="cyber-border overflow-visible">
                    <CardContent className="p-4 flex items-center gap-3">
                      <AlertTriangle className="w-5 h-5 text-amber-500" />
                      <p className="text-sm font-mono" data-testid="text-account-error">
                        {accountResp.message || "Account not found"}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              )}
            </>
          )}
        </AnimatePresence>

        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4 text-primary" />
            <span className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
              Fee Estimator
            </span>
          </div>
        </motion.div>

        {feeLoading ? (
          <motion.div variants={itemVariants}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, i) => (
                <Card key={i} className="cyber-border animate-pulse">
                  <CardContent className="p-4">
                    <Skeleton className="h-4 w-24 mb-2" />
                    <Skeleton className="h-8 w-32" />
                    <Skeleton className="h-3 w-20 mt-2" />
                  </CardContent>
                </Card>
              ))}
            </div>
          </motion.div>
        ) : feeResp?.data ? (
          <FeeSection data={feeResp.data} />
        ) : (
          <motion.div variants={itemVariants}>
            <Card className="cyber-border overflow-visible">
              <CardContent className="p-4 flex items-center gap-3">
                <AlertTriangle className="w-5 h-5 text-muted-foreground" />
                <p className="text-sm font-mono text-muted-foreground" data-testid="text-fee-unavailable">
                  Fee data unavailable
                </p>
              </CardContent>
            </Card>
          </motion.div>
        )}

        {completeLedgers && <LedgerGapSection completeLedgers={completeLedgers} />}
      </motion.div>
    </div>
  );
}
