import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { connectionConfigSchema, type ConnectionConfig, type SavedNode } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Loader2, Save, Server, Plus, Pencil, Trash2, Zap, CircleDot } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useState } from "react";
import { z } from "zod";

const nodeFormSchema = z.object({
  name: z.string().min(1, "Name is required"),
  host: z.string().min(1, "Host is required"),
  wsPort: z.number().int().min(1).max(65535),
  httpPort: z.number().int().min(1).max(65535),
  adminPort: z.number().int().min(1).max(65535),
});
type NodeFormValues = z.infer<typeof nodeFormSchema>;

function NodeStatusDot({ nodeId }: { nodeId: number }) {
  const { data: status } = useQuery<{ status: string; serverState?: string; peers?: number; ledgerSeq?: number }>({
    queryKey: ["/api/nodes", nodeId, "status"],
  });

  if (!status) {
    return <div className="w-2 h-2 rounded-full bg-muted-foreground/30" />;
  }

  const color = status.status === "connected"
    ? "bg-green-500"
    : status.status === "error"
      ? "bg-amber-500"
      : "bg-red-500";

  const glow = status.status === "connected"
    ? "0 0 6px rgba(34, 197, 94, 0.8)"
    : status.status === "error"
      ? "0 0 6px rgba(245, 158, 11, 0.8)"
      : "0 0 6px rgba(239, 68, 68, 0.8)";

  return (
    <div
      className={`w-2 h-2 rounded-full ${color}`}
      style={{ boxShadow: glow }}
      data-testid={`status-node-${nodeId}`}
    />
  );
}

function NodeStatusInfo({ nodeId }: { nodeId: number }) {
  const { data: status } = useQuery<{ status: string; serverState?: string; peers?: number; ledgerSeq?: number }>({
    queryKey: ["/api/nodes", nodeId, "status"],
  });

  if (!status) return null;

  if (status.status === "connected") {
    return (
      <div className="flex items-center gap-2 flex-wrap">
        <Badge variant="outline" className="text-[10px] font-mono">
          {status.serverState}
        </Badge>
        {status.peers !== undefined && (
          <span className="text-[10px] font-mono text-muted-foreground">
            {status.peers} peers
          </span>
        )}
        {status.ledgerSeq !== undefined && (
          <span className="text-[10px] font-mono text-muted-foreground">
            Ledger #{status.ledgerSeq}
          </span>
        )}
      </div>
    );
  }

  return (
    <span className="text-[10px] font-mono text-muted-foreground">
      {status.status === "error" ? "Error connecting" : "Disconnected"}
    </span>
  );
}

function NodeFormDialog({
  node,
  open,
  onOpenChange,
}: {
  node?: SavedNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const isEditing = !!node;

  const form = useForm<NodeFormValues>({
    resolver: zodResolver(nodeFormSchema),
    defaultValues: {
      name: node?.name ?? "",
      host: node?.host ?? "localhost",
      wsPort: node?.wsPort ?? 6006,
      httpPort: node?.httpPort ?? 5005,
      adminPort: node?.adminPort ?? 8080,
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name: node?.name ?? "",
        host: node?.host ?? "localhost",
        wsPort: node?.wsPort ?? 6006,
        httpPort: node?.httpPort ?? 5005,
        adminPort: node?.adminPort ?? 8080,
      });
    }
  }, [open, node, form]);

  const createMutation = useMutation({
    mutationFn: async (data: NodeFormValues) => {
      const res = await apiRequest("POST", "/api/nodes", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      onOpenChange(false);
      toast({ title: "Node added", description: "New node has been saved." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to add node", description: error.message, variant: "destructive" });
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (data: NodeFormValues) => {
      const res = await apiRequest("PUT", `/api/nodes/${node!.id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      onOpenChange(false);
      toast({ title: "Node updated", description: "Node configuration has been updated." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to update node", description: error.message, variant: "destructive" });
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const onSubmit = (data: NodeFormValues) => {
    if (isEditing) {
      updateMutation.mutate(data);
    } else {
      createMutation.mutate(data);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? "Edit Node" : "Add Node"}</DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" data-testid="form-node">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="My XRPL Node" {...field} data-testid="input-node-name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host</FormLabel>
                  <FormControl>
                    <Input placeholder="localhost" {...field} data-testid="input-node-host" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="wsPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WS Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="6006"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-node-ws-port"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="httpPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTTP Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5005"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-node-http-port"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="adminPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="8080"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-node-admin-port"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-testid="button-cancel-node">
                Cancel
              </Button>
              <Button type="submit" disabled={isPending} data-testid="button-save-node">
                {isPending ? <Loader2 className="animate-spin" /> : <Save />}
                {isEditing ? "Update" : "Add Node"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

function NodeList() {
  const { toast } = useToast();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingNode, setEditingNode] = useState<SavedNode | undefined>();

  const { data: nodes, isLoading } = useQuery<SavedNode[]>({
    queryKey: ["/api/nodes"],
  });

  const activateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("POST", `/api/nodes/${id}/activate`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/node"] });
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
      toast({ title: "Active node changed", description: "All data will now come from the new active node." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to activate node", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await apiRequest("DELETE", `/api/nodes/${id}`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/nodes"] });
      toast({ title: "Node deleted", description: "Node has been removed." });
    },
    onError: (error: Error) => {
      toast({ title: "Failed to delete node", description: error.message, variant: "destructive" });
    },
  });

  const handleEdit = (node: SavedNode) => {
    setEditingNode(node);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingNode(undefined);
    setDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  return (
    <>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
        <div>
          <h2 className="text-lg font-semibold" data-testid="text-nodes-heading">Saved Nodes</h2>
          <p className="text-sm text-muted-foreground">
            Manage your XRPL node connections.
          </p>
        </div>
        <Button onClick={handleAdd} data-testid="button-add-node">
          <Plus />
          Add Node
        </Button>
      </div>

      {(!nodes || nodes.length === 0) ? (
        <Card>
          <CardContent className="py-8 text-center">
            <Server className="w-8 h-8 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm text-muted-foreground" data-testid="text-no-nodes">
              No saved nodes yet. Add a node to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {nodes.map((node) => (
            <Card
              key={node.id}
              className={node.isActive ? "cyber-border" : ""}
              data-testid={`card-node-${node.id}`}
            >
              <CardContent className="py-4">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-start gap-3 min-w-0">
                    <div className="mt-1.5">
                      <NodeStatusDot nodeId={node.id} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold font-mono text-sm" data-testid={`text-node-name-${node.id}`}>
                          {node.name}
                        </span>
                        {node.isActive && (
                          <Badge variant="default" className="text-[10px]" data-testid={`badge-active-${node.id}`}>
                            ACTIVE
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5" data-testid={`text-node-host-${node.id}`}>
                        {node.host}:{node.wsPort}
                      </p>
                      <div className="mt-1">
                        <NodeStatusInfo nodeId={node.id} />
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!node.isActive && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => activateMutation.mutate(node.id)}
                        disabled={activateMutation.isPending}
                        data-testid={`button-activate-node-${node.id}`}
                      >
                        <Zap className="w-4 h-4" />
                      </Button>
                    )}
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleEdit(node)}
                      data-testid={`button-edit-node-${node.id}`}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(node.id)}
                      disabled={deleteMutation.isPending || node.isActive}
                      data-testid={`button-delete-node-${node.id}`}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NodeFormDialog
        node={editingNode}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
      />
    </>
  );
}

export default function SettingsPage() {
  const { toast } = useToast();

  const { data: config, isLoading } = useQuery<ConnectionConfig>({
    queryKey: ["/api/connection"],
  });

  const form = useForm<ConnectionConfig>({
    resolver: zodResolver(connectionConfigSchema),
    defaultValues: {
      host: "localhost",
      wsPort: 6006,
      httpPort: 5005,
      adminPort: 8080,
    },
  });

  useEffect(() => {
    if (config) {
      form.reset(config);
    }
  }, [config, form]);

  const mutation = useMutation({
    mutationFn: async (data: ConnectionConfig) => {
      const res = await apiRequest("POST", "/api/connection", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/connection"] });
      queryClient.invalidateQueries({ queryKey: ["/api/node"] });
      toast({
        title: "Settings saved",
        description: "Connection configuration has been updated.",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ConnectionConfig) => {
    mutation.mutate(data);
  };

  if (isLoading) {
    return (
      <div className="p-6 space-y-6 overflow-auto h-full">
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-72" />
        </div>
        <Skeleton className="h-80 w-full max-w-xl" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 overflow-auto h-full">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          data-testid="text-settings-title"
        >
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your XRPL nodes and connection settings.
        </p>
      </div>

      <div className="max-w-xl">
        <NodeList />
      </div>

      <Card className="max-w-xl">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
          <Server className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Default Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground mb-4">
            Fallback connection used when no saved node is active.
          </p>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4"
              data-testid="form-connection"
            >
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="localhost"
                        {...field}
                        data-testid="input-host"
                      />
                    </FormControl>
                    <FormDescription>
                      Hostname or IP address of your XRPL node.
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="wsPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>WebSocket Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="6006"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-ws-port"
                      />
                    </FormControl>
                    <FormDescription>
                      WebSocket port for real-time data (default: 6006).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="httpPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>HTTP Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="5005"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-http-port"
                      />
                    </FormControl>
                    <FormDescription>
                      JSON-RPC HTTP port (default: 5005).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="adminPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Admin Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder="8080"
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        data-testid="input-admin-port"
                      />
                    </FormControl>
                    <FormDescription>
                      Admin port for management commands (default: 8080).
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-2">
                <Button
                  type="submit"
                  disabled={mutation.isPending}
                  data-testid="button-save-settings"
                >
                  {mutation.isPending ? (
                    <Loader2 className="animate-spin" />
                  ) : (
                    <Save />
                  )}
                  Save Settings
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
