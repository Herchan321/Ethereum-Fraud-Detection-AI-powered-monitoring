import { AlertTriangle, CheckCircle, Activity, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { useMemo } from "react";
import { useWebSocket } from "@/hooks/useWebSocket";

export const StatsCards = () => {
  // Reuse the centralized websocket hook which already maintains the latest transactions
  const { transactions } = useWebSocket();

  // Compute dynamic stats from incoming transactions
  const stats = useMemo(() => {
    const total = transactions.length;
    const suspicious = transactions.filter(t => t.classification === 'SUSPICIOUS').length;
    const legitimate = transactions.filter(t => t.classification === 'LEGITIMATE').length;
    const uniqueAddresses = new Set(transactions.flatMap(t => [t.from, t.to]).filter(Boolean)).size;
    const avgValue = total > 0 ? transactions.reduce((s, t) => s + (t.value_eth || 0), 0) / total : 0;

    return [
      {
        title: "Transactions Analysées",
        value: total.toLocaleString(),
        change: "",
        icon: Activity,
        trend: total > 0 ? "up" : "down",
      },
      {
        title: "Cas Suspects",
        value: suspicious.toString(),
        change: total > 0 ? `${((suspicious / total) * 100).toFixed(1)}%` : "0%",
        icon: AlertTriangle,
        trend: "down",
        danger: true,
      },
      {
        title: "Adresses Uniques",
        value: uniqueAddresses.toLocaleString(),
        change: "",
        icon: CheckCircle,
        trend: "up",
        success: true,
      },
      {
        title: "Valeur Moyenne (ETH)",
        value: avgValue.toFixed(4),
        change: "",
        icon: TrendingUp,
        trend: "down",
      },
    ];
  }, [transactions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary/50 transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{stat.title}</p>
                  <p className="text-3xl font-bold">{stat.value}</p>
                  {stat.change && (
                    <p className={`text-xs flex items-center gap-1 ${
                      stat.trend === "up" ? "text-success" : "text-muted-foreground"
                    }`}>
                      <span>{stat.change}</span>
                      <span>vs semaine dernière</span>
                    </p>
                  )}
                </div>
                <div className={`p-3 rounded-xl ${
                  stat.danger 
                    ? "bg-destructive/10 text-destructive" 
                    : stat.success 
                    ? "bg-success/10 text-success"
                    : "bg-primary/10 text-primary"
                }`}>
                  <Icon className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
