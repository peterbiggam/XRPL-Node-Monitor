import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Shield, CheckCircle, XCircle, Clock, Key, Globe, AlertTriangle, GitCompare, Users, UserMinus, UserPlus } from "lucide-react";
import { motion } from "framer-motion";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { ValidatorInfo, AmendmentInfo } from "@shared/schema";

interface ValidatorsResponse {
  status: string;
  data: ValidatorInfo[];
  publisherCount?: number;
  localValidator?: string[];
  message?: string;
}

interface AmendmentsResponse {
  status: string;
  data: AmendmentInfo[];
  message?: string;
}

interface ValidatorInfoResponse {
  status: string;
  data: any;
  message?: string;
}

interface UnlComparisonResponse {
  status: string;
  data: {
    localCount: number;
    unlCount: number;
    matching: number;
    localOnly: number;
    unlOnly: number;
    overlap: number;
    details: {
      inBoth: string[];
      localOnly: string[];
      unlOnly: string[];
    };
  };
  message?: string;
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

function truncateKey(key: string): string {
  if (!key) return "N/A";
  if (key.length <= 20) return key;
  return `${key.slice(0, 10)}...${key.slice(-8)}`;
}

function ValidatorSummary({ validators, publisherCount }: { validators: ValidatorInfo[]; publisherCount: number }) {
  const total = validators.length;
  const unlCount = validators.filter((v) => v.unl).length;

  const stats = [
    { label: "Total Validators", value: total, icon: Shield, testId: "text-total-validators" },
    { label: "UNL Validators", value: unlCount, icon: CheckCircle, testId: "text-unl-validators" },
    { label: "Publisher Lists", value: publisherCount, icon: Globe, testId: "text-publisher-count" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <motion.div key={stat.label} variants={itemVariants}>
          <Card className="cyber-border relative overflow-visible">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-glow" data-testid={stat.testId}>
                  {stat.value}
                </p>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function OwnValidatorInfo({ data }: { data: any }) {
  if (!data) return null;

  const agreement = data.agreement ? `${(parseFloat(data.agreement) * 100).toFixed(1)}%` : "N/A";

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border cyber-glow relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-80" />
        <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
          <CardTitle className="text-sm font-mono tracking-wider uppercase flex items-center gap-2">
            <Key className="w-4 h-4 text-primary" />
            Your Validator Node
          </CardTitle>
          <Badge className="no-default-active-elevate" data-testid="badge-validator-active">
            Active Validator
          </Badge>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-1">
                Agreement
              </p>
              <p className="text-xl font-bold font-mono text-primary text-glow" data-testid="text-validator-agreement">
                {agreement}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-1">
                Validated Ledgers
              </p>
              <p className="text-xl font-bold font-mono" data-testid="text-validated-ledgers">
                {data.validated_ledger_count || data.seq || "N/A"}
              </p>
            </div>
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-1">
                Last Validation
              </p>
              <p className="text-sm font-mono flex items-center gap-1" data-testid="text-last-validation">
                <Clock className="w-3 h-3 text-muted-foreground" />
                {data.last_validation_time || "N/A"}
              </p>
            </div>
          </div>
          {data.pubkey_validator && (
            <div className="mt-3 pt-3 border-t border-border">
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-1">
                Public Key
              </p>
              <p className="text-xs font-mono text-muted-foreground break-all" data-testid="text-validator-pubkey">
                {data.pubkey_validator}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function ValidatorList({ validators }: { validators: ValidatorInfo[] }) {
  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono tracking-wider uppercase flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            Validator List
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">Public Key</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">Domain</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">UNL</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">Agreement</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {validators.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground font-mono text-sm py-8">
                      No validators found
                    </TableCell>
                  </TableRow>
                ) : (
                  validators.map((v, i) => (
                    <TableRow key={v.publicKey || i} data-testid={`row-validator-${i}`}>
                      <TableCell className="font-mono text-xs" data-testid={`text-validator-key-${i}`}>
                        {truncateKey(v.publicKey)}
                      </TableCell>
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {v.domain || "-"}
                      </TableCell>
                      <TableCell>
                        {v.unl ? (
                          <Badge variant="default" className="no-default-active-elevate" data-testid={`badge-unl-${i}`}>
                            <CheckCircle className="w-3 h-3 mr-1" />
                            UNL
                          </Badge>
                        ) : (
                          <Badge variant="secondary" className="no-default-active-elevate" data-testid={`badge-non-unl-${i}`}>
                            Non-UNL
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">
                        {v.agreement || "-"}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function AmendmentSummary({ amendments }: { amendments: AmendmentInfo[] }) {
  const enabled = amendments.filter((a) => a.enabled).length;
  const pending = amendments.filter((a) => !a.enabled && a.supported && !a.vetoed).length;
  const vetoed = amendments.filter((a) => a.vetoed).length;

  const stats = [
    { label: "Enabled", value: enabled, icon: CheckCircle, testId: "text-enabled-amendments" },
    { label: "Pending", value: pending, icon: Clock, testId: "text-pending-amendments" },
    { label: "Vetoed", value: vetoed, icon: XCircle, testId: "text-vetoed-amendments" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      {stats.map((stat) => (
        <motion.div key={stat.label} variants={itemVariants}>
          <Card className="cyber-border relative overflow-visible">
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
            <CardContent className="flex items-center gap-3 py-4">
              <div className="p-2 rounded-md bg-primary/10 cyber-border">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-mono text-glow" data-testid={stat.testId}>
                  {stat.value}
                </p>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
                  {stat.label}
                </p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      ))}
    </div>
  );
}

function AmendmentTable({ amendments }: { amendments: AmendmentInfo[] }) {
  const pending = amendments.filter((a) => !a.enabled && a.supported && !a.vetoed);
  const enabled = amendments.filter((a) => a.enabled);
  const vetoed = amendments.filter((a) => a.vetoed);
  const other = amendments.filter((a) => !a.enabled && !a.supported && !a.vetoed);

  const sorted = [...pending, ...enabled, ...vetoed, ...other];

  function getStatusBadge(a: AmendmentInfo) {
    if (a.enabled) {
      return (
        <Badge variant="default" className="no-default-active-elevate">
          <CheckCircle className="w-3 h-3 mr-1" />
          Enabled
        </Badge>
      );
    }
    if (a.vetoed) {
      return (
        <Badge variant="destructive" className="no-default-active-elevate">
          <XCircle className="w-3 h-3 mr-1" />
          Vetoed
        </Badge>
      );
    }
    if (a.supported && !a.vetoed) {
      return (
        <Badge variant="secondary" className="no-default-active-elevate">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }
    return (
      <Badge variant="secondary" className="no-default-active-elevate">
        Unsupported
      </Badge>
    );
  }

  return (
    <motion.div variants={itemVariants}>
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono tracking-wider uppercase flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" />
            Amendments
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">Name</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">Status</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">Progress</TableHead>
                  <TableHead className="font-mono text-[10px] tracking-widest uppercase">ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground font-mono text-sm py-8">
                      No amendments found
                    </TableCell>
                  </TableRow>
                ) : (
                  sorted.map((a, i) => {
                    const isPending = !a.enabled && a.supported && !a.vetoed;
                    const progressPercent =
                      isPending && a.count != null && a.threshold != null && a.threshold > 0
                        ? Math.min(100, Math.round((a.count / a.threshold) * 100))
                        : null;

                    return (
                      <TableRow key={a.id} data-testid={`row-amendment-${i}`}>
                        <TableCell className="font-mono text-xs font-medium" data-testid={`text-amendment-name-${i}`}>
                          {a.name}
                        </TableCell>
                        <TableCell data-testid={`badge-amendment-status-${i}`}>
                          {getStatusBadge(a)}
                        </TableCell>
                        <TableCell>
                          {progressPercent !== null ? (
                            <div className="flex items-center gap-2 min-w-[120px]">
                              <Progress value={progressPercent} className="h-2 flex-1" />
                              <span className="text-xs font-mono text-muted-foreground whitespace-nowrap" data-testid={`text-amendment-progress-${i}`}>
                                {a.count}/{a.threshold}
                              </span>
                            </div>
                          ) : a.enabled ? (
                            <span className="text-xs font-mono text-muted-foreground">Active</span>
                          ) : (
                            <span className="text-xs font-mono text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-[10px] text-muted-foreground max-w-[150px] truncate" data-testid={`text-amendment-id-${i}`}>
                          {truncateKey(a.id)}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function UnlComparison({ data }: { data: UnlComparisonResponse["data"] }) {
  const overlapColor = data.overlap >= 80 ? "text-green-400" : data.overlap >= 50 ? "text-amber-400" : "text-red-400";

  const stats = [
    { label: "Matching", value: data.matching, icon: Users, testId: "text-unl-matching" },
    { label: "Local Only", value: data.localOnly, icon: UserMinus, testId: "text-unl-local-only" },
    { label: "UNL Only", value: data.unlOnly, icon: UserPlus, testId: "text-unl-unl-only" },
  ];

  return (
    <motion.div variants={itemVariants} className="space-y-4">
      <Card className="cyber-border relative overflow-visible">
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-60" />
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-mono tracking-wider uppercase flex items-center gap-2">
            <GitCompare className="w-4 h-4 text-primary" />
            UNL Comparison
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between gap-2 mb-1">
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
                  Overlap
                </p>
                <p className={`text-sm font-bold font-mono ${overlapColor}`} data-testid="text-unl-overlap">
                  {data.overlap.toFixed(1)}%
                </p>
              </div>
              <Progress value={data.overlap} className="h-2" data-testid="progress-unl-overlap" />
            </div>
            <div className="flex items-center gap-4 flex-wrap">
              <div className="text-center">
                <p className="text-lg font-bold font-mono" data-testid="text-unl-local-count">{data.localCount}</p>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">Local</p>
              </div>
              <div className="text-center">
                <p className="text-lg font-bold font-mono" data-testid="text-unl-count">{data.unlCount}</p>
                <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">UNL</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {stats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-2 p-2 rounded-md bg-primary/5">
                <stat.icon className="w-4 h-4 text-primary" />
                <div>
                  <p className="text-lg font-bold font-mono" data-testid={stat.testId}>{stat.value}</p>
                  <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>

          {data.details.inBoth.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-2">
                In Both ({data.details.inBoth.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {data.details.inBoth.slice(0, 20).map((key) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Badge variant="default" className="no-default-active-elevate font-mono text-[10px]" data-testid={`badge-in-both-${key.slice(0, 8)}`}>
                        {truncateKey(key)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs break-all max-w-[300px]">{key}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {data.details.inBoth.length > 20 && (
                  <Badge variant="secondary" className="no-default-active-elevate font-mono text-[10px]">
                    +{data.details.inBoth.length - 20} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {data.details.localOnly.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-2">
                Local Only ({data.details.localOnly.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {data.details.localOnly.slice(0, 20).map((key) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="no-default-active-elevate font-mono text-[10px]" data-testid={`badge-local-only-${key.slice(0, 8)}`}>
                        {truncateKey(key)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs break-all max-w-[300px]">{key}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {data.details.localOnly.length > 20 && (
                  <Badge variant="secondary" className="no-default-active-elevate font-mono text-[10px]">
                    +{data.details.localOnly.length - 20} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {data.details.unlOnly.length > 0 && (
            <div>
              <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono mb-2">
                UNL Only ({data.details.unlOnly.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {data.details.unlOnly.slice(0, 20).map((key) => (
                  <Tooltip key={key}>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="no-default-active-elevate font-mono text-[10px]" data-testid={`badge-unl-only-${key.slice(0, 8)}`}>
                        {truncateKey(key)}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p className="font-mono text-xs break-all max-w-[300px]">{key}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                {data.details.unlOnly.length > 20 && (
                  <Badge variant="secondary" className="no-default-active-elevate font-mono text-[10px]">
                    +{data.details.unlOnly.length - 20} more
                  </Badge>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-6 p-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-64" />
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <Skeleton className="h-96" />
    </div>
  );
}

export default function ValidatorsPage() {
  const { data: validatorsData, isLoading: validatorsLoading } = useQuery<ValidatorsResponse>({
    queryKey: ["/api/node/validators"],
    refetchInterval: 30000,
  });

  const { data: amendmentsData, isLoading: amendmentsLoading } = useQuery<AmendmentsResponse>({
    queryKey: ["/api/node/amendments"],
    refetchInterval: 30000,
  });

  const { data: validatorInfoData } = useQuery<ValidatorInfoResponse>({
    queryKey: ["/api/node/validator-info"],
    refetchInterval: 30000,
  });

  const { data: unlComparisonData } = useQuery<UnlComparisonResponse>({
    queryKey: ["/api/node/unl-comparison"],
    refetchInterval: 30000,
  });

  const isLoading = validatorsLoading || amendmentsLoading;

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  const validators = validatorsData?.data || [];
  const amendments = amendmentsData?.data || [];
  const publisherCount = validatorsData?.publisherCount || 0;
  const ownValidatorData = validatorInfoData?.data || null;

  return (
    <motion.div
      className="space-y-6 p-6"
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      data-testid="page-validators"
    >
      <motion.div variants={itemVariants}>
        <div className="flex items-center gap-3 flex-wrap">
          <div className="p-2 rounded-md bg-primary/10 cyber-border">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold font-mono tracking-wider uppercase text-glow" data-testid="text-page-title">
              Validators & Amendments
            </h1>
            <p className="text-[10px] tracking-widest uppercase text-muted-foreground font-mono">
              Network consensus & protocol features
            </p>
          </div>
        </div>
      </motion.div>

      {ownValidatorData && <OwnValidatorInfo data={ownValidatorData} />}

      <ValidatorSummary validators={validators} publisherCount={publisherCount} />
      <ValidatorList validators={validators} />

      {unlComparisonData?.data && <UnlComparison data={unlComparisonData.data} />}

      <motion.div variants={itemVariants}>
        <div className="neon-line my-2" />
      </motion.div>

      <AmendmentSummary amendments={amendments} />
      <AmendmentTable amendments={amendments} />
    </motion.div>
  );
}
