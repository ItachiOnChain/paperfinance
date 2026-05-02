import { Header } from '@/components/Header';
import Dashboard from '@/components/Dashboard';

export default function Home() {
  return (
    <main className="min-h-screen bg-[#060911]">
      <Header />
      <Dashboard />
    </main>
  );
}
