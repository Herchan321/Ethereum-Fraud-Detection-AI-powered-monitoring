import { Hero } from "@/components/Hero";
import { StatsCards } from "@/components/StatsCards";
import { TransactionTable } from "@/components/TransactionTable";

const Index = () => {
  return (
    <div className="min-h-screen bg-background">
      <Hero />
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <StatsCards />
        <TransactionTable />
      </main>
    </div>
  );
};

export default Index;
