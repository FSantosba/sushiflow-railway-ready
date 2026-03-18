
import React from 'react';
import {
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  BarChart,
} from 'recharts';
import { cmvCategoryData } from '../../utils/mockData';

const data = [
  { name: 'Jul', revenue: 120, target: 110, cmv: 34.2 },
  { name: 'Ago', revenue: 135, target: 115, cmv: 33.8 },
  { name: 'Set', revenue: 125, target: 120, cmv: 35.1 },
  { name: 'Out', revenue: 145, target: 130, cmv: 32.5 },
];

const wasteData = [
  { item: 'Aparas de Salmão', valor: 420.50, motivo: 'Processamento', trend: '+2%' },
  { item: 'Arroz Cozido', valor: 180.20, motivo: 'Excesso de Produção', trend: '-5%' },
  { item: 'Shoyu (Abertos)', valor: 95.00, motivo: 'Vencimento', trend: '0%' },
];

const priceVariance = [
  { item: 'Salmão Chile', last: 72.00, current: 84.50, change: 17.3, status: 'danger' },
  { item: 'Nori Gold', last: 45.00, current: 42.00, change: -6.6, status: 'success' },
  { item: 'Arroz Shari', last: 12.50, current: 12.80, change: 2.4, status: 'warning' },
];

const FinanceDashboard: React.FC = () => {
  return (
    <div className="h-full flex flex-col bg-background-dark overflow-hidden">
      <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
        <div className="space-y-8 animate-in fade-in duration-500">
          {/* Top Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-card-dark border border-border-dark p-5 rounded-xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Receita Bruta</p>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black">R$ 145.2k</span>
                <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span> 5.2%
                </span>
              </div>
            </div>
            <div className="bg-card-dark border border-border-dark p-5 rounded-xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">CMV Médio</p>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black">32.5%</span>
                <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_down</span> 1.1%
                </span>
              </div>
            </div>
            <div className="bg-card-dark border border-border-dark p-5 rounded-xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">EBITDA</p>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black text-primary">R$ 33.1k</span>
                <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">trending_up</span> 2.4%
                </span>
              </div>
            </div>
            <div className="bg-card-dark border border-border-dark p-5 rounded-xl shadow-lg">
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-1">Margem Líquida</p>
              <div className="flex items-end justify-between">
                <span className="text-3xl font-black">22.8%</span>
                <span className="text-slate-500 text-xs font-bold">Estável</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Main DRE Section */}
            <section className="lg:col-span-2 bg-card-dark border border-border-dark rounded-xl overflow-hidden shadow-2xl">
              <div className="px-6 py-4 border-b border-border-dark bg-white/5 flex justify-between items-center">
                <h3 className="text-lg font-black uppercase tracking-tighter">Demonstrativo de Resultados (Cascata)</h3>
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Outubro 2023</span>
              </div>
              <div className="p-0 overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="text-[10px] font-black uppercase text-slate-500 border-b border-border-dark bg-background-dark/30">
                      <th className="px-6 py-3">Conta Financeira</th>
                      <th className="px-6 py-3 text-right">Valor</th>
                      <th className="px-6 py-3 text-right">A.V. %</th>
                    </tr>
                  </thead>
                  <tbody className="text-sm font-medium">
                    <tr className="bg-primary/5 font-bold border-b border-border-dark">
                      <td className="px-6 py-4">RECEITA OPERACIONAL BRUTA</td>
                      <td className="px-6 py-4 text-right">145.200,00</td>
                      <td className="px-6 py-4 text-right">100.0%</td>
                    </tr>
                    <tr className="text-rose-500 border-b border-border-dark">
                      <td className="px-6 py-4 font-bold">(-) DEDUÇÕES DA RECEITA</td>
                      <td className="px-6 py-4 text-right font-black">(18.450,00)</td>
                      <td className="px-6 py-4 text-right font-bold">12.7%</td>
                    </tr>
                    <tr className="bg-background-dark/50 font-bold border-b border-border-dark">
                      <td className="px-6 py-4">RECEITA OPERACIONAL LÍQUIDA</td>
                      <td className="px-6 py-4 text-right font-black text-white">126.750,00</td>
                      <td className="px-6 py-4 text-right">87.3%</td>
                    </tr>
                    <tr className="text-rose-500 border-b border-border-dark">
                      <td className="px-6 py-4 font-bold">(-) CMV (Custo de Mercadoria)</td>
                      <td className="px-6 py-4 text-right font-black">(47.190,00)</td>
                      <td className="px-6 py-4 text-right font-bold">32.5%</td>
                    </tr>
                    <tr className="bg-primary/20 font-bold border-b border-border-dark">
                      <td className="px-6 py-4 uppercase text-primary dark:text-white">LUCRO BRUTO</td>
                      <td className="px-6 py-4 text-right font-black text-primary dark:text-white">79.560,00</td>
                      <td className="px-6 py-4 text-right">54.8%</td>
                    </tr>
                    <tr className="bg-emerald-500/20 font-bold">
                      <td className="px-6 py-6 text-base uppercase text-emerald-500 dark:text-emerald-400 italic">EBITDA</td>
                      <td className="px-6 py-6 text-right text-xl font-black text-emerald-500 dark:text-emerald-400">33.096,00</td>
                      <td className="px-6 py-6 text-right font-black text-emerald-500">22.8%</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </section>

            {/* Charts Sidebar */}
            <section className="space-y-6">
              <div className="bg-card-dark border border-border-dark p-6 rounded-xl shadow-lg">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest">Distribuição CMV</h4>
                </div>
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={cmvCategoryData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {cmvCategoryData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: '10px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="bg-card-dark border border-border-dark p-6 rounded-xl shadow-lg">
                <h4 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-6">Eficiência CMV (%)</h4>
                <div className="h-40 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#30363d" />
                      <XAxis dataKey="name" fontSize={10} />
                      <Bar dataKey="cmv" radius={[4, 4, 0, 0]} barSize={30}>
                        {data.map((entry, index) => (
                          <Cell key={`cell-cmv-${index}`} fill={entry.cmv > 35 ? '#ef4444' : '#06b6d4'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </section>
          </div>

          {/* Variância de Preços e Matriz de Desperdício */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-card-dark border border-border-dark rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-border-dark bg-white/[0.02] flex justify-between items-center">
                <h4 className="text-sm font-black uppercase tracking-widest italic">Variância de Preços (Market Watch)</h4>
                <span className="material-symbols-outlined text-primary">trending_up</span>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-background-dark/30 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-border-dark">
                      <th className="px-8 py-4">Insumo</th>
                      <th className="px-8 py-4">Preço Anterior</th>
                      <th className="px-8 py-4">Preço Atual</th>
                      <th className="px-8 py-4 text-right">Variação</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark/30">
                    {priceVariance.map((p, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-100 uppercase text-xs">{p.item}</td>
                        <td className="px-8 py-5 text-sm text-slate-500 font-mono">R$ {p.last.toFixed(2)}</td>
                        <td className="px-8 py-5 text-sm text-slate-100 font-black font-mono">R$ {p.current.toFixed(2)}</td>
                        <td className={`px-8 py-5 text-right font-black text-xs ${p.status === 'danger' ? 'text-rose-500' : p.status === 'success' ? 'text-emerald-500' : 'text-warning'}`}>
                          {p.change > 0 ? '+' : ''}{p.change}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-card-dark border border-border-dark rounded-[2.5rem] overflow-hidden shadow-2xl">
              <div className="p-8 border-b border-border-dark bg-white/[0.02] flex justify-between items-center">
                <h4 className="text-sm font-black uppercase tracking-widest italic">Controle de Desperdício (Waste Control)</h4>
                <span className="material-symbols-outlined text-rose-500">delete_forever</span>
              </div>
              <div className="p-0">
                <table className="w-full text-left">
                  <thead>
                    <tr className="bg-background-dark/30 text-[9px] font-black uppercase text-slate-500 tracking-widest border-b border-border-dark">
                      <th className="px-8 py-4">Item Perda</th>
                      <th className="px-8 py-4">Motivo Principal</th>
                      <th className="px-8 py-4 text-center">Trend MoM</th>
                      <th className="px-8 py-4 text-right">Valor Perda</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border-dark/30">
                    {wasteData.map((w, idx) => (
                      <tr key={idx} className="hover:bg-white/[0.02] transition-colors">
                        <td className="px-8 py-5 font-bold text-slate-100 uppercase text-xs">{w.item}</td>
                        <td className="px-8 py-5 text-[10px] font-black text-slate-500 uppercase italic tracking-tighter">{w.motivo}</td>
                        <td className={`px-8 py-5 text-center font-bold text-xs ${w.trend.startsWith('-') ? 'text-emerald-500' : w.trend.startsWith('+') ? 'text-rose-500' : 'text-slate-500'}`}>
                          {w.trend}
                        </td>
                        <td className="px-8 py-5 text-right font-black text-sm text-rose-500 font-mono">R$ {w.valor.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="p-6 bg-rose-500/5 border-t border-border-dark flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Total Perda Estimada (Mês)</span>
                <span className="text-lg font-black text-rose-500">R$ 695,70</span>
              </div>
            </div>
          </div>

          {/* Insight de Engenharia de Cardápio */}
          <div className="bg-primary/5 border border-primary/30 p-8 rounded-[3rem] shadow-2xl flex flex-col md:flex-row items-center gap-10">
            <div className="size-24 bg-primary rounded-3xl flex items-center justify-center shadow-[0_0_30px_#e66337]">
              <span className="material-symbols-outlined text-5xl text-white font-light">insights</span>
            </div>
            <div className="flex-1">
              <h4 className="text-2xl font-black italic uppercase tracking-tighter text-white">Insight de Engenharia de Cardápio</h4>
              <p className="text-sm text-slate-400 mt-2 font-medium leading-relaxed max-w-2xl">
                O aumento do custo do <span className="text-primary font-bold italic">Salmão Chile</span> em 17.3% representa uma pressão de <span className="text-white font-bold">2.4% no seu CMV total</span>.
                Recomendamos o ajuste estratégico de preços nos itens da categoria <span className="text-white font-bold italic">"Sashimi Especial"</span> ou a introdução de pratos com maior margem (Curva B) para compensar a variação.
              </p>
            </div>
            <button className="px-8 py-4 bg-primary text-white text-[11px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all shrink-0">
              Simular Reajuste
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FinanceDashboard;
