import React, { useState, useMemo } from 'react';
import { useCMV, Supplier, ExtendedIngredient } from '../../context/CMVContext';

const CATEGORY_UI: Record<string, { label: string; color: string; bg: string }> = {
  'peixes': { label: 'Peixes & Frutos do Mar', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  'hortifruti': { label: 'Hortifruti', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  'mercearia': { label: 'Mercearia & Secos', color: 'text-amber-400', bg: 'bg-amber-400/10' },
  'embalagens': { label: 'Embalagens', color: 'text-rose-400', bg: 'bg-rose-400/10' },
  'bebidas': { label: 'Bebidas', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  'outros': { label: 'Insumos Gerais', color: 'text-slate-400', bg: 'bg-slate-400/10' }
};

type ComprasTab = 'SUGESTOES' | 'ESTEIRA' | 'FORNECEDORES';

// ─── MODAL DE FORNECEDOR (OTIMIZADO PARA MOBILE) ───
const SupplierModal: React.FC<{
  onClose: () => void;
  onSave: (s: Supplier, ids: string[]) => void;
  ingredients: ExtendedIngredient[];
  existingSupplier?: Supplier;
}> = ({ onClose, onSave, ingredients, existingSupplier }) => {
  const [form, setForm] = useState({
    name: existingSupplier?.name || '',
    contact: existingSupplier?.contact || '',
    deliveryDays: existingSupplier?.deliveryDays || '',
    categories: existingSupplier?.categories || [] as string[]
  });

  const [selectedProductIds, setSelectedProductIds] = useState<string[]>(() => {
    if (!existingSupplier) return [];
    return ingredients.filter(i => i.supplierIds?.includes(existingSupplier.id)).map(i => i.id);
  });

  const [searchProduct, setSearchProduct] = useState('');

  const toggleProduct = (id: string) => {
    setSelectedProductIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
  };

  const groupedIngredients = useMemo(() => {
    const grouped: Record<string, ExtendedIngredient[]> = {};
    const filtered = ingredients.filter(i => i.name.toLowerCase().includes(searchProduct.toLowerCase()));
    filtered.forEach(ing => {
      if (!grouped[ing.category]) grouped[ing.category] = [];
      grouped[ing.category].push(ing);
    });
    return grouped;
  }, [ingredients, searchProduct]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      id: existingSupplier?.id || `sup_${Date.now()}`,
      name: form.name,
      contact: form.contact.replace(/\D/g, ''),
      deliveryDays: form.deliveryDays,
      categories: form.categories,
      reliabilityScore: existingSupplier?.reliabilityScore || 5
    }, selectedProductIds);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
      <div className="bg-[#0d1218] border border-white/10 rounded-[2rem] p-5 md:p-8 w-full max-w-6xl shadow-2xl flex flex-col max-h-[95vh] animate-in zoom-in-95">
        <div className="flex justify-between items-center mb-6 shrink-0">
          <div>
            <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">
              {existingSupplier ? 'Ajustar Parceiro' : 'Novo Fornecedor'}
            </h2>
          </div>
          <button onClick={onClose} className="size-10 bg-white/5 rounded-full flex items-center justify-center text-slate-500"><span className="material-symbols-outlined">close</span></button>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6 overflow-hidden">
          <div className="w-full md:w-[320px] space-y-4 shrink-0 overflow-y-auto">
            <div className="bg-black/30 p-5 rounded-2xl border border-white/5 space-y-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Nome</label>
                <input required type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-[#05070a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">WhatsApp</label>
                <input required type="text" value={form.contact} onChange={e => setForm({ ...form, contact: e.target.value })} className="w-full bg-[#05070a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Entrega</label>
                <input required type="text" value={form.deliveryDays} onChange={e => setForm({ ...form, deliveryDays: e.target.value })} className="w-full bg-[#05070a] border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-indigo-500" />
              </div>
            </div>
            <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-lg active:scale-95 transition-all">Salvar Catálogo</button>
          </div>

          <div className="flex-1 bg-black/40 rounded-[1.5rem] border border-white/5 p-4 md:p-6 flex flex-col overflow-hidden">
            <div className="relative mb-4 shrink-0">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">search</span>
              <input type="text" placeholder="Filtrar produtos..." value={searchProduct} onChange={e => setSearchProduct(e.target.value)} className="w-full bg-black border border-white/10 rounded-2xl py-3.5 pl-12 pr-4 text-sm text-white outline-none focus:border-indigo-500" />
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-6 pr-1">
              {Object.entries(CATEGORY_UI).map(([catKey, ui]) => {
                const items = groupedIngredients[catKey] || [];
                if (items.length === 0) return null;
                return (
                  <div key={catKey} className="space-y-2">
                    <h4 className="text-[9px] font-black uppercase tracking-[0.2em] text-slate-500 px-2">{ui.label}</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {items.map(ing => (
                        <label key={ing.id} className={`flex items-center justify-between p-3 rounded-xl cursor-pointer border transition-all ${selectedProductIds.includes(ing.id) ? 'bg-indigo-600/10 border-indigo-500/40' : 'bg-white/5 border-transparent hover:bg-white/10'}`}>
                          <div className="flex items-center gap-3">
                            <div className={`size-8 rounded-lg flex items-center justify-center ${selectedProductIds.includes(ing.id) ? 'bg-indigo-500 text-white' : 'bg-black text-slate-600'}`}>
                              <span className="material-symbols-outlined text-base">{selectedProductIds.includes(ing.id) ? 'check' : 'inventory_2'}</span>
                            </div>
                            <span className={`text-xs font-bold ${selectedProductIds.includes(ing.id) ? 'text-white' : 'text-slate-400'}`}>{ing.name}</span>
                          </div>
                          <input type="checkbox" className="hidden" checked={selectedProductIds.includes(ing.id)} onChange={() => toggleProduct(ing.id)} />
                        </label>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── DASHBOARD PRINCIPAL ───
export default function PurchasingDashboard() {
  const { ingredients, suppliers, purchaseOrders, createPurchaseOrder, updateOrderQuote, receivePurchaseOrder, addSupplier, updateSupplierLinks } = useCMV();

  const [comprasTab, setComprasTab] = useState<ComprasTab>('SUGESTOES');
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | undefined>(undefined);
  const [purchaseEdits, setPurchaseEdits] = useState<Record<string, number>>({});
  const [manualAdditions, setManualAdditions] = useState<Record<string, string[]>>({});
  const [showManualSelector, setShowManualSelector] = useState<string | null>(null);

  const handlePurchaseEdit = (ingId: string, val: string) => {
    setPurchaseEdits(prev => ({ ...prev, [ingId]: parseFloat(val) || 0 }));
  };

  const handleAddManualItem = (supplierId: string, ingId: string) => {
    setManualAdditions(prev => {
      const existing = prev[supplierId] || [];
      if (existing.includes(ingId)) return prev;
      return { ...prev, [supplierId]: [...existing, ingId] };
    });
  };

  const unlinkedItems = useMemo(() => {
    return ingredients.filter(i => {
      const isLow = i.minStock && i.stock <= i.minStock;
      if (!isLow) return false;
      return !suppliers.some(sup => i.supplierIds?.includes(sup.id) || sup.categories?.includes(i.category));
    });
  }, [ingredients, suppliers]);

  const suggestedOrdersBySupplier = useMemo(() => {
    const orders: Record<string, { supplier: Supplier, items: any[] }> = {};
    suppliers.forEach(sup => {
      const manualIds = manualAdditions[sup.id] || [];
      const supItems = ingredients.filter(i => {
        const isLowAndLinked = (i.minStock && i.stock <= i.minStock) && (i.supplierIds?.includes(sup.id) || sup.categories?.includes(i.category));
        return isLowAndLinked || manualIds.includes(i.id);
      });
      if (supItems.length > 0) {
        orders[sup.id] = {
          supplier: sup, items: supItems.map(item => ({
            ...item,
            sugerido: purchaseEdits[item.id] || (manualIds.includes(item.id) ? 1 : Math.ceil(((item.minStock || 0) * 1.5) - item.stock)),
            isManual: manualIds.includes(item.id)
          })).filter(i => i.sugerido > 0)
        };
      }
    });
    return Object.values(orders);
  }, [ingredients, suppliers, purchaseEdits, manualAdditions]);

  const generateOrderAndWhatsApp = (supplier: Supplier, items: any[]) => {
    const orderItems = items.map(i => ({ ingredientId: i.id, quantity: i.sugerido, quotedPrice: i.costPerUnit }));
    createPurchaseOrder(supplier.id, orderItems);
    let msg = `*Pedido - SushiFlow*\n${supplier.name}\n\n`;
    items.forEach(i => { msg += `• ${i.name}: *${i.sugerido} ${i.unit}*\n`; });
    window.open(`https://wa.me/${supplier.contact}?text=${encodeURIComponent(msg)}`, '_blank');
    setManualAdditions({});
    setComprasTab('ESTEIRA');
  };

  const [actionOrderModal, setActionOrderModal] = useState<{ orderId: string, type: 'QUOTE' | 'RECEIVE' } | null>(null);
  const [actionItems, setActionItems] = useState<Record<string, { quantity: number, quotedPrice: number }>>({});

  const saveOrderAction = () => {
    if (!actionOrderModal) return;
    const final = Object.entries(actionItems).map(([id, data]) => ({ ingredientId: id, quantity: data.quantity, quotedPrice: data.quotedPrice }));
    if (actionOrderModal.type === 'QUOTE') updateOrderQuote(actionOrderModal.orderId, final);
    else receivePurchaseOrder(actionOrderModal.orderId, final);
    setActionOrderModal(null);
  };

  return (
    <div className="h-full flex flex-col bg-[#05070a] text-slate-100 overflow-hidden relative">

      {showSupplierModal && (
        <SupplierModal ingredients={ingredients} existingSupplier={editingSupplier} onClose={() => { setShowSupplierModal(false); setEditingSupplier(undefined); }} onSave={(s, ids) => editingSupplier ? updateSupplierLinks(s.id, ids) : addSupplier(s, ids)} />
      )}

      {showManualSelector && (
        <div className="fixed inset-0 z-[500] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#0d1218] border border-white/10 rounded-[2rem] p-6 w-full max-w-lg shadow-2xl flex flex-col max-h-[85vh]">
            <h3 className="text-lg font-black text-white italic mb-6 uppercase">Adicionar Extra</h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-2">
              {ingredients
                .filter(i => i.supplierIds?.includes(showManualSelector) || suppliers.find(s => s.id === showManualSelector)?.categories.includes(i.category))
                .map(ing => {
                  const isAdded = manualAdditions[showManualSelector]?.includes(ing.id);
                  return (
                  <button key={ing.id} onClick={() => handleAddManualItem(showManualSelector, ing.id)} disabled={isAdded} className={`w-full p-4 rounded-2xl text-left flex justify-between items-center group transition-all ${isAdded ? 'bg-emerald-500/10 opacity-50 cursor-not-allowed' : 'bg-white/5 active:bg-indigo-600'}`}>
                    <span className="text-sm font-bold text-white">{ing.name}</span>
                    <span className={`material-symbols-outlined ${isAdded ? 'text-emerald-500' : 'text-indigo-500'}`}>{isAdded ? 'check_circle' : 'add_circle'}</span>
                  </button>
                  );
                })}
            </div>
            <button onClick={() => setShowManualSelector(null)} className="mt-4 w-full py-3 text-slate-500 font-black uppercase text-[10px]">Fechar</button>
          </div>
        </div>
      )}

      <header className="bg-[#0d1218] border-b border-white/5 shrink-0 z-20">
        <div className="p-4 md:p-6 flex items-center justify-between">
          <h1 className="text-xl font-black italic tracking-tighter">CENTRAL<span className="text-indigo-400">COMPRAS</span></h1>
        </div>

        <div className="flex bg-black/40 overflow-x-auto no-scrollbar border-t border-white/5 px-2">
          {(['SUGESTOES', 'ESTEIRA', 'FORNECEDORES'] as ComprasTab[]).map(t => (
            <button key={t} onClick={() => setComprasTab(t)} className={`flex-1 min-w-[120px] py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${comprasTab === t ? 'text-indigo-400' : 'text-slate-500'}`}>
              {t === 'SUGESTOES' ? 'Sugestões' : t === 'ESTEIRA' ? 'Esteira' : 'Parceiros'}
              {comprasTab === t && <div className="absolute bottom-0 left-4 right-4 h-1 bg-indigo-600 rounded-t-full shadow-[0_0_15px_rgba(79,70,229,0.5)]"></div>}
            </button>
          ))}
        </div>
      </header>

      <main className="flex-1 overflow-y-auto custom-scrollbar p-4 md:p-8 pb-20">

        {comprasTab === 'SUGESTOES' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4">

            {unlinkedItems.length > 0 && (
              <div className="bg-rose-500/10 border border-rose-500/30 rounded-[2rem] p-6 shadow-2xl">
                <div className="flex items-center gap-3 mb-4 text-rose-400">
                  <span className="material-symbols-outlined">link_off</span>
                  <h3 className="text-sm font-black uppercase italic">Sem Fornecedor</h3>
                </div>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {unlinkedItems.map(i => (
                    <div key={i.id} className="bg-black/60 border border-rose-500/20 px-4 py-3 rounded-xl shrink-0 flex items-center gap-3">
                      <span className="text-xs font-bold text-white">{i.name}</span>
                      <button onClick={() => setComprasTab('FORNECEDORES')} className="text-rose-500"><span className="material-symbols-outlined text-sm">person_add</span></button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {suggestedOrdersBySupplier.map(({ supplier, items }) => (
                <div key={supplier.id} className="bg-[#11161d] border border-white/5 rounded-[2rem] overflow-hidden flex flex-col shadow-2xl">
                  <div className="p-5 bg-white/5 border-b border-white/5 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h3 className="text-lg font-black text-white uppercase italic">{supplier.name}</h3>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button onClick={() => setShowManualSelector(supplier.id)} className="flex-1 px-4 py-3 bg-white/5 text-indigo-400 rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10">+ Extra</button>
                      <button onClick={() => generateOrderAndWhatsApp(supplier, items)} className="flex-1 px-4 py-3 bg-emerald-600 text-white rounded-xl text-[9px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/20">Cotar Zap</button>
                    </div>
                  </div>
                  <div className="p-4 space-y-2 bg-[#05070a]/50">
                    {items.map(i => (
                      <div key={i.id} className={`grid grid-cols-[1fr,90px] items-center p-4 rounded-2xl border gap-4 ${i.isManual ? 'bg-indigo-500/5 border-indigo-500/20' : 'bg-white/5 border-white/5'}`}>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{i.name}</p>
                          <p className="text-[9px] text-slate-500 uppercase mt-1">Stock: <span className={i.isManual ? 'text-indigo-400' : 'text-rose-400'}>{i.stock} {i.unit}</span></p>
                        </div>
                        <input type="number" step="0.5" value={i.sugerido} onChange={(e) => handlePurchaseEdit(i.id, e.target.value)} className={`w-full bg-black border rounded-xl py-2.5 text-center text-sm font-black outline-none ${i.isManual ? 'border-indigo-500 text-indigo-400' : 'border-white/10 text-emerald-400'}`} />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {comprasTab === 'ESTEIRA' && (
          <div className="flex gap-4 md:gap-8 overflow-x-auto pb-10 no-scrollbar snap-x h-full">
            {['COTAÇÃO', 'AGUARDANDO_ENTREGA', 'RECEBIDO'].map(status => (
              <div key={status} className="min-w-[310px] md:min-w-[380px] snap-center flex flex-col h-full bg-black/20 rounded-[2.5rem] p-4 border border-white/5">
                <h3 className="text-[10px] font-black text-slate-600 uppercase tracking-[0.3em] mb-6 px-4 flex items-center justify-between">
                  {status.replace('_', ' ')}
                  <span className="size-6 bg-white/5 rounded-full flex items-center justify-center text-[10px] text-indigo-400">{purchaseOrders.filter(o => o.status === status).length}</span>
                </h3>
                <div className="space-y-4 flex-1 overflow-y-auto pr-1 custom-scrollbar">
                  {purchaseOrders.filter(o => o.status === status).map(order => (
                    <div key={order.id} className="bg-[#11161d] border border-white/5 rounded-[2rem] p-6 shadow-xl relative group hover:border-indigo-500/30 transition-all">
                      <h4 className="text-sm font-black text-white mb-4 uppercase truncate italic">{suppliers.find(s => s.id === order.supplierId)?.name}</h4>
                      <div className="flex justify-between items-center mb-6 bg-black/40 p-4 rounded-2xl">
                        <div className="flex flex-col"><span className="text-[8px] text-slate-500 font-black uppercase">Volume</span><span className="text-xs font-bold">{order.items.length} itens</span></div>
                        <div className="text-right"><span className="text-[8px] text-slate-500 font-black uppercase">Total Est.</span><p className="text-sm font-black text-emerald-400 font-mono">R$ {order.totalEstimated.toFixed(2)}</p></div>
                      </div>
                      <button onClick={() => { setActionItems(Object.fromEntries(order.items.map(i => [i.ingredientId, { quantity: i.quantity, quotedPrice: i.quotedPrice }]))); setActionOrderModal({ orderId: order.id, type: status === 'COTAÇÃO' ? 'QUOTE' : 'RECEIVE' }); }}
                        className={`w-full py-4 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all ${status === 'COTAÇÃO' ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/10' : status === 'RECEBIDO' ? 'bg-white/5 text-slate-700 pointer-events-none' : 'bg-sky-500 text-black shadow-lg shadow-sky-500/10'}`}>
                        {status === 'COTAÇÃO' ? 'Lançar Preços' : status === 'RECEBIDO' ? 'Finalizado' : 'Receber Carga'}
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {comprasTab === 'FORNECEDORES' && (
          <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-center bg-[#0d1218] p-6 md:p-8 rounded-[2rem] border border-white/5 shadow-2xl gap-4 text-center sm:text-left">
              <div>
                <h2 className="text-2xl md:text-3xl font-black italic text-white tracking-tighter uppercase">Parceiros</h2>
                <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Gestão de Catálogo em Lote</p>
              </div>
              <button onClick={() => { setEditingSupplier(undefined); setShowSupplierModal(true); }} className="w-full sm:w-auto px-8 py-4 bg-indigo-600 text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg active:scale-95 transition-all">Novo Parceiro</button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {suppliers.map(sup => (
                <div key={sup.id} className="bg-[#11161d] border border-white/5 rounded-[2rem] p-7 shadow-xl group hover:border-indigo-500/30 transition-all flex flex-col">
                  <h3 className="text-xl font-black text-white italic truncate mb-6">{sup.name}</h3>
                  <div className="space-y-3 mb-8 bg-black/40 p-4 rounded-2xl">
                    <p className="text-[11px] text-slate-400 font-bold font-mono flex items-center gap-3"><span className="material-symbols-outlined text-indigo-400 text-sm">phone</span> {sup.contact}</p>
                    <p className="text-[11px] text-slate-400 font-bold uppercase flex items-center gap-3"><span className="material-symbols-outlined text-emerald-400 text-sm">schedule</span> {sup.deliveryDays}</p>
                  </div>
                  <div className="mt-auto pt-6 border-t border-white/5 flex justify-between items-center">
                    <span className="text-[10px] font-black text-white uppercase">{ingredients.filter(i => i.supplierIds?.includes(sup.id)).length} Itens</span>
                    <button onClick={() => { setEditingSupplier(sup); setShowSupplierModal(true); }} className="px-5 py-2.5 bg-white/5 hover:bg-indigo-600 rounded-xl text-[10px] font-black uppercase transition-all">Editar</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* MODAL DE AÇÃO FINAL (VALORES) */}
      {actionOrderModal && (
        <div className="fixed inset-0 z-[550] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-4 animate-in fade-in">
          <div className="bg-[#0d1218] border border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-3xl shadow-2xl flex flex-col max-h-[90vh]">
            <h3 className="text-2xl font-black text-white uppercase italic text-center mb-8">
              {actionOrderModal.type === 'QUOTE' ? 'Lançar Cotação' : 'Conferir Recebimento'}
            </h3>
            <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 mb-8">
              {Object.entries(actionItems).map(([ingId, data]) => {
                const ing = ingredients.find(i => i.id === ingId);
                return (
                  <div key={ingId} className="bg-white/5 p-4 md:p-5 rounded-2xl border border-white/5 flex flex-col gap-4">
                    <span className="text-sm font-black text-white truncate block">{ing?.name}</span>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block">Qtde ({ing?.unit})</label>
                        <input type="number" step="0.5" value={data.quantity} disabled={actionOrderModal.type === 'QUOTE'} onChange={(e) => setActionItems(p => ({ ...p, [ingId]: { ...p[ingId], quantity: parseFloat(e.target.value) || 0 } }))} className="w-full text-center py-3 rounded-xl text-sm font-black border bg-black border-white/10 text-white outline-none" />
                      </div>
                      <div>
                        <label className="text-[8px] font-black uppercase text-slate-500 mb-1 block">Preço Unit.</label>
                        <input type="number" step="0.01" value={data.quotedPrice} disabled={actionOrderModal.type === 'RECEIVE'} onChange={(e) => setActionItems(p => ({ ...p, [ingId]: { ...p[ingId], quotedPrice: parseFloat(e.target.value) || 0 } }))} className="w-full text-center py-3 rounded-xl text-sm font-black border bg-black border-white/10 text-amber-400 outline-none" />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-4 p-2 bg-black/40 rounded-[2rem] border border-white/5">
              <button onClick={() => setActionOrderModal(null)} className="px-8 py-5 text-slate-500 text-[10px] font-black uppercase">Voltar</button>
              <button onClick={saveOrderAction} className="flex-1 py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest shadow-lg active:scale-95 transition-all">Confirmar e Salvar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}