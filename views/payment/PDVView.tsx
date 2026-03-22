import React, { useState, useMemo } from 'react';
import { useTables } from '../../context/TableContext';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { MenuItem } from '../../types';
import { playSuccessSound } from '../../utils/sounds';

const ALL_ITEMS = [...sushiMenu, ...barMenu, ...kitchenMenu];

type Category = 'all' | 'drinks' | 'sushi' | 'kitchen';
type SplitMode = 'none' | 'equal';
type MobileTab = 'tables' | 'menu' | 'order';

// ─── PDVView ─────────────────────────────────────────────────────────────────
const PDVView: React.FC = () => {
  const {
    tables, openTables, activeTableId, selectActiveTable,
    addItemToTable, removeItemFromTable, closeTable,
    getTableTotal, sendTableOrder, notifyReadyCount, clearReadyNotifications
  } = useTables();

  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isPrinting, setIsPrinting] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'summary' | 'processing' | 'success'>('summary');
  const [selectedMethod, setSelectedMethod] = useState<string | null>(null);

  // Mobile tab state
  const [activeMobileTab, setActiveMobileTab] = useState<MobileTab>('menu');

  // Observações por item
  const [noteItem, setNoteItem] = useState<MenuItem | null>(null);
  const [noteText, setNoteText] = useState('');

  // Divisão de conta
  const [splitMode, setSplitMode] = useState<SplitMode>('none');
  const [splitCount, setSplitCount] = useState(2);

  // Calculadora de troco
  const [cashReceived, setCashReceived] = useState('');

  // Upsell suggestions
  const upsellSuggestions = useMemo(() => {
    if (!noteItem) return [];
    const isMainDish = kitchenMenu.some(i => i.id === noteItem.id) || sushiMenu.some(i => i.id === noteItem.id);
    if (!isMainDish) return [];
    return [...barMenu, ...kitchenMenu]
      .filter(i => i.id !== noteItem.id && i.available)
      .sort(() => Math.random() - 0.5)
      .slice(0, 2);
  }, [noteItem]);

  const activeTable = tables.find(t => t.id === activeTableId);
  const currentCart = openTables[activeTableId] || [];
  const currentTotal = getTableTotal(activeTableId);
  const serviceFee = currentTotal * 0.1;
  const grandTotal = currentTotal + serviceFee;
  const perPersonAmount = grandTotal / splitCount;
  const troco = cashReceived ? Math.max(0, Number(cashReceived) - grandTotal) : null;
  const hasDrafts = currentCart.some(item => item.status === 'DRAFT');
  const cartCount = currentCart.length;

  const filteredItems = ALL_ITEMS.filter(item => {
    const matchCategory =
      activeCategory === 'all' ||
      (activeCategory === 'sushi' && sushiMenu.includes(item)) ||
      (activeCategory === 'kitchen' && kitchenMenu.includes(item)) ||
      (activeCategory === 'drinks' && barMenu.includes(item));
    const matchSearch = !searchTerm || item.name.toLowerCase().includes(searchTerm.toLowerCase());
    return matchCategory && matchSearch;
  });

  const handleAddItem = (item: MenuItem) => {
    if (!item.available) return;
    setNoteItem(item);
    setNoteText('');
  };

  const confirmAddItem = () => {
    if (!noteItem) return;
    addItemToTable(activeTableId, noteItem, noteText.trim() || undefined);
    setNoteItem(null);
    setNoteText('');
    // Switch to order tab on mobile after adding
    setActiveMobileTab('order');
  };

  const handlePrint = () => {
    if (currentCart.length === 0) return;
    const printWindow = window.open('', '_blank', 'width=380,height=600');
    if (!printWindow) return;
    const items = currentCart
      .map(i => `<tr><td>${i.qty}x ${i.name}${i.notes ? ` <small style='color:#999'>(${i.notes})</small>` : ''}</td><td style='text-align:right'>R$ ${(i.price * i.qty).toFixed(2)}</td></tr>`)
      .join('');
    printWindow.document.write(`
      <html><head><title>Comanda Mesa ${activeTableId}</title>
      <style>body{font-family:monospace;font-size:12px;padding:16px} h2{margin:0 0 8px} table{width:100%;border-collapse:collapse} td{padding:3px 0;border-bottom:1px dashed #ccc} .total{font-weight:bold;font-size:14px;margin-top:12px;text-align:right}</style>
      </head><body>
      <h2>SushiFlow</h2><p><strong>Mesa ${activeTableId}</strong> &bull; ${new Date().toLocaleTimeString('pt-BR')}</p>
      <table>${items}</table>
      <p class='total'>Subtotal: R$ ${currentTotal.toFixed(2)}<br>Serviço (10%): R$ ${serviceFee.toFixed(2)}<br><strong>Total: R$ ${grandTotal.toFixed(2)}</strong></p>
      <script>window.onload=()=>window.print();</script></body></html>`);
    printWindow.document.close();
  };

  const handleFinishPayment = () => {
    setPaymentStep('processing');
    setTimeout(() => {
      playSuccessSound();
      setPaymentStep('success');
      handlePrint();
      setTimeout(() => {
        closeTable(activeTableId, selectedMethod || 'cash');
        setIsCheckoutOpen(false);
        setPaymentStep('summary');
        setSelectedMethod(null);
        setSplitMode('none');
        setCashReceived('');
      }, 2000);
    }, 1500);
  };

  const openCheckout = () => {
    if (currentCart.length > 0) setIsCheckoutOpen(true);
  };

  // ── Helper: tab class ──
  const tabCls = (tab: MobileTab) =>
    `flex flex-col items-center gap-0.5 px-4 py-2 rounded-xl transition-all relative ${
      activeMobileTab === tab
        ? 'text-primary'
        : 'text-slate-500'
    }`;

  return (
    <div className="h-full flex overflow-hidden relative">

      {/* ── Notificação itens prontos ───────────────────────────────────── */}
      {notifyReadyCount > 0 && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] bg-emerald-500 text-white rounded-2xl px-5 py-3 shadow-2xl shadow-emerald-500/30 flex items-center gap-3 animate-in slide-in-from-top-4 cursor-pointer max-w-[calc(100vw-32px)]"
          onClick={clearReadyNotifications}
        >
          <span className="material-symbols-outlined text-2xl animate-bounce">check_circle</span>
          <div>
            <p className="text-[10px] font-black uppercase tracking-widest">Cozinha</p>
            <p className="text-sm font-bold">{notifyReadyCount} item{notifyReadyCount > 1 ? 's' : ''} pronto{notifyReadyCount > 1 ? 's' : ''} para servir!</p>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          DESKTOP LAYOUT (md+): 3 colunas side-by-side
      ══════════════════════════════════════════════════════════════════ */}

      {/* ── Col 1: Mesas (desktop) ─────────────────────────────────────── */}
      <aside className="hidden md:flex w-60 border-r border-border-dark flex-col shrink-0 bg-background-dark/30">
        <div className="p-4 border-b border-border-dark">
          <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mesas</h3>
        </div>
        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
          <TablesList
            tables={tables}
            openTables={openTables}
            activeTableId={activeTableId}
            onSelect={selectActiveTable}
          />
        </div>
      </aside>

      {/* ── Col 2: Cardápio (desktop) ──────────────────────────────────── */}
      <main className="hidden md:flex flex-1 flex-col bg-[#0d1719]/50 min-w-0">
        <MenuHeader
          activeCategory={activeCategory}
          setActiveCategory={setActiveCategory}
          searchTerm={searchTerm}
          setSearchTerm={setSearchTerm}
        />
        <MenuGrid filteredItems={filteredItems} onAdd={handleAddItem} />
      </main>

      {/* ── Col 3: Comanda (desktop) ───────────────────────────────────── */}
      <aside className="hidden md:flex w-80 border-l border-border-dark flex-col shrink-0 bg-background-dark">
        <ComandaHeader
          activeTableId={activeTableId}
          cartCount={cartCount}
          onPrint={handlePrint}
        />
        <CartList
          currentCart={currentCart}
          activeTableId={activeTableId}
          removeItemFromTable={removeItemFromTable}
          alwaysShowDelete={false}
        />
        <ComandaFooter
          currentTotal={currentTotal}
          serviceFee={serviceFee}
          grandTotal={grandTotal}
          hasDrafts={hasDrafts}
          cartCount={cartCount}
          onSend={() => sendTableOrder(activeTableId)}
          onCheckout={openCheckout}
        />
      </aside>

      {/* ══════════════════════════════════════════════════════════════════
          MOBILE LAYOUT (< md): Tabs + Bottom Nav
      ══════════════════════════════════════════════════════════════════ */}

      {/* ── Mobile: Tab Content ───────────────────────────────────────── */}
      <div className="md:hidden flex-1 flex flex-col min-h-0 overflow-hidden w-full">

        {/* Tab: Mesas */}
        {activeMobileTab === 'tables' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="px-4 pt-4 pb-2 border-b border-border-dark">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Mesas</h3>
            </div>
            <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-2">
              <TablesList
                tables={tables}
                openTables={openTables}
                activeTableId={activeTableId}
                onSelect={(id) => { selectActiveTable(id); setActiveMobileTab('menu'); }}
              />
            </div>
          </div>
        )}

        {/* Tab: Cardápio */}
        {activeMobileTab === 'menu' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <MenuHeader
              activeCategory={activeCategory}
              setActiveCategory={setActiveCategory}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
            />
            <MenuGrid filteredItems={filteredItems} onAdd={handleAddItem} />
          </div>
        )}

        {/* Tab: Comanda */}
        {activeMobileTab === 'order' && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <ComandaHeader
              activeTableId={activeTableId}
              cartCount={cartCount}
              onPrint={handlePrint}
            />
            <CartList
              currentCart={currentCart}
              activeTableId={activeTableId}
              removeItemFromTable={removeItemFromTable}
              alwaysShowDelete={true}
            />
            <ComandaFooter
              currentTotal={currentTotal}
              serviceFee={serviceFee}
              grandTotal={grandTotal}
              hasDrafts={hasDrafts}
              cartCount={cartCount}
              onSend={() => sendTableOrder(activeTableId)}
              onCheckout={openCheckout}
            />
          </div>
        )}

        {/* ── Bottom Navigation ──────────────────────────────────────── */}
        <nav className="shrink-0 border-t border-border-dark bg-background-dark px-2 pb-safe pt-1 flex items-center justify-around">
          <button className={tabCls('tables')} onClick={() => setActiveMobileTab('tables')}>
            <span className="material-symbols-outlined text-2xl">table_restaurant</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Mesas</span>
          </button>

          <button className={tabCls('menu')} onClick={() => setActiveMobileTab('menu')}>
            <span className="material-symbols-outlined text-2xl">menu_book</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Cardápio</span>
          </button>

          <button className={tabCls('order')} onClick={() => setActiveMobileTab('order')}>
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
            <span className="text-[9px] font-black uppercase tracking-widest">Comanda</span>
            {cartCount > 0 && (
              <span className="absolute -top-1 right-2 size-5 rounded-full bg-primary text-white text-[9px] font-black flex items-center justify-center">
                {cartCount > 9 ? '9+' : cartCount}
              </span>
            )}
          </button>
        </nav>
      </div>

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Adicionar Observação (Bottom-sheet no mobile)
      ══════════════════════════════════════════════════════════════════ */}
      {noteItem && (
        <div
          className="fixed inset-0 z-[90] flex items-end md:items-center justify-center bg-black/80 backdrop-blur-sm animate-in fade-in"
          onClick={() => setNoteItem(null)}
        >
          <div
            className="bg-[#12161b] border border-white/10 rounded-t-3xl md:rounded-3xl w-full md:max-w-sm p-6 shadow-2xl animate-in slide-in-from-bottom-4 md:zoom-in-95"
            onClick={e => e.stopPropagation()}
          >
            {/* Handle bar (mobile only) */}
            <div className="md:hidden w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />

            <h3 className="text-lg font-black text-white uppercase tracking-tighter mb-1">{noteItem.name}</h3>
            <p className="text-xs text-primary font-bold mb-4">R$ {noteItem.price.toFixed(2)}</p>

            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">
              Observação (opcional)
            </label>
            <input
              autoFocus
              type="text"
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && confirmAddItem()}
              placeholder="Ex: sem wasabi, bem passado, extra molho..."
              className="w-full bg-black/30 border border-white/10 rounded-2xl px-4 py-3 text-sm text-white focus:border-primary outline-none mb-4"
            />

            {upsellSuggestions.length > 0 && (
              <div className="mb-4">
                <p className="text-[9px] font-black text-amber-400 uppercase tracking-widest mb-2">⭐ Vai bem com esse prato</p>
                <div className="flex gap-2">
                  {upsellSuggestions.map(sug => (
                    <button
                      key={sug.id}
                      onClick={() => addItemToTable(activeTableId, sug, undefined)}
                      className="flex-1 bg-amber-500/5 border border-amber-500/20 rounded-xl p-2.5 text-left hover:border-amber-500/40 transition-all"
                    >
                      <p className="text-[10px] font-black text-white leading-tight truncate">{sug.name}</p>
                      <p className="text-[9px] text-amber-400 font-bold mt-1">+ R$ {sug.price.toFixed(2)}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setNoteItem(null)}
                className="flex-1 py-3 bg-white/5 text-white rounded-xl text-xs font-black uppercase border border-white/10 hover:bg-white/10 transition-all"
              >
                Cancelar
              </button>
              <button
                onClick={confirmAddItem}
                className="flex-1 py-3 bg-primary text-white rounded-xl text-xs font-black uppercase shadow-lg shadow-primary/20 hover:brightness-110 transition-all flex items-center justify-center gap-1"
              >
                <span className="material-symbols-outlined text-sm">add_circle</span>
                Adicionar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════
          MODAL: Checkout (Bottom-sheet no mobile, centro no desktop)
      ══════════════════════════════════════════════════════════════════ */}
      {isCheckoutOpen && (
        <div className="fixed inset-0 z-[100] flex items-end md:items-center justify-center bg-black/95 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#12161b] border border-white/10 rounded-t-[2rem] md:rounded-[2.5rem] w-full md:max-w-2xl max-h-[92vh] overflow-y-auto custom-scrollbar shadow-[0_0_100px_rgba(230,99,55,0.2)] animate-in slide-in-from-bottom-8 md:zoom-in-95 duration-300 relative">

            {/* Handle bar */}
            <div className="md:hidden sticky top-0 pt-4 pb-2 flex justify-center bg-[#12161b]">
              <div className="w-10 h-1 bg-white/20 rounded-full" />
            </div>

            <div className="p-6 md:p-8">

              {paymentStep === 'summary' && (
                <div className="space-y-5">
                  {/* Header */}
                  <div className="flex justify-between items-center">
                    <div>
                      <h2 className="text-2xl md:text-3xl font-black italic uppercase tracking-tighter">Mesa {activeTableId}</h2>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Finalização de Pedido</p>
                    </div>
                    <button
                      onClick={() => setIsCheckoutOpen(false)}
                      className="size-10 bg-white/5 rounded-xl flex items-center justify-center text-slate-500 hover:text-white transition-colors"
                    >
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  </div>

                  {/* Resumo dos itens */}
                  <div className="bg-black/20 rounded-2xl p-4 border border-white/5 max-h-36 overflow-y-auto custom-scrollbar space-y-2">
                    {currentCart.map((item, i) => (
                      <div key={i} className="flex justify-between items-start text-sm">
                        <div>
                          <span className="text-slate-300 font-bold">{item.qty}x {item.name}</span>
                          {item.notes && <p className="text-[9px] text-amber-400/70 italic">📝 {item.notes}</p>}
                        </div>
                        <span className="text-slate-400 font-mono shrink-0 ml-4">R$ {(item.price * item.qty).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  {/* Totais */}
                  <div className="bg-background-dark/50 rounded-2xl p-4 md:p-6 border border-white/5 space-y-3">
                    <div className="flex justify-between text-slate-400">
                      <span className="text-sm font-bold">Consumo Total</span>
                      <span className="font-mono">R$ {currentTotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-slate-400">
                      <span className="text-sm font-bold">Serviço Opcional (10%)</span>
                      <span className="font-mono">R$ {serviceFee.toFixed(2)}</span>
                    </div>
                    <div className="pt-3 border-t border-white/10 flex justify-between items-center">
                      <span className="text-base md:text-xl font-black text-white">VALOR À PAGAR</span>
                      <span className="text-3xl md:text-4xl font-black text-primary tracking-tighter italic">R$ {grandTotal.toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Divisão de conta */}
                  <div className="space-y-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSplitMode(splitMode === 'equal' ? 'none' : 'equal')}
                        className={`flex-1 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all ${splitMode === 'equal' ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-400' : 'bg-white/5 border-white/5 text-slate-500 hover:text-slate-300'}`}
                      >
                        <span className="material-symbols-outlined text-sm mr-1">group</span>
                        Dividir Igual
                      </button>
                      <button
                        onClick={() => setSplitMode('none')}
                        className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase border bg-white/5 border-white/5 text-slate-500 hover:text-slate-300 transition-all"
                      >
                        Sem Divisão
                      </button>
                    </div>
                    {splitMode === 'equal' && (
                      <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-2xl p-4 flex items-center gap-4 animate-in fade-in">
                        <span className="material-symbols-outlined text-cyan-400">group</span>
                        <div className="flex-1">
                          <p className="text-[10px] font-black text-cyan-400 uppercase tracking-widest mb-1">Por Pessoa</p>
                          <p className="text-2xl font-black text-white">R$ {perPersonAmount.toFixed(2)}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <button onClick={() => setSplitCount(Math.max(2, splitCount - 1))} className="size-8 rounded-xl bg-white/10 text-white font-black hover:bg-white/20 transition-all">-</button>
                          <span className="text-xl font-black text-white w-6 text-center">{splitCount}</span>
                          <button onClick={() => setSplitCount(Math.min(20, splitCount + 1))} className="size-8 rounded-xl bg-white/10 text-white font-black hover:bg-white/20 transition-all">+</button>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Métodos de pagamento */}
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { id: 'pix', label: 'PIX', icon: 'qr_code_2' },
                      { id: 'card', label: 'CARTÃO', icon: 'credit_card' },
                      { id: 'cash', label: 'DINHEIRO', icon: 'payments' }
                    ].map((method) => (
                      <button
                        key={method.id}
                        onClick={() => setSelectedMethod(method.id)}
                        className={`p-4 rounded-2xl border-2 flex flex-col items-center gap-2 transition-all ${selectedMethod === method.id ? 'bg-primary/20 border-primary text-primary' : 'bg-white/5 border-white/5 text-slate-400 hover:border-slate-600'}`}
                      >
                        <span className="material-symbols-outlined text-2xl md:text-3xl">{method.icon}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{method.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Calculadora de troco */}
                  {selectedMethod === 'cash' && (
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 animate-in fade-in space-y-2">
                      <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Calculadora de Troco</p>
                      <div className="flex items-center gap-3">
                        <div className="relative flex-1">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm font-bold">R$</span>
                          <input
                            type="number"
                            inputMode="decimal"
                            value={cashReceived}
                            onChange={e => setCashReceived(e.target.value)}
                            placeholder={grandTotal.toFixed(2)}
                            className="w-full pl-10 pr-3 py-2.5 bg-black/30 border border-amber-500/20 rounded-xl text-white font-black text-sm outline-none focus:border-amber-400 transition-colors"
                          />
                        </div>
                        {troco !== null && (
                          <div className="text-right shrink-0">
                            <p className="text-[9px] text-slate-500 font-bold uppercase">Troco</p>
                            <p className={`text-xl font-black ${troco > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>R$ {troco.toFixed(2)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Confirmar */}
                  <button
                    onClick={handleFinishPayment}
                    disabled={!selectedMethod}
                    className={`w-full py-4 md:py-5 rounded-2xl font-black uppercase tracking-widest transition-all text-sm flex items-center justify-center gap-2 ${selectedMethod ? 'bg-emerald-500 hover:bg-emerald-400 text-white shadow-xl shadow-emerald-500/20' : 'bg-slate-800 text-slate-500 cursor-not-allowed'}`}
                  >
                    <span className="material-symbols-outlined">check_circle</span>
                    Confirmar Pagamento{splitMode === 'equal' ? ` (${splitCount}x R$ ${perPersonAmount.toFixed(2)})` : ''}
                  </button>
                </div>
              )}

              {paymentStep === 'processing' && (
                <div className="h-72 flex flex-col items-center justify-center text-center space-y-6 py-8">
                  <div className="relative size-20 md:size-24">
                    <div className="absolute inset-0 border-8 border-primary/20 rounded-full" />
                    <div className="absolute inset-0 border-8 border-primary border-t-transparent rounded-full animate-spin" />
                  </div>
                  <div>
                    <h3 className="text-xl md:text-2xl font-black text-white uppercase tracking-tighter">Processando...</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Comunicando com servidor de pagamentos</p>
                  </div>
                </div>
              )}

              {paymentStep === 'success' && (
                <div className="h-72 flex flex-col items-center justify-center text-center space-y-6 py-8">
                  <div className="size-24 md:size-28 bg-emerald-500 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.4)]">
                    <span className="material-symbols-outlined text-white text-5xl md:text-6xl font-black animate-bounce">check</span>
                  </div>
                  <div>
                    <h3 className="text-3xl md:text-4xl font-black text-white italic uppercase tracking-tighter">Sucesso!</h3>
                    <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-2">Conta fechada • Imprimindo Recibo</p>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── Sub-componentes ─────────────────────────────────────────────────────────

interface Table { id: string | number; status: string; capacity: number; timeActive?: string; }

const TablesList: React.FC<{
  tables: Table[];
  openTables: Record<string | number, { status: string }[]>;
  activeTableId: string | number;
  onSelect: (id: string | number) => void;
}> = ({ tables, openTables, activeTableId, onSelect }) => (
  <>
    {tables.map((table) => {
      const hasReady = (openTables[table.id] || []).some((i: { status: string }) => i.status === 'READY');
      return (
        <button
          key={table.id}
          onClick={() => onSelect(table.id)}
          className={`w-full p-3 rounded-xl border transition-all flex flex-col gap-1 text-left relative ${
            activeTableId === table.id
              ? 'bg-primary/10 border-primary shadow-lg'
              : 'bg-card-dark border-border-dark hover:border-slate-600'
          }`}
        >
          {hasReady && <span className="absolute top-2 right-2 size-2 rounded-full bg-emerald-500 animate-pulse" />}
          <div className="flex justify-between items-center">
            <span className="text-lg font-black">Mesa {table.id}</span>
            <span className={`size-2 rounded-full ${
              table.status === 'LIVRE' ? 'bg-success' :
              table.status === 'OCUPADA' ? 'bg-rose-500' : 'bg-warning animate-pulse'
            }`} />
          </div>
          <div className="flex justify-between text-[10px] font-bold uppercase text-slate-500">
            <span>{table.capacity} Pax</span>
            <span className="font-mono text-slate-300">{table.timeActive || '-'}</span>
          </div>
        </button>
      );
    })}
  </>
);

const MenuHeader: React.FC<{
  activeCategory: Category;
  setActiveCategory: (c: Category) => void;
  searchTerm: string;
  setSearchTerm: (s: string) => void;
}> = ({ activeCategory, setActiveCategory, searchTerm, setSearchTerm }) => (
  <header className="p-3 md:p-4 border-b border-border-dark flex items-center gap-2 flex-wrap">
    <div className="flex gap-1.5 flex-wrap">
      {(['all', 'sushi', 'kitchen', 'drinks'] as Category[]).map((cat) => (
        <button
          key={cat}
          onClick={() => setActiveCategory(cat)}
          className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
            activeCategory === cat ? 'bg-white text-black' : 'bg-card-dark text-slate-400 border border-border-dark'
          }`}
        >
          {cat === 'all' ? 'Tudo' : cat === 'sushi' ? 'Sushi' : cat === 'kitchen' ? 'Cozinha' : 'Bar'}
        </button>
      ))}
    </div>
    <div className="relative flex-1 min-w-[120px]">
      <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-lg">search</span>
      <input
        type="text"
        value={searchTerm}
        onChange={e => setSearchTerm(e.target.value)}
        placeholder="Buscar..."
        className="w-full pl-9 pr-3 py-1.5 bg-card-dark border border-border-dark rounded-lg text-xs text-slate-200 focus:border-primary outline-none transition-colors"
      />
    </div>
  </header>
);

const MenuGrid: React.FC<{
  filteredItems: MenuItem[];
  onAdd: (item: MenuItem) => void;
}> = ({ filteredItems, onAdd }) => (
  <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar">
    <div className="grid grid-cols-3 md:grid-cols-3 lg:grid-cols-4 gap-2 md:gap-3">
      {filteredItems.map((item) => (
        <button
          key={item.id}
          onClick={() => onAdd(item)}
          disabled={!item.available}
          className={`bg-card-dark border border-border-dark rounded-xl p-2 md:p-3 flex flex-col gap-1.5 text-left transition-all group relative overflow-hidden ${
            item.available ? 'hover:border-primary active:scale-95' : 'opacity-40 cursor-not-allowed'
          }`}
        >
          {item.bestSeller && (
            <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-primary text-white text-[8px] font-black uppercase rounded-md z-10">Top</span>
          )}
          {!item.available && (
            <span className="absolute inset-0 bg-black/40 flex items-center justify-center text-[10px] font-black text-rose-400 uppercase">Esgotado</span>
          )}
          <div className="aspect-square rounded-lg overflow-hidden bg-background-dark">
            <img src={item.image} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" alt={item.name} />
          </div>
          <div>
            <h4 className="text-[10px] md:text-[11px] font-bold leading-tight line-clamp-2">{item.name}</h4>
            <p className="text-[10px] md:text-xs font-black text-primary mt-0.5">R$ {item.price.toFixed(2)}</p>
          </div>
        </button>
      ))}
    </div>
    {filteredItems.length === 0 && (
      <div className="flex flex-col items-center justify-center h-full py-16 text-slate-600">
        <span className="material-symbols-outlined text-5xl mb-3">search_off</span>
        <p className="text-sm font-bold">Nenhum item encontrado</p>
      </div>
    )}
  </div>
);

const ComandaHeader: React.FC<{
  activeTableId: string | number;
  cartCount: number;
  onPrint: () => void;
}> = ({ activeTableId, cartCount, onPrint }) => (
  <div className="p-4 md:p-5 border-b border-border-dark bg-primary/5 flex justify-between items-start shrink-0">
    <div>
      <h2 className="text-xl md:text-2xl font-black italic uppercase">MESA {activeTableId}</h2>
      <span className="text-[10px] font-bold text-primary uppercase tracking-widest">Comanda em Aberto</span>
    </div>
    {cartCount > 0 && (
      <button
        onClick={onPrint}
        className="p-2 border border-primary/30 text-primary rounded-xl hover:bg-primary hover:text-white transition-colors flex items-center justify-center bg-white/5"
        title="Imprimir Comanda"
      >
        <span className="material-symbols-outlined text-lg">print</span>
      </button>
    )}
  </div>
);

interface CartItem {
  id: string;
  name: string;
  qty: number;
  price: number;
  status: string;
  notes?: string;
}

const CartList: React.FC<{
  currentCart: CartItem[];
  activeTableId: string | number;
  removeItemFromTable: (tableId: string | number, itemId: string) => void;
  alwaysShowDelete: boolean;
}> = ({ currentCart, activeTableId, removeItemFromTable, alwaysShowDelete }) => (
  <div className="flex-1 overflow-y-auto custom-scrollbar">
    {currentCart.length === 0 ? (
      <div className="h-full flex flex-col items-center justify-center opacity-20 p-8 text-center">
        <span className="material-symbols-outlined text-5xl mb-3">receipt_long</span>
        <p className="text-xs font-bold uppercase tracking-widest">Comanda vazia</p>
      </div>
    ) : (
      currentCart.map((item, idx) => (
        <div key={idx} className="p-4 flex flex-col group hover:bg-white/5 border-b border-border-dark/30 transition-colors">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <span className={`text-xs font-black px-2 py-0.5 rounded shrink-0 ${
                item.status === 'DRAFT' ? 'bg-warning/20 text-warning border border-warning/50' :
                item.status === 'READY' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' :
                'bg-success/10 text-success'
              }`}>
                {item.status === 'DRAFT' ? 'NOVO' : item.status === 'READY' ? '✓ PRONTO' : `${item.qty}x`}
              </span>
              <span className="text-xs font-bold truncate">{item.name}</span>
            </div>
            <div className="flex items-center gap-2 shrink-0 ml-2">
              <span className="text-xs font-black">R$ {(item.price * item.qty).toFixed(2)}</span>
              <button
                onClick={() => removeItemFromTable(activeTableId, item.id)}
                className={`text-rose-500 transition-opacity ${alwaysShowDelete ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}
              >
                <span className="material-symbols-outlined text-sm">remove_circle</span>
              </button>
            </div>
          </div>
          {item.notes && (
            <p className="text-[9px] text-amber-400/70 font-bold italic mt-1 pl-10">📝 {item.notes}</p>
          )}
        </div>
      ))
    )}
  </div>
);

const ComandaFooter: React.FC<{
  currentTotal: number;
  serviceFee: number;
  grandTotal: number;
  hasDrafts: boolean;
  cartCount: number;
  onSend: () => void;
  onCheckout: () => void;
}> = ({ currentTotal, serviceFee, grandTotal, hasDrafts, cartCount, onSend, onCheckout }) => (
  <div className="p-4 md:p-5 bg-card-dark border-t border-border-dark space-y-3 shrink-0">
    <div className="space-y-1.5">
      <div className="flex justify-between text-xs text-slate-500 font-bold uppercase">
        <span>Subtotal</span>
        <span>R$ {currentTotal.toFixed(2)}</span>
      </div>
      <div className="flex justify-between text-xs text-slate-500 font-bold uppercase">
        <span>Serviço (10%)</span>
        <span>R$ {serviceFee.toFixed(2)}</span>
      </div>
      <div className="flex justify-between items-end pt-2 border-t border-border-dark/50">
        <span className="text-sm font-black uppercase">Total Geral</span>
        <span className="text-2xl md:text-3xl font-black text-white">R$ {grandTotal.toFixed(2)}</span>
      </div>
    </div>
    <div className="flex gap-2">
      {hasDrafts && (
        <button
          onClick={onSend}
          className="flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest bg-emerald-500 hover:bg-emerald-400 text-white shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 transition-all"
        >
          <span className="material-symbols-outlined text-sm">send</span>
          Lançar
        </button>
      )}
      <button
        onClick={onCheckout}
        disabled={cartCount === 0}
        className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg ${
          cartCount === 0 ? 'bg-border-dark text-slate-600' : 'bg-primary hover:bg-primary/90 text-white shadow-primary/20'
        }`}
      >
        Fechar Conta
      </button>
    </div>
  </div>
);

export default PDVView;
