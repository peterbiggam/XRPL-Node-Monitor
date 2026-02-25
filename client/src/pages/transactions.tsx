import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRightLeft, RefreshCw, Hash, User, DollarSign, CheckCircle, XCircle } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import type { TransactionInfo } from "@shared/schema";

interface TransactionsResponse {
  status: string;
  data: TransactionInfo[] | null;
  message?: string;
}

function truncateAccount(account: string): string {
  if (!account) return "N/A";
  if (account.length <= 12) return account;
  return account.slice(0, 6) + "..." + account.slice(-6);
}

function formatAmount(amount?: string): string {
  if (!amount) return "N/A";
  const drops = Number(amount);
  if (isNaN(drops)) return amount;
  return (drops / 1_000_000).toFixed(6) + " XRP";
}

function isSuccess(result: string): boolean {
  return result === "tesSUCCESS";
}

const TX_TYPE_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

function TransactionTypeChart({ transactions }: { transactions: TransactionInfo[] }) {
  const typeCounts: Record<string, number> = {};
  for (const tx of transactions) {
    typeCounts[tx.type] = (typeCounts[tx.type] || 0) + 1;
  }

  const chartData = Object.entries(typeCounts)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value);

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Transaction Types</CardTitle>
        </CardHeader>
        <CardContent className="flex items-center justify-center py-8">
          <p className="text-muted-foreground text-sm">No transaction data</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Transaction Types</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-64" data-testid="chart-tx-types">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={chartData}
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                dataKey="value"
              >
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={TX_TYPE_COLORS[index % TX_TYPE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "6px",
                  fontSize: "12px",
                }}
              />
              <Legend
                wrapperStyle={{ fontSize: "12px" }}
                formatter={(value) => <span style={{ color: "hsl(var(--foreground))" }}>{value}</span>}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionFeed({ transactions }: { transactions: TransactionInfo[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">Recent Transactions</CardTitle>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="secondary" className="no-default-active-elevate" data-testid="badge-tx-count">
            {transactions.length} txns
          </Badge>
          <RefreshCw className="w-3 h-3 text-muted-foreground animate-spin" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-[500px] overflow-auto">
          {transactions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <ArrowRightLeft className="w-8 h-8 text-muted-foreground mb-2" />
              <p className="text-muted-foreground text-sm">No transactions in this ledger</p>
            </div>
          ) : (
            transactions.map((tx, index) => (
              <div
                key={tx.hash || index}
                className="flex items-center justify-between gap-3 p-3 rounded-md bg-muted/50"
                data-testid={`row-tx-${index}`}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-1.5 rounded-md bg-muted">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="secondary" className="no-default-active-elevate text-xs" data-testid={`badge-tx-type-${index}`}>
                        {tx.type}
                      </Badge>
                      {isSuccess(tx.result) ? (
                        <CheckCircle className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />
                      ) : (
                        <XCircle className="w-3.5 h-3.5 text-red-500 dark:text-red-400" />
                      )}
                    </div>
                    <div className="flex items-center gap-1 mt-1 flex-wrap">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-mono text-muted-foreground" data-testid={`text-tx-account-${index}`}>
                        {truncateAccount(tx.account)}
                      </span>
                      {tx.destination && (
                        <>
                          <span className="text-xs text-muted-foreground mx-1">&rarr;</span>
                          <span className="text-xs font-mono text-muted-foreground">
                            {truncateAccount(tx.destination)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  {tx.amount && (
                    <p className="text-sm font-mono" data-testid={`text-tx-amount-${index}`}>
                      {formatAmount(tx.amount)}
                    </p>
                  )}
                  <div className="flex items-center justify-end gap-1 mt-0.5">
                    <DollarSign className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground font-mono">
                      {formatAmount(tx.fee)} fee
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function TransactionsSkeleton() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 flex-wrap">
        <Skeleton className="h-8 w-48" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <Skeleton className="h-96" />
        </div>
        <Skeleton className="h-96" />
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const { data, isLoading, isError } = useQuery<TransactionsResponse>({
    queryKey: ["/api/node/transactions"],
    refetchInterval: 5000,
  });

  if (isLoading) return <TransactionsSkeleton />;

  const transactions = data?.data;
  const isDisconnected = !transactions || data?.status === "disconnected";

  if (isError || isDisconnected) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="flex items-center gap-3 flex-wrap">
          <ArrowRightLeft className="w-6 h-6" />
          <h1 className="text-xl font-semibold">Transactions</h1>
        </div>
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <ArrowRightLeft className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center" data-testid="text-tx-error">
              {data?.message || "Unable to connect to XRPL node. Check your connection settings."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div className="flex items-center gap-3 flex-wrap">
        <ArrowRightLeft className="w-6 h-6" />
        <h1 className="text-xl font-semibold" data-testid="text-page-title">Transactions</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <TransactionFeed transactions={transactions} />
        </div>
        <TransactionTypeChart transactions={transactions} />
      </div>
    </div>
  );
}
