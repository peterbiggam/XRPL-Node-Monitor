import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { BookOpen, Hash, Clock, FileText, Layers, ArrowRightLeft, CheckCircle, XCircle, User, ExternalLink, Copy, Search } from "lucide-react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";
import type { LedgerInfo, TransactionInfo, MetricsSnapshot } from "@shared/schema";

interface LedgerResponse {
  status: string;
  data: LedgerInfo | null;
  message?: string;
}

interface LedgerTxResponse {
  status: string;
  data: TransactionInfo[];
  ledgerIndex: number;
  ledgerHash: string;
  message?: string;
}

interface TxDetailResponse {
  status: string;
  data: any;
  message?: string;
}

function formatHash(hash: string): string {
  if (!hash) return "N/A";
  return hash.slice(0, 8) + "..." + hash.slice(-8);
}

function formatCloseTime(closeTime: number): string {
  if (!closeTime) return "N/A";
  const rippleEpoch = 946684800;
  const date = new Date((closeTime + rippleEpoch) * 1000);
  return date.toLocaleString();
}

function truncateAccount(account: string): string {
  if (!account) return "N/A";
  if (account.length <= 14) return account;
  return account.slice(0, 8) + "..." + account.slice(-6);
}

function formatDrops(drops?: string): string {
  if (!drops) return "N/A";
  const num = Number(drops);
  if (isNaN(num)) return drops;
  return (num / 1_000_000).toFixed(6) + " XRP";
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.05 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

function LedgerDetailCard({ ledger }: { ledger: LedgerInfo }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Latest Validated Ledger</CardTitle>
          <Badge variant="default" className="no-default-active-elevate shadow-glow-sm" data-testid="badge-ledger-status">
            Validated
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ledger Index</p>
                <p className="text-lg font-mono font-semibold text-primary text-glow" data-testid="text-ledger-index">
                  {ledger.ledgerIndex.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <Hash className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Ledger Hash</p>
                <p className="text-sm font-mono text-primary/80" data-testid="text-ledger-hash" title={ledger.ledgerHash}>
                  {formatHash(ledger.ledgerHash)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <Clock className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Close Time</p>
                <p className="text-sm" data-testid="text-close-time">
                  {ledger.closeTimeHuman || formatCloseTime(ledger.closeTime)}
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <ArrowRightLeft className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider">Transactions</p>
                <p className="text-lg font-semibold font-mono text-primary text-glow" data-testid="text-tx-count">
                  {ledger.transactionCount}
                </p>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Parent Hash</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-parent-hash" title={ledger.parentHash}>
                {formatHash(ledger.parentHash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Account Hash</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-account-hash" title={ledger.accountHash}>
                {formatHash(ledger.accountHash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Tx Hash</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-tx-hash" title={ledger.txHash}>
                {formatHash(ledger.txHash)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground uppercase tracking-wider">Total Coins (drops)</span>
              <span className="text-xs font-mono text-primary/70" data-testid="text-total-coins">
                {ledger.totalCoins ? Number(ledger.totalCoins).toLocaleString() : "N/A"}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function RecentLedgersTable({ currentLedger }: { currentLedger: LedgerInfo }) {
  const recentLedgers = Array.from({ length: 10 }, (_, i) => ({
    index: currentLedger.ledgerIndex - i,
    isCurrent: i === 0,
  }));

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Recent Ledgers</CardTitle>
          <FileText className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            {recentLedgers.map((l, i) => (
              <motion.div
                key={l.index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                className={`flex items-center justify-between gap-2 p-2 rounded-md ${l.isCurrent ? "bg-primary/5 cyber-border" : ""}`}
                data-testid={`row-ledger-${l.index}`}
              >
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="relative flex h-2 w-2">
                    <span className={`absolute inline-flex h-full w-full rounded-full ${l.isCurrent ? "bg-primary animate-ping opacity-40" : ""}`} />
                    <span className={`relative inline-flex rounded-full h-2 w-2 ${l.isCurrent ? "bg-primary shadow-glow-sm" : "bg-primary/30"}`} />
                  </span>
                  <span className="font-mono text-sm font-medium">
                    #{l.index.toLocaleString()}
                  </span>
                  {l.isCurrent && (
                    <Badge variant="secondary" className="no-default-active-elevate text-xs">
                      Latest
                    </Badge>
                  )}
                </div>
                {l.isCurrent && (
                  <span className="text-xs text-muted-foreground font-mono">
                    {currentLedger.transactionCount} txns
                  </span>
                )}
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function TxDetailField({ label, value, mono = true, copyable = false }: {
  label: string;
  value: string | number | undefined | null;
  mono?: boolean;
  copyable?: boolean;
}) {
  const { toast } = useToast();
  const displayValue = value == null || value === "" ? "N/A" : String(value);

  const handleCopy = () => {
    if (displayValue !== "N/A") {
      navigator.clipboard.writeText(displayValue);
      toast({ title: "Copied", description: `${label} copied to clipboard` });
    }
  };

  return (
    <div className="flex items-start justify-between gap-2 py-1.5 border-b border-primary/5 last:border-0">
      <span className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono shrink-0">
        {label}
      </span>
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs text-right break-all ${mono ? "font-mono text-primary/80" : ""}`}>
          {displayValue}
        </span>
        {copyable && displayValue !== "N/A" && (
          <button
            onClick={handleCopy}
            className="shrink-0 p-0.5 rounded hover:bg-primary/10 transition-colors"
            data-testid={`btn-copy-${label.toLowerCase().replace(/\s/g, "-")}`}
          >
            <Copy className="w-3 h-3 text-muted-foreground hover:text-primary" />
          </button>
        )}
      </div>
    </div>
  );
}

function TransactionDetailDialog({
  txHash,
  open,
  onClose,
}: {
  txHash: string;
  open: boolean;
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery<TxDetailResponse>({
    queryKey: ["/api/node/tx", txHash],
    enabled: open && !!txHash,
  });

  const tx = data?.data;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto cyber-border bg-background/95 backdrop-blur-sm border-primary/20">
        <DialogHeader>
          <DialogTitle className="font-mono text-sm tracking-wider uppercase flex items-center gap-2">
            <Search className="w-4 h-4 text-primary" />
            Transaction Details
          </DialogTitle>
        </DialogHeader>

        {isLoading ? (
          <div className="space-y-3 py-4">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-6 w-full" />
            ))}
          </div>
        ) : !tx ? (
          <div className="flex flex-col items-center justify-center py-8">
            <XCircle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-muted-foreground font-mono" data-testid="text-tx-not-found">
              {data?.message || "Transaction not found"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <Card className="cyber-border">
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 mb-3">
                  <Badge
                    variant={tx.meta?.TransactionResult === "tesSUCCESS" || tx.TransactionResult === "tesSUCCESS" ? "default" : "destructive"}
                    className="no-default-active-elevate"
                    data-testid="badge-tx-result"
                  >
                    {(tx.meta?.TransactionResult || tx.TransactionResult || tx.validated === true) ? (
                      <>
                        {(tx.meta?.TransactionResult || tx.TransactionResult) === "tesSUCCESS" ? (
                          <CheckCircle className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {tx.meta?.TransactionResult || tx.TransactionResult || "Unknown"}
                      </>
                    ) : "Pending"}
                  </Badge>
                  <Badge variant="secondary" className="no-default-active-elevate" data-testid="badge-tx-type-detail">
                    {tx.TransactionType || "Unknown"}
                  </Badge>
                  {tx.validated && (
                    <Badge variant="outline" className="no-default-active-elevate text-green-400 border-green-400/30">
                      Validated
                    </Badge>
                  )}
                </div>

                <TxDetailField label="Hash" value={tx.hash} copyable />
                <TxDetailField label="Type" value={tx.TransactionType} />
                <TxDetailField label="Account" value={tx.Account} copyable />
                {tx.Destination && <TxDetailField label="Destination" value={tx.Destination} copyable />}
                {tx.Amount && (
                  <TxDetailField
                    label="Amount"
                    value={typeof tx.Amount === "string" ? formatDrops(tx.Amount) : `${tx.Amount.value} ${tx.Amount.currency}`}
                  />
                )}
                <TxDetailField label="Fee" value={formatDrops(tx.Fee)} />
                <TxDetailField label="Sequence" value={tx.Sequence} />
                <TxDetailField label="Ledger Index" value={tx.ledger_index || tx.inLedger} />
                {tx.date && (
                  <TxDetailField label="Date" value={formatCloseTime(tx.date)} mono={false} />
                )}
                {tx.SigningPubKey && <TxDetailField label="Signing Key" value={tx.SigningPubKey} copyable />}
                {tx.TxnSignature && <TxDetailField label="Signature" value={formatHash(tx.TxnSignature)} copyable />}
              </CardContent>
            </Card>

            {tx.Memos && tx.Memos.length > 0 && (
              <Card className="cyber-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono tracking-wider uppercase">Memos</CardTitle>
                </CardHeader>
                <CardContent>
                  {tx.Memos.map((m: any, i: number) => {
                    const memo = m.Memo || {};
                    let memoData = memo.MemoData || "";
                    try {
                      const bytes = new Uint8Array(memoData.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) || []);
                      memoData = new TextDecoder().decode(bytes);
                    } catch {}
                    let memoType = memo.MemoType || "";
                    try {
                      const bytes = new Uint8Array(memoType.match(/.{1,2}/g)?.map((b: string) => parseInt(b, 16)) || []);
                      memoType = new TextDecoder().decode(bytes);
                    } catch {}
                    return (
                      <div key={i} className="py-1.5 border-b border-primary/5 last:border-0">
                        {memoType && (
                          <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">{memoType}</p>
                        )}
                        <p className="text-xs font-mono text-primary/80 break-all">{memoData || memo.MemoData || "-"}</p>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            )}

            {tx.meta?.AffectedNodes && (
              <Card className="cyber-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono tracking-wider uppercase">
                    Affected Nodes ({tx.meta.AffectedNodes.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-1 max-h-[200px] overflow-y-auto">
                    {tx.meta.AffectedNodes.map((node: any, i: number) => {
                      const nodeType = Object.keys(node)[0] || "Unknown";
                      const nodeData = node[nodeType] || {};
                      return (
                        <div key={i} className="flex items-center gap-2 p-1.5 rounded bg-muted/20 text-xs font-mono" data-testid={`row-affected-node-${i}`}>
                          <Badge variant="outline" className="no-default-active-elevate text-[10px] shrink-0">
                            {nodeType.replace("Node", "")}
                          </Badge>
                          <span className="text-muted-foreground truncate">
                            {nodeData.LedgerEntryType || "-"}
                          </span>
                          {nodeData.LedgerIndex && (
                            <span className="text-primary/50 truncate ml-auto">
                              {formatHash(nodeData.LedgerIndex)}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {tx.meta?.delivered_amount && (
              <Card className="cyber-border">
                <CardHeader className="pb-2">
                  <CardTitle className="text-xs font-mono tracking-wider uppercase">Delivery</CardTitle>
                </CardHeader>
                <CardContent>
                  <TxDetailField
                    label="Delivered Amount"
                    value={typeof tx.meta.delivered_amount === "string"
                      ? formatDrops(tx.meta.delivered_amount)
                      : `${tx.meta.delivered_amount?.value} ${tx.meta.delivered_amount?.currency}`
                    }
                  />
                </CardContent>
              </Card>
            )}

            <div className="flex justify-end">
              <a
                href={`https://livenet.xrpl.org/transactions/${tx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-mono text-primary/60 hover:text-primary transition-colors"
                data-testid="link-xrpl-explorer"
              >
                <ExternalLink className="w-3 h-3" />
                View on XRPL Explorer
              </a>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function LedgerTransactions() {
  const [selectedTx, setSelectedTx] = useState<string | null>(null);
  const [filterType, setFilterType] = useState<string>("all");

  const { data, isLoading } = useQuery<LedgerTxResponse>({
    queryKey: ["/api/node/ledger-transactions"],
    refetchInterval: 5000,
  });

  const transactions = data?.data || [];
  const txTypes = Array.from(new Set(transactions.map(tx => tx.type))).sort();

  const filtered = filterType === "all"
    ? transactions
    : transactions.filter(tx => tx.type === filterType);

  return (
    <>
      <motion.div variants={itemVariants}>
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tracking-wide uppercase flex items-center gap-2">
              <ArrowRightLeft className="w-4 h-4 text-primary" />
              Ledger Transactions
            </CardTitle>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary" className="no-default-active-elevate" data-testid="badge-ledger-tx-count">
                {transactions.length} txns
              </Badge>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full rounded-full bg-red-500 animate-ping opacity-50" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
                </span>
                <span className="text-xs font-mono uppercase tracking-wider text-red-500">Live</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {txTypes.length > 1 && (
              <div className="flex items-center gap-1.5 mb-3 flex-wrap">
                <button
                  onClick={() => setFilterType("all")}
                  className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${
                    filterType === "all"
                      ? "bg-primary/20 text-primary cyber-border"
                      : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                  }`}
                  data-testid="btn-filter-all"
                >
                  All ({transactions.length})
                </button>
                {txTypes.map((type) => {
                  const count = transactions.filter(tx => tx.type === type).length;
                  return (
                    <button
                      key={type}
                      onClick={() => setFilterType(type)}
                      className={`px-2 py-1 text-[10px] font-mono uppercase tracking-wider rounded transition-colors ${
                        filterType === type
                          ? "bg-primary/20 text-primary cyber-border"
                          : "text-muted-foreground hover:text-primary hover:bg-primary/5"
                      }`}
                      data-testid={`btn-filter-${type}`}
                    >
                      {type} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8">
                <ArrowRightLeft className="w-8 h-8 text-primary/30 mb-2" />
                <p className="text-muted-foreground text-sm font-mono" data-testid="text-no-ledger-txns">
                  No transactions in this ledger
                </p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase w-8"></TableHead>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase">Hash</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase">Type</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase">Account</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase">Destination</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase text-right">Amount</TableHead>
                      <TableHead className="font-mono text-[10px] tracking-widest uppercase text-right">Fee</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <AnimatePresence mode="popLayout">
                      {filtered.map((tx, i) => {
                        const success = tx.result === "tesSUCCESS";
                        return (
                          <motion.tr
                            key={tx.hash || i}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ delay: i * 0.02, duration: 0.2 }}
                            className="cursor-pointer hover:bg-primary/5 transition-colors group border-b border-border"
                            onClick={() => setSelectedTx(tx.hash)}
                            data-testid={`row-ledger-tx-${i}`}
                          >
                            <TableCell className="py-2 px-2">
                              {success ? (
                                <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                              ) : (
                                <XCircle className="w-3.5 h-3.5 text-red-500" />
                              )}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-xs">
                              <span className="text-primary/70 group-hover:text-primary transition-colors" data-testid={`text-ledger-tx-hash-${i}`}>
                                {formatHash(tx.hash)}
                              </span>
                            </TableCell>
                            <TableCell className="py-2">
                              <Badge variant="secondary" className="no-default-active-elevate text-[10px]" data-testid={`badge-ledger-tx-type-${i}`}>
                                {tx.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="py-2 font-mono text-xs text-muted-foreground" data-testid={`text-ledger-tx-account-${i}`}>
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3 text-muted-foreground/50" />
                                {truncateAccount(tx.account)}
                              </span>
                            </TableCell>
                            <TableCell className="py-2 font-mono text-xs text-muted-foreground">
                              {tx.destination ? truncateAccount(tx.destination) : "-"}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-xs text-right text-primary/80">
                              {tx.amount ? formatDrops(tx.amount) : "-"}
                            </TableCell>
                            <TableCell className="py-2 font-mono text-[10px] text-right text-muted-foreground">
                              {formatDrops(tx.fee)}
                            </TableCell>
                          </motion.tr>
                        );
                      })}
                    </AnimatePresence>
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {selectedTx && (
        <TransactionDetailDialog
          txHash={selectedTx}
          open={!!selectedTx}
          onClose={() => setSelectedTx(null)}
        />
      )}
    </>
  );
}

function CloseTimeChart() {
  const { data: snapshots } = useQuery<MetricsSnapshot[]>({
    queryKey: [`/api/metrics/history?hours=1`],
    refetchInterval: 30000,
  });

  const chartData = (snapshots || [])
    .filter((s) => s.closeTimeMs != null && s.closeTimeMs > 0)
    .map((s) => ({
      time: new Date(s.timestamp!).toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit" }),
      closeTime: Number((s.closeTimeMs! / 1000).toFixed(2)),
    }));

  if (chartData.length === 0) {
    return (
      <motion.div variants={itemVariants}>
        <Card className="cyber-border relative overflow-visible">
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium tracking-wide uppercase">Ledger Close Times</CardTitle>
            <Clock className="w-4 h-4 text-primary/60" />
          </CardHeader>
          <CardContent>
            <div className="h-64 flex items-center justify-center">
              <p className="text-sm text-muted-foreground font-mono" data-testid="text-no-close-time-data">
                Collecting close time data...
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium tracking-wide uppercase">Ledger Close Times</CardTitle>
          <Clock className="w-4 h-4 text-primary/60" />
        </CardHeader>
        <CardContent>
          <div className="h-64" data-testid="chart-close-times">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="closeTimeGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                />
                <YAxis
                  domain={["auto", "auto"]}
                  tickFormatter={(v) => `${v}s`}
                  tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  tickLine={false}
                  width={40}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid rgba(0, 230, 255, 0.2)",
                    borderRadius: "6px",
                    fontSize: "12px",
                    boxShadow: "0 0 15px rgba(0, 230, 255, 0.1)",
                  }}
                  formatter={(value: number) => [`${value.toFixed(2)}s`, "Close Time"]}
                />
                <Area
                  type="monotone"
                  dataKey="closeTime"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  fill="url(#closeTimeGradient)"
                  style={{ filter: "drop-shadow(0 0 4px hsl(var(--chart-1)))" }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LedgerSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-8 w-48 cyber-glow" />
        <Skeleton className="h-5 w-20 cyber-glow" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Skeleton className="h-72 cyber-glow" />
        <Skeleton className="h-72 cyber-glow" />
      </div>
      <Skeleton className="h-72 cyber-glow" />
      <Skeleton className="h-96 cyber-glow" />
    </div>
  );
}

export default function LedgerPage() {
  const { data, isLoading, isError } = useQuery<LedgerResponse>({
    queryKey: ["/api/node/ledger"],
    refetchInterval: 5000,
  });

  if (isLoading) return <LedgerSkeleton />;

  const ledger = data?.data;
  const isDisconnected = !ledger || data?.status === "disconnected";

  if (isError || isDisconnected) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center gap-3 flex-wrap">
          <BookOpen className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-semibold uppercase tracking-widest text-glow">Ledger Explorer</h1>
        </div>
        <div className="neon-line" />
        <Card className="cyber-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="w-12 h-12 text-primary/30 mb-4" />
            <p className="text-muted-foreground text-center font-mono" data-testid="text-ledger-error">
              {data?.message || "Unable to connect to XRPL node. Check your connection settings."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <motion.div
      className="p-6 space-y-6 overflow-auto h-full"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
    >
      <motion.div variants={itemVariants} className="flex items-center gap-3 flex-wrap">
        <BookOpen className="w-6 h-6 text-primary" />
        <h1 className="text-xl font-semibold uppercase tracking-widest text-glow" data-testid="text-page-title">
          Ledger Explorer
        </h1>
      </motion.div>

      <motion.div variants={itemVariants}>
        <div className="neon-line" />
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <LedgerDetailCard ledger={ledger} />
        <RecentLedgersTable currentLedger={ledger} />
      </div>

      <LedgerTransactions />

      <CloseTimeChart />
    </motion.div>
  );
}
