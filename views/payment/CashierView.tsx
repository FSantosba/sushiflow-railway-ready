
import React, { useState } from 'react';
import { mockTransactions } from '../../utils/mockData';
import { PaymentMethod, Transaction } from '../../types';

// Cor e ícone por método de pagamento
const METHOD_META: Record<string, { color: string; bg: string; border: string; icon: string }> = {
  [PaymentMethod.PIX]: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: 'pix' },
  [PaymentMethod.CREDIT]: { color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20', icon: 'credit_card' },
  [PaymentMethod.DEBIT]: { color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20', icon: 'credit_card' },
  [PaymentMethod.CASH]: { color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: 'payments' },
  [PaymentMethod.VOUCHER]: { color: 'text-cyan-400', bg: 'bg-cyan-500/10', border: 'border-cyan-500/20', icon: 'confirmation_number' },
  SANGRIA: { color: 'text-rose-400', bg: 'bg-rose-500/10', border: 'border-rose-500/20', icon: 'arrow_downward' },
};

const getMethodMeta = (method: string) =>
  METHOD_META[method] ?? { color: 'text-slate-400', bg: 'bg-slate-500/10', border: 'border-slate-500/20', icon: 'swap_horiz' };

const CashierView: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions);
  const [splitBill, setSplitBill] = useState({ totalGeral: 0, people: 1, tip: 10 });
  const [isSangriaModalOpen, setIsSangriaModalOpen] = useState(false);
  const [isCloseCaixaOpen, setIsCloseCaixaOpen] = useState(false);
  const [sangriaValue, setSangriaValue] = useState('');
  const [sangriaDesc, setSangriaDesc] = useState('');
  const [sangriaError, setSangriaError] = useState('');

  // Cálculos rápidos de caixa
  const totalsByMethod = transactions.reduce((acc, t) => {
    if (t.type === 'IN') {
      const key = t.method as string;
      acc[key] = (acc[key] || 0) + t.amount;
    }
    return acc;
  }, {} as Record<string, number>);

  const totalIn = transactions.filter(t => t.type === 'IN').reduce((a, b) => a + b.amount, 0);
  const totalOut = transactions.filter(t => t.type === 'OUT').reduce((a, b) => a + b.amount, 0);
  const cashReceived = totalsByMethod[PaymentMethod.CASH] || 0;
  const currentCash = cashReceived - totalOut;

  const splitResult = splitBill.totalGeral > 0
    ? (splitBill.totalGeral * (1 + splitBill.tip / 100)) / (splitBill.people || 1)
    : null;

  // ✅ Sangria funcional
  const handleConfirmSangria = () => {
    const value = parseFloat(sangriaValue);
    if (!value || value <= 0) {
      setSangriaError('Informe um valor válido maior que zero.');
      return;
    }
    if (!sangriaDesc.trim()) {
      setSangriaError('Informe o motivo da retirada.');
      return;
    }
    const now = new Date();
    const newTransaction: Transaction = {
      id: `sangria-${Date.now()}`,
      type: 'OUT',
      method: 'SANGRIA' as any,
      amount: value,
      description: sangriaDesc.trim(),
      time: now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
      user: 'Admin',
    };
    setTransactions(prev => [newTransaction, ...prev]);
    setSangriaValue('');
    setSangriaDesc('');
    setSangriaError('');
    setIsSangriaModalOpen(false);
  };

  return (
    <div className="h-full overflow-y-auto p-8 custom-scrollbar space-y-8 pb-20">
      {/* Header Info */}
      <div className="flex flex-col md:flex-row gap-6">
        <div className="flex-1 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Caixa Aberto em</p>
            <h4 className="text-lg font-black text-white">11:32 <span className="text-xs text-slate-500 font-normal ml-2">Hoje</span></h4>
          </div>
          <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Vendas Totais</p>
            <h4 className="text-xl font-black text-primary">R$ {totalIn.toFixed(2)}</h4>
          </div>
          <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Dinheiro em Caixa</p>
            <h4 className={`text-xl font-black ${currentCash >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {currentCash.toFixed(2)}</h4>
          </div>
          <div className="bg-card-dark border border-border-dark p-6 rounded-2xl shadow-xl">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Total Sangrias</p>
            <h4 className="text-xl font-black text-rose-500">R$ {totalOut.toFixed(2)}</h4>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <button
            onClick={() => { setSangriaValue(''); setSangriaDesc(''); setSangriaError(''); setIsSangriaModalOpen(true); }}
            className="flex items-center justify-center gap-2 bg-rose-500 text-white px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:brightness-110 transition-all shadow-lg shadow-rose-500/20"
          >
            <span className="material-symbols-outlined text-sm">payments</span>
            Lançar Sangria
          </button>
          <button
            onClick={() => setIsCloseCaixaOpen(true)}
            className="flex items-center justify-center gap-2 bg-white text-black px-6 py-3 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-200 transition-all shadow-lg"
          >
            <span className="material-symbols-outlined text-sm">lock</span>
            Fechar Caixa
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Movimentação List */}
        <section className="lg:col-span-2 space-y-6">
          <div className="bg-card-dark border border-border-dark rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-6 border-b border-border-dark bg-white/[0.02] flex justify-between items-center">
              <h3 className="text-sm font-black uppercase tracking-widest">Últimas Movimentações</h3>
              <span className="text-[10px] font-bold text-slate-600 uppercase">{transactions.length} registros</span>
            </div>
            <div className="p-0">
              <table className="w-full text-left">
                <tbody className="divide-y divide-border-dark/30">
                  {[...transactions].slice(0, 12).map((t) => {
                    const meta = getMethodMeta(t.method as string);
                    return (
                      <tr key={t.id} className="hover:bg-white/[0.01] transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-4">
                            <div className={`size-10 rounded-xl flex items-center justify-center border ${t.type === 'IN' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
                              }`}>
                              <span className="material-symbols-outlined text-lg">
                                {t.type === 'IN' ? 'trending_up' : 'trending_down'}
                              </span>
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-100">{t.description}</p>
                              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{t.time} • {t.user}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${meta.bg} ${meta.border} ${meta.color}`}>
                            <span className="material-symbols-outlined" style={{ fontSize: '10px' }}>{meta.icon}</span>
                            {t.method}
                          </span>
                        </td>
                        <td className={`px-6 py-4 text-right font-black text-sm ${t.type === 'IN' ? 'text-emerald-500' : 'text-rose-500'}`}>
                          {t.type === 'IN' ? '+' : '-'} R$ {t.amount.toFixed(2)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Sidebar Tools */}
        <aside className="space-y-6">
          {/* Bill Split Simulator */}
          <div className="bg-primary/5 border border-primary/20 rounded-3xl p-6 shadow-xl">
            <div className="flex items-center gap-3 text-primary mb-5">
              <span className="material-symbols-outlined font-bold">calculate</span>
              <h3 className="text-xs font-black uppercase tracking-widest">Calculadora de Divisão</h3>
            </div>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Valor Total (Mesa)</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    value={splitBill.totalGeral || ''}
                    onChange={(e) => setSplitBill({ ...splitBill, totalGeral: Number(e.target.value) })}
                    placeholder="0,00"
                    className="w-full bg-background-dark border border-border-dark rounded-xl pl-12 pr-4 py-3 text-lg font-black text-white focus:ring-1 focus:ring-primary outline-none"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                {/* Pessoas com botões +/− */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Pessoas</label>
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => setSplitBill(s => ({ ...s, people: Math.max(1, s.people - 1) }))}
                      className="size-10 rounded-xl border border-border-dark bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all font-black shrink-0"
                    >−</button>
                    <span className="flex-1 text-center text-lg font-black text-white">{splitBill.people}</span>
                    <button
                      onClick={() => setSplitBill(s => ({ ...s, people: Math.min(30, s.people + 1) }))}
                      className="size-10 rounded-xl border border-border-dark bg-white/5 flex items-center justify-center text-white hover:bg-white/10 transition-all font-black shrink-0"
                    >+</button>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase">Serviço %</label>
                  <select
                    value={splitBill.tip}
                    onChange={(e) => setSplitBill({ ...splitBill, tip: Number(e.target.value) })}
                    className="w-full bg-background-dark border border-border-dark rounded-xl px-4 py-3 text-sm font-black text-white focus:ring-1 focus:ring-primary outline-none"
                  >
                    <option value={0}>0%</option>
                    <option value={10}>10%</option>
                    <option value={12}>12%</option>
                    <option value={15}>15%</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 pt-5 border-t border-primary/10">
                <p className="text-[10px] text-slate-500 font-black uppercase text-center mb-1">Cada pessoa paga</p>
                {splitResult !== null ? (
                  <p className="text-4xl font-black text-primary text-center tracking-tighter">
                    R$ {splitResult.toFixed(2)}
                  </p>
                ) : (
                  <p className="text-2xl font-black text-slate-700 text-center tracking-tighter">—</p>
                )}
              </div>
            </div>
          </div>

          {/* Totals by Method */}
          <div className="bg-card-dark border border-border-dark rounded-3xl p-6 shadow-xl">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-500 mb-5">Resumo por Método</h3>
            <div className="space-y-3">
              {Object.entries(totalsByMethod).map(([method, amount]) => {
                const meta = getMethodMeta(method);
                return (
                  <div key={method} className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <span className={`material-symbols-outlined text-sm ${meta.color}`} style={{ fontSize: '14px' }}>{meta.icon}</span>
                      <span className={`text-xs font-bold ${meta.color}`}>{method}</span>
                    </div>
                    <span className="text-xs font-black text-white">R$ {(amount as number).toFixed(2)}</span>
                  </div>
                );
              })}
              <div className="pt-3 border-t border-border-dark flex items-center justify-between">
                <span className="text-xs font-black uppercase text-slate-500">Total Recebido</span>
                <span className="text-sm font-black text-primary">R$ {totalIn.toFixed(2)}</span>
              </div>
            </div>

            {/* Saldo Físico em Caixa */}
            <div className={`mt-4 pt-4 border-t border-border-dark p-4 rounded-xl ${currentCash >= 0 ? 'bg-emerald-500/5 border border-emerald-500/20' : 'bg-rose-500/5 border border-rose-500/20'}`}>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">
                💰 Saldo Físico em Caixa
              </p>
              <p className={`text-xl font-black ${currentCash >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                R$ {currentCash.toFixed(2)}
              </p>
              <p className="text-[9px] text-slate-600 mt-0.5">Dinheiro recebido − Sangrias</p>
            </div>
          </div>
        </aside>
      </div>

      {/* ✅ Modal Sangria funcional */}
      {isSangriaModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 backdrop-blur-sm p-6" onClick={() => setIsSangriaModalOpen(false)}>
          <div className="bg-card-dark border border-border-dark rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-rose-500 text-2xl">arrow_downward</span>
              <h2 className="text-xl font-black italic">NOVA SANGRIA</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Retirada de valores em espécie do caixa físico.</p>

            {sangriaError && (
              <div className="mb-4 px-4 py-2.5 bg-rose-500/10 border border-rose-500/20 rounded-xl text-xs text-rose-400 font-bold flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">error</span>
                {sangriaError}
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Valor da Retirada</label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 font-bold text-sm">R$</span>
                  <input
                    type="number"
                    value={sangriaValue}
                    onChange={e => { setSangriaValue(e.target.value); setSangriaError(''); }}
                    placeholder="0,00"
                    className="w-full bg-background-dark border border-border-dark rounded-xl pl-12 pr-4 py-3 text-lg font-black text-rose-400 outline-none focus:ring-1 focus:ring-rose-500"
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-slate-500 uppercase">Motivo / Descrição</label>
                <textarea
                  value={sangriaDesc}
                  onChange={e => { setSangriaDesc(e.target.value); setSangriaError(''); }}
                  className="w-full bg-background-dark border border-border-dark rounded-xl p-4 text-xs font-medium text-slate-400 outline-none h-24 focus:ring-1 focus:ring-rose-500 resize-none"
                  placeholder="Ex: Pagamento extra frete motoboy..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4 pt-2">
                <button
                  onClick={() => setIsSangriaModalOpen(false)}
                  className="bg-slate-700 hover:bg-slate-600 text-white font-black text-[10px] py-4 rounded-xl uppercase tracking-widest transition-all"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleConfirmSangria}
                  className="bg-rose-500 hover:bg-rose-400 text-white font-black text-[10px] py-4 rounded-xl uppercase tracking-widest shadow-lg shadow-rose-500/20 transition-all"
                >
                  Confirmar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ✅ Modal Fechar Caixa */}
      {isCloseCaixaOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background-dark/80 backdrop-blur-sm p-6" onClick={() => setIsCloseCaixaOpen(false)}>
          <div className="bg-card-dark border border-border-dark rounded-[2rem] p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2">
              <span className="material-symbols-outlined text-amber-400 text-2xl">lock</span>
              <h2 className="text-xl font-black italic">FECHAR CAIXA</h2>
            </div>
            <p className="text-xs text-slate-500 mb-6">Confirme o resumo do dia antes de fechar.</p>

            <div className="space-y-2 mb-6">
              {[
                { label: 'Total Vendido', value: `R$ ${totalIn.toFixed(2)}`, color: 'text-emerald-400' },
                { label: 'Total Sangrias', value: `- R$ ${totalOut.toFixed(2)}`, color: 'text-rose-400' },
                { label: 'Saldo Físico (Dinheiro)', value: `R$ ${currentCash.toFixed(2)}`, color: currentCash >= 0 ? 'text-emerald-400' : 'text-rose-400' },
                { label: 'Nº Transações', value: String(transactions.length), color: 'text-slate-300' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center p-3 bg-white/[0.03] rounded-xl border border-white/5">
                  <span className="text-xs text-slate-500 font-bold">{row.label}</span>
                  <span className={`text-sm font-black ${row.color}`}>{row.value}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setIsCloseCaixaOpen(false)}
                className="bg-slate-700 hover:bg-slate-600 text-white font-black text-[10px] py-4 rounded-xl uppercase tracking-widest transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={() => setIsCloseCaixaOpen(false)}
                className="bg-amber-500 hover:bg-amber-400 text-black font-black text-[10px] py-4 rounded-xl uppercase tracking-widest shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
              >
                <span className="material-symbols-outlined text-sm">lock</span>
                Confirmar Fechamento
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CashierView;
