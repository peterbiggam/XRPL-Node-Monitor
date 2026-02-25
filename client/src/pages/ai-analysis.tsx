import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Brain,
  Send,
  Loader2,
  Settings,
  ChevronDown,
  Activity,
  Server,
  Users,
  Cpu,
  AlertTriangle,
  Sparkles,
  Trash2,
  MessageSquare,
  Bot,
  User,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { AiConfig, AiConversation } from "@shared/schema";

const contextOptions = [
  { value: "general", label: "General", icon: Sparkles, description: "All available node data" },
  { value: "node", label: "Node Health", icon: Activity, description: "Server state, uptime, load factor" },
  { value: "ledger", label: "Ledger Analysis", icon: Server, description: "Latest ledger info, close times" },
  { value: "peers", label: "Peer Network", icon: Users, description: "Connected peers, inbound/outbound" },
  { value: "system", label: "System Resources", icon: Cpu, description: "CPU, memory usage" },
  { value: "alerts", label: "Alert Review", icon: AlertTriangle, description: "Recent alerts and thresholds" },
];

const quickActions = [
  { label: "Analyze Node Health", context: "node", message: "Analyze the current node health status and provide recommendations." },
  { label: "Review Alerts", context: "alerts", message: "Review the recent alerts and identify any patterns or concerns." },
  { label: "Peer Network Assessment", context: "peers", message: "Assess the peer network connectivity and provide insights on network health." },
  { label: "Performance Report", context: "general", message: "Generate a comprehensive performance report for the node." },
];

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  context?: string;
  timestamp?: Date;
}

export default function AiAnalysisPage() {
  const { toast } = useToast();
  const [inputMessage, setInputMessage] = useState("");
  const [selectedContext, setSelectedContext] = useState("general");
  const [sessionId, setSessionId] = useState(() => `session-${Date.now()}`);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [configOpen, setConfigOpen] = useState(false);
  const [aiHost, setAiHost] = useState("localhost");
  const [aiPort, setAiPort] = useState("1234");
  const [aiModel, setAiModel] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingContent, scrollToBottom]);

  const { data: aiConfig } = useQuery<AiConfig>({
    queryKey: ["/api/ai/config"],
  });

  useEffect(() => {
    if (aiConfig) {
      setAiHost(aiConfig.host);
      setAiPort(String(aiConfig.port));
      setAiModel(aiConfig.model || "");
    }
  }, [aiConfig]);

  const { data: sessions, isLoading: sessionsLoading } = useQuery<{ sessionId: string; messageCount: number; lastMessage: string }[]>({
    queryKey: ["/api/ai/sessions"],
  });

  const { data: historyMessages } = useQuery<AiConversation[]>({
    queryKey: ["/api/ai/history", sessionId],
    enabled: !!sessionId,
  });

  useEffect(() => {
    if (historyMessages && historyMessages.length > 0) {
      setMessages(
        historyMessages.map((m) => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          context: m.context || undefined,
          timestamp: new Date(m.timestamp),
        }))
      );
    }
  }, [historyMessages]);

  const saveConfigMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("POST", "/api/ai/config", {
        host: aiHost,
        port: parseInt(aiPort),
        model: aiModel,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/config"] });
      toast({ title: "AI Configuration Saved", description: "LM Studio connection settings updated." });
    },
    onError: (err: Error) => {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    },
  });

  const healthCheckMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/ai/health-check", {
        host: aiHost,
        port: parseInt(aiPort),
      });
      return res.json();
    },
    onSuccess: (data: any) => {
      if (data.status === "connected") {
        toast({ title: "Connection Successful", description: "LM Studio is reachable." });
      } else {
        toast({ title: "Connection Failed", description: data.message || "Unable to reach LM Studio.", variant: "destructive" });
      }
    },
    onError: (err: Error) => {
      toast({ title: "Connection Failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteSessionMutation = useMutation({
    mutationFn: async (sid: string) => {
      await apiRequest("DELETE", `/api/ai/session/${sid}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/ai/sessions"] });
      toast({ title: "Session Deleted" });
    },
  });

  const sendMessage = useCallback(async (msg: string, ctx: string) => {
    if (!msg.trim() || isStreaming) return;

    const userMessage: ChatMessage = { role: "user", content: msg, context: ctx, timestamp: new Date() };
    setMessages((prev) => [...prev, userMessage]);
    setInputMessage("");
    setIsStreaming(true);
    setStreamingContent("");

    try {
      const response = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: msg, sessionId, context: ctx }),
      });

      if (!response.ok) {
        throw new Error(`Server error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("No response stream");

      const decoder = new TextDecoder();
      let fullContent = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const text = decoder.decode(value, { stream: true });
        const lines = text.split("\n").filter((l) => l.startsWith("data: "));

        for (const line of lines) {
          const data = line.slice(6).trim();
          if (data === "[DONE]") {
            setMessages((prev) => [...prev, { role: "assistant", content: fullContent, timestamp: new Date() }]);
            setStreamingContent("");
            setIsStreaming(false);
            queryClient.invalidateQueries({ queryKey: ["/api/ai/sessions"] });
            queryClient.invalidateQueries({ queryKey: ["/api/ai/history", sessionId] });
            return;
          }
          try {
            const parsed = JSON.parse(data);
            if (parsed.error) {
              setMessages((prev) => [...prev, { role: "assistant", content: `Error: ${parsed.error}`, timestamp: new Date() }]);
              setStreamingContent("");
              setIsStreaming(false);
              return;
            }
            if (parsed.content) {
              fullContent += parsed.content;
              setStreamingContent(fullContent);
            }
          } catch {}
        }
      }

      if (fullContent && !messages.find((m) => m.content === fullContent)) {
        setMessages((prev) => [...prev, { role: "assistant", content: fullContent, timestamp: new Date() }]);
      }
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: `Connection error: ${err.message}. Ensure LM Studio is running and accessible.`, timestamp: new Date() },
      ]);
    } finally {
      setStreamingContent("");
      setIsStreaming(false);
    }
  }, [isStreaming, sessionId, messages]);

  const startNewSession = useCallback(() => {
    const newId = `session-${Date.now()}`;
    setSessionId(newId);
    setMessages([]);
    setStreamingContent("");
  }, []);

  const loadSession = useCallback((sid: string) => {
    setSessionId(sid);
    setMessages([]);
    setStreamingContent("");
  }, []);

  const selectedContextInfo = contextOptions.find((c) => c.value === selectedContext);

  return (
    <div className="flex h-full" data-testid="page-ai-analysis">
      <div className="flex flex-col flex-1 min-w-0">
        <div className="p-4 space-y-3">
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <Brain className="w-5 h-5 text-primary" style={{ filter: "drop-shadow(0 0 6px rgba(0, 230, 255, 0.5))" }} />
              <h1 className="text-lg font-bold tracking-tight font-mono text-glow" data-testid="text-page-title">
                AI ANALYSIS
              </h1>
              <Badge variant="secondary" className="no-default-active-elevate" data-testid="badge-session-id">
                {sessionId.slice(0, 20)}...
              </Badge>
            </div>
          </motion.div>

          <Collapsible open={configOpen} onOpenChange={setConfigOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" data-testid="button-toggle-config">
                <Settings className="w-4 h-4 mr-2" />
                LM Studio Settings
                <ChevronDown className={`w-4 h-4 ml-2 transition-transform ${configOpen ? "rotate-180" : ""}`} />
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <Card className="mt-2 cyber-border">
                <CardContent className="p-4">
                  <div className="flex flex-wrap gap-3 items-end">
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-mono text-muted-foreground">Host</label>
                      <Input
                        value={aiHost}
                        onChange={(e) => setAiHost(e.target.value)}
                        className="w-40 font-mono text-sm"
                        data-testid="input-ai-host"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-mono text-muted-foreground">Port</label>
                      <Input
                        value={aiPort}
                        onChange={(e) => setAiPort(e.target.value)}
                        className="w-24 font-mono text-sm"
                        data-testid="input-ai-port"
                      />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs font-mono text-muted-foreground">Model (optional)</label>
                      <Input
                        value={aiModel}
                        onChange={(e) => setAiModel(e.target.value)}
                        className="w-48 font-mono text-sm"
                        placeholder="auto-detect"
                        data-testid="input-ai-model"
                      />
                    </div>
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => saveConfigMutation.mutate()}
                      disabled={saveConfigMutation.isPending}
                      data-testid="button-save-config"
                    >
                      {saveConfigMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => healthCheckMutation.mutate()}
                      disabled={healthCheckMutation.isPending}
                      data-testid="button-health-check"
                    >
                      {healthCheckMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Test Connection"}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </CollapsibleContent>
          </Collapsible>
        </div>

        <div className="px-4 pb-3 flex flex-wrap items-center gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground">Context</label>
            <Select value={selectedContext} onValueChange={setSelectedContext}>
              <SelectTrigger className="w-48 font-mono text-sm" data-testid="select-context">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {contextOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value} data-testid={`select-context-${opt.value}`}>
                    <div className="flex items-center gap-2">
                      <opt.icon className="w-3 h-3" />
                      {opt.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedContextInfo && (
            <div className="text-xs text-muted-foreground font-mono mt-4" data-testid="text-context-description">
              Data included: {selectedContextInfo.description}
            </div>
          )}
        </div>

        <div className="px-4 pb-3 flex flex-wrap gap-2">
          {quickActions.map((action, i) => (
            <Button
              key={i}
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedContext(action.context);
                sendMessage(action.message, action.context);
              }}
              disabled={isStreaming}
              data-testid={`button-quick-${i}`}
            >
              <Sparkles className="w-3 h-3 mr-1" />
              {action.label}
            </Button>
          ))}
        </div>

        <div className="neon-line" />

        <div className="flex-1 overflow-auto p-4 space-y-4" data-testid="container-messages">
          {messages.length === 0 && !isStreaming && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center h-full gap-4 text-muted-foreground"
            >
              <Brain className="w-12 h-12 text-primary opacity-30" style={{ filter: "drop-shadow(0 0 10px rgba(0, 230, 255, 0.3))" }} />
              <p className="text-sm font-mono" data-testid="text-empty-state">Select a context and start chatting with your AI assistant</p>
              <p className="text-xs font-mono text-muted-foreground">Node data will be automatically included based on selected context</p>
            </motion.div>
          )}

          <AnimatePresence>
            {messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`flex gap-2 max-w-[80%] ${msg.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  data-testid={`message-${msg.role}-${i}`}
                >
                  <div className={`flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center ${msg.role === "user" ? "bg-primary/20" : "bg-secondary"}`}>
                    {msg.role === "user" ? (
                      <User className="w-4 h-4 text-primary" />
                    ) : (
                      <Bot className="w-4 h-4 text-primary" />
                    )}
                  </div>
                  <Card className={`cyber-border ${msg.role === "assistant" ? "border-primary/10" : ""}`}>
                    <CardContent className="p-3">
                      <div className="text-sm font-mono whitespace-pre-wrap break-words" data-testid={`text-message-content-${i}`}>
                        {msg.content}
                      </div>
                      {msg.context && (
                        <Badge variant="secondary" className="mt-2 no-default-active-elevate text-[10px]">
                          {contextOptions.find((c) => c.value === msg.context)?.label || msg.context}
                        </Badge>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {isStreaming && streamingContent && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex justify-start"
            >
              <div className="flex gap-2 max-w-[80%]">
                <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-secondary">
                  <Bot className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <Card className="cyber-border border-primary/10">
                  <CardContent className="p-3">
                    <div className="text-sm font-mono whitespace-pre-wrap break-words" data-testid="text-streaming-content">
                      {streamingContent}
                      <span className="inline-block w-2 h-4 bg-primary animate-pulse ml-0.5" />
                    </div>
                  </CardContent>
                </Card>
              </div>
            </motion.div>
          )}

          {isStreaming && !streamingContent && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex justify-start"
            >
              <div className="flex gap-2 items-center">
                <div className="flex-shrink-0 w-7 h-7 rounded-md flex items-center justify-center bg-secondary">
                  <Bot className="w-4 h-4 text-primary animate-pulse" />
                </div>
                <div className="flex items-center gap-2 text-sm font-mono text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  Thinking...
                </div>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        <div className="neon-line" />

        <div className="p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage(inputMessage, selectedContext);
            }}
            className="flex gap-2"
          >
            <Input
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              placeholder="Ask about your XRPL node..."
              className="flex-1 font-mono text-sm"
              disabled={isStreaming}
              data-testid="input-message"
            />
            <Button
              type="submit"
              disabled={isStreaming || !inputMessage.trim()}
              data-testid="button-send"
            >
              {isStreaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </form>
        </div>
      </div>

      <div className="w-64 border-l p-4 hidden lg:flex flex-col gap-3 overflow-auto">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-[10px] font-mono tracking-widest uppercase text-muted-foreground" data-testid="text-sessions-label">
            Sessions
          </span>
          <Button variant="ghost" size="sm" onClick={startNewSession} data-testid="button-new-session">
            <MessageSquare className="w-3 h-3 mr-1" />
            New
          </Button>
        </div>
        <div className="neon-line" />

        {sessionsLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : sessions && sessions.length > 0 ? (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div
                key={s.sessionId}
                className={`p-2 rounded-md cursor-pointer hover-elevate transition-colors ${
                  s.sessionId === sessionId ? "bg-primary/10 cyber-border" : ""
                }`}
                onClick={() => loadSession(s.sessionId)}
                data-testid={`session-${s.sessionId}`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs font-mono truncate flex-1">
                    {s.sessionId.slice(0, 16)}...
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteSessionMutation.mutate(s.sessionId);
                      if (s.sessionId === sessionId) startNewSession();
                    }}
                    data-testid={`button-delete-session-${s.sessionId}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
                <div className="text-[10px] text-muted-foreground font-mono truncate mt-1">
                  {s.lastMessage?.slice(0, 40) || "Empty session"}
                </div>
                <Badge variant="secondary" className="no-default-active-elevate text-[10px] mt-1">
                  {s.messageCount} messages
                </Badge>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground font-mono" data-testid="text-no-sessions">No previous sessions</p>
        )}
      </div>
    </div>
  );
}
