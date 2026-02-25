import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation } from "@tanstack/react-query";
import { connectionConfigSchema, type ConnectionConfig } from "@shared/schema";
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
import { Loader2, Save, Server } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

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
    <div className="p-6 space-y-6 overflow-auto h-full">
      <div>
        <h1
          className="text-2xl font-semibold tracking-tight"
          data-testid="text-settings-title"
        >
          Connection Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Configure the connection to your XRPL node.
        </p>
      </div>

      <Card className="max-w-xl">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-4">
          <Server className="w-5 h-5 text-muted-foreground" />
          <CardTitle className="text-base">Node Connection</CardTitle>
        </CardHeader>
        <CardContent>
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
