import { Shield, Activity, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Hero = () => {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-background via-background to-secondary/20 border-b border-border">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#4f4f4f0a_1px,transparent_1px),linear-gradient(to_bottom,#4f4f4f0a_1px,transparent_1px)] bg-[size:14px_24px]"></div>
      
      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
        <div className="text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-primary">Détection de Fraude IA</span>
          </div>
          
          <h1 className="text-5xl md:text-7xl font-bold bg-gradient-to-r from-foreground via-primary to-accent bg-clip-text text-transparent">
            Sécurisez Ethereum
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Analysez les transactions en temps réel et identifiez automatiquement les comportements suspects avec notre intelligence artificielle avancée.
          </p>
          
          

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-12">
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-primary">84.75</div>
              <div className="text-sm text-muted-foreground">Précision de détection</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-accent">24/7</div>
              <div className="text-sm text-muted-foreground">Surveillance continue</div>
            </div>
            <div className="text-center space-y-2">
              <div className="text-4xl font-bold text-success">1.2M+</div>
              <div className="text-sm text-muted-foreground">Transactions analysées</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
