import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, ArrowUpDown, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useWebSocket } from "@/hooks/useWebSocket";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";

type Transaction = {
  hash: string;
  from: string;
  to: string;
  value_eth: number;
  gas_price: number;
  classification: 'LEGITIMATE' | 'SUSPICIOUS' | 'UNKNOWN' | 'ERROR';
  timestamp: string;
  features: {
    total_tx_sent: number;
    total_received: number;
    value_volatility: number;
    total_tx_sent_unique: number;
    mean_value_received: number;
    tx_volatility: number;
    send_receive_imbalance: number;
    unique_behavior_ratio: number;
    is_weekend: number;
    is_night: number;
    is_business_hours: number;
    value_category: number;
    value_anomaly: number;
    frequency_anomaly: number;
    [key: string]: number;
  };
};

export const TransactionTable = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState<"value" | "timestamp">("timestamp");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const { transactions: rawTransactions, isConnected, error, reconnect } = useWebSocket();

  // Convertir les transactions brutes en type Transaction avec valeurs par défaut
  const transactions = rawTransactions.map(tx => ({
    ...tx,
    features: {
      total_tx_sent: tx.features.total_tx_sent || 0,
      total_received: tx.features.total_received || 0,
      value_volatility: tx.features.value_volatility || 0,
      total_tx_sent_unique: tx.features.total_tx_sent_unique || 0,
      mean_value_received: tx.features.mean_value_received || 0,
      tx_volatility: tx.features.tx_volatility || 0,
      send_receive_imbalance: tx.features.send_receive_imbalance || 0,
      unique_behavior_ratio: tx.features.unique_behavior_ratio || 0,
      is_weekend: tx.features.is_weekend || 0,
      is_night: tx.features.is_night || 0,
      is_business_hours: tx.features.is_business_hours || 0,
      value_category: tx.features.value_category || 0,
      value_anomaly: tx.features.value_anomaly || 0,
      frequency_anomaly: tx.features.frequency_anomaly || 0,
      ...tx.features
    }
  })) as Transaction[];

  // Formater les adresses (tronquer au milieu)
  const formatAddress = (address: string) => {
    if (!address) return '';
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  // Obtenir les informations de risque
  const getTransactionRiskInfo = (tx: Transaction) => {
    const info = [];
    if (tx.features.is_night === 1) info.push("🌙 Nuit");
    if (tx.features.is_weekend === 1) info.push("📅 Weekend");
    if (tx.features.value_anomaly === 1) info.push("💰 Montant inhabituel");
    if (tx.features.frequency_anomaly === 1) info.push("⚡ Fréquence suspecte");
    if (tx.features.unique_behavior_ratio > 5) info.push("🔍 Comportement atypique");
    return info.length > 0 ? info.join(" • ") : "Aucun indicateur particulier";
  };

  // Filtrer et trier les transactions
  const filteredData = transactions
    .filter((tx) => 
      tx.hash.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.from.toLowerCase().includes(searchTerm.toLowerCase()) ||
      tx.to.toLowerCase().includes(searchTerm.toLowerCase())
    )
    .sort((a, b) => {
      const aValue = sortBy === "value" ? a.value_eth : new Date(a.timestamp).getTime();
      const bValue = sortBy === "value" ? b.value_eth : new Date(b.timestamp).getTime();
      return sortOrder === "asc" ? (aValue > bValue ? 1 : -1) : (aValue < bValue ? 1 : -1);
    });

  // Toggle du tri
  const toggleSort = (column: "value" | "timestamp") => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Badge de classification
  const getRiskBadge = (classification: Transaction['classification']) => {
    const badges = {
      SUSPICIOUS: <Badge variant="destructive" className="gap-1">⚠️ Suspect</Badge>,
      LEGITIMATE: <Badge variant="default" className="bg-green-500 hover:bg-green-600 gap-1">✅ Légitime</Badge>,
      UNKNOWN: <Badge variant="secondary" className="gap-1">❓ Inconnu</Badge>,
      ERROR: <Badge variant="outline" className="gap-1">❌ Erreur</Badge>
    };
    return badges[classification] || badges.UNKNOWN;
  };

  // Barre de risque visuelle
  const getRiskBar = (features: Transaction['features']) => {
    const riskFactors = [
      features.unique_behavior_ratio > 5,
      features.send_receive_imbalance > 0.7,
      features.value_category > 2,
      features.is_night === 1,
      features.value_anomaly === 1,
      features.frequency_anomaly === 1
    ];
    
    const riskScore = riskFactors.filter(Boolean).length / riskFactors.length;
    
    let colorClass = "bg-green-500";
    if (riskScore > 0.65) colorClass = "bg-red-500";
    else if (riskScore > 0.35) colorClass = "bg-yellow-500";

    return (
      <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
        <div 
          className={`h-full ${colorClass} transition-all duration-500`}
          style={{ width: `${Math.max(5, riskScore * 100)}%` }}
        />
      </div>
    );
  };

  // Statistiques
  const stats = {
    total: transactions.length,
    legitimate: transactions.filter(tx => tx.classification === 'LEGITIMATE').length,
    suspicious: transactions.filter(tx => tx.classification === 'SUSPICIOUS').length
  };

  return (
    <Card className="border-border/50 bg-card/50 backdrop-blur-sm">
      <CardHeader>
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <CardTitle className="text-2xl flex items-center gap-2">
              Analyse des Transactions
              {isConnected ? (
                <Wifi className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-red-500" />
              )}
            </CardTitle>
            <CardDescription>
              Surveillance en temps réel • {stats.total} transactions • 
              <span className="text-green-600 ml-1">{stats.legitimate} légitimes</span> • 
              <span className="text-red-600 ml-1">{stats.suspicious} suspectes</span>
            </CardDescription>
          </div>
          
          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher (hash, adresse)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64 bg-background/50"
              />
            </div>
            
            {!isConnected && (
              <Button 
                onClick={reconnect} 
                variant="outline" 
                size="sm"
                className="gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                Reconnecter
              </Button>
            )}
          </div>
        </div>
        
        {error && (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>⚠️ Problème de connexion</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
      </CardHeader>
      
      <CardContent>
        <div className="rounded-lg border border-border/50 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="w-[150px]">Hash</TableHead>
                <TableHead className="w-[200px]">Adresses</TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => toggleSort("timestamp")} 
                    className="hover:bg-primary/10 gap-1"
                    size="sm"
                  >
                    Date <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead>
                  <Button 
                    variant="ghost" 
                    onClick={() => toggleSort("value")} 
                    className="hover:bg-primary/10 gap-1"
                    size="sm"
                  >
                    Montant <ArrowUpDown className="h-3 w-3" />
                  </Button>
                </TableHead>
                <TableHead className="text-center">TX Envoyées</TableHead>
                <TableHead className="text-center">Volume Total</TableHead>
                <TableHead className="text-center">Classification</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((tx) => (
                <TableRow 
                  key={tx.hash} 
                  className={`hover:bg-primary/5 border-border/50 transition-colors ${
                    tx.classification === 'SUSPICIOUS' ? 'bg-destructive/5' : ''
                  }`}
                >
                  <TableCell className="font-mono text-xs">
                    <span title={tx.hash}>{formatAddress(tx.hash)}</span>
                  </TableCell>
                  
                  <TableCell className="font-mono text-xs">
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">📤</span>
                      <span title={tx.from}>{formatAddress(tx.from)}</span>
                      <span className="text-muted-foreground">📥</span>
                      <span title={tx.to}>{formatAddress(tx.to)}</span>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-sm">
                    {new Date(tx.timestamp).toLocaleString('fr-FR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit'
                    })}
                  </TableCell>
                  
                  <TableCell>
                    <div className="space-y-2 min-w-[200px]">
                      <div className="font-bold text-sm">
                        {tx.value_eth.toFixed(6)} ETH
                      </div>
                      {getRiskBar(tx.features)}
                      <div className="text-xs text-muted-foreground">
                        {getTransactionRiskInfo(tx)}
                      </div>
                    </div>
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {tx.features.total_tx_sent}
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {tx.features.total_received.toFixed(4)} ETH
                  </TableCell>
                  
                  <TableCell className="text-center">
                    {getRiskBadge(tx.classification)}
                  </TableCell>
                </TableRow>
              ))}
              
              {filteredData.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    {!isConnected ? (
                      <div className="flex flex-col items-center gap-2">
                        <WifiOff className="h-8 w-8 text-muted-foreground/50" />
                        <span>Connexion au serveur...</span>
                      </div>
                    ) : searchTerm ? (
                      <div className="flex flex-col items-center gap-2">
                        <Search className="h-8 w-8 text-muted-foreground/50" />
                        <span>Aucune transaction correspondant à "{searchTerm}"</span>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center gap-2">
                        <div className="animate-pulse">⏳</div>
                        <span>En attente de transactions...</span>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        
        {filteredData.length > 0 && (
          <div className="mt-4 text-sm text-muted-foreground text-center">
            Affichage de {filteredData.length} transaction(s) sur {transactions.length} au total
          </div>
        )}
      </CardContent>
    </Card>
  );
};