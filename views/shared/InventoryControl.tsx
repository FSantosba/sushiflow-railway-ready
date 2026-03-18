import React, { useMemo, useState } from 'react';
import { useCMV } from '../../context/CMVContext';
import { Ingredient } from '../../types';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';

const ALL_MENU = [...sushiMenu, ...barMenu, ...kitchenMenu];

const CATEGORY_UI: Record<string, { label: string; icon: string; color: string; border: string; bg: string }> = {
  proteina: { label: 'Corredor Frio: Proteínas', icon: 'set_meal', color: 'text-rose-400', border: 'border-rose-500/30', bg: 'bg-rose-500/10' },
  carboidrato: { label: 'Corredor 1: Grãos & Secos', icon: 'rice_bowl', color: 'text-amber-400', border: 'border-amber-500/30', bg: 'bg-amber-500/10' },
  molho: { label: 'Corredor 2: Molhos & Líquidos', icon: 'water_drop', color: 'text-blue-400', border: 'border-blue-500/30', bg: 'bg-blue-500/10' },
  misc: { label: 'Corredor 3: Hortifruti & Diversos', icon: 'nutrition', color: 'text-emerald-400', border: 'border-emerald-500/30', bg: 'bg-emerald-500/10' },
  embalagem: { label: 'Depósito: Embalagens', icon: 'takeout_dining', color: 'text-purple-400', border: 'border-purple-500/30', bg: 'bg-purple-500/10' },
};

const MOCK_USERS = ['Kenji Sato (Gerente)', 'Takashi (Sushiman)', 'Carlos (Cozinha Quente)', 'Bruno (Fritos)'];

const getStockStatus = (stock: number, min: number = 0) => {
  if (min === 0) return { pct: 100, color: 'bg-emerald-500', alert: false };
  const pct = Math.min((stock / min) * 100, 100);
  if (pct <= 50) return { pct, color: 'bg-rose-500', alert: true };
  if (pct <= 100) return { pct, color: 'bg-amber-500', alert: true };
  return { pct: 100, color: 'bg-emerald-500', alert: false };
};

// ─── Modal: Cadastrar / Editar Ingrediente ───────────────────
const IngredientModal: React.FC<{
  onClose: () => void;
  onAdd: (ing: Ingredient) => void;
  onUpdate: (id: string, updates: Partial<Ingredient>) => void;
  initial?: Ingredient; // se passado → modo EDIÇÃO
}> = ({ onClose, onAdd, onUpdate, initial }) => {
  const isEdit = !!initial;
  const [form, setForm] = useState({
    name: initial?.name ?? '',
    category: initial?.category ?? 'proteina',
    unit: initial?.unit ?? 'kg',
    costPerUnit: initial?.costPerUnit?.toString() ?? '',
    stock: initial?.stock?.toString() ?? '',
    minStock: initial?.minStock?.toString() ?? '',
  });
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isEdit && initial) {
      onUpdate(initial.id, {
        name: form.name,
        category: form.category,
        unit: form.unit,
        costPerUnit: parseFloat(form.costPerUnit) || 0,
        stock: parseFloat(form.stock) || 0,
        minStock: parseFloat(form.minStock) || 0,
      });
    } else {
      onAdd({
        id: `ing_${Date.now()}`,
        name: form.name,
        category: form.category,
        unit: form.unit,
        costPerUnit: parseFloat(form.costPerUnit) || 0,
        stock: parseFloat(form.stock) || 0,
        minStock: parseFloat(form.minStock) || 0,
      });
    }
    onClose();
  };

  const title = isEdit ? 'Editar Ingrediente' : 'Novo Ingrediente';
  const btnLabel = isEdit ? 'Salvar Alterações' : 'Cadastrar Ingrediente';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
      <div className="bg-[#0d1218] border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-black text-white italic">{title}</h2>
          <button onClick={onClose} className="size-8 bg-white/5 rounded-full flex items-center justify-center text-slate-400 hover:text-white">
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Nome do Insumo</label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)}
                placeholder="Ex: Salmão Fresco (Kg)"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Categoria</label>
              <select value={form.category} onChange={e => set('category', e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary appearance-none">
                {Object.entries(CATEGORY_UI).map(([k, v]) =>
                  <option key={k} value={k}>{v.label.split(': ')[1]}</option>
                )}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Unidade</label>
              <select value={form.unit} onChange={e => set('unit', e.target.value)}
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary appearance-none">
                {['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct'].map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Custo por Unidade (R$)</label>
              <input required type="number" step="0.01" min="0" value={form.costPerUnit} onChange={e => set('costPerUnit', e.target.value)}
                placeholder="0,00"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Estoque Atual</label>
              <input required type="number" step="0.5" min="0" value={form.stock} onChange={e => set('stock', e.target.value)}
                placeholder="0"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
            </div>
            <div className="col-span-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">Estoque Mínimo (alerta)</label>
              <input type="number" step="0.5" min="0" value={form.minStock} onChange={e => set('minStock', e.target.value)}
                placeholder="0"
                className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-3 text-sm text-white outline-none focus:border-primary" />
            </div>
          </div>
          <button type="submit"
            className="w-full py-4 bg-primary text-white rounded-2xl font-black uppercase tracking-widest mt-2 hover:bg-primary/80 transition-colors shadow-[0_8px_24px_rgba(230,99,55,0.3)]">
            {btnLabel}
          </button>
        </form>
      </div>
    </div>
  );
};

// ─── Componente Principal ─────────────────────────────────
const InventoryControl: React.FC = () => {
  const { ingredients, recipes, inventoryLogs, addIngredient, updateIngredient, removeIngredient, registerInventoryTransaction } = useCMV();

  const [activeTab, setActiveTab] = useState<string>('proteina');
  const [sidebarTab, setSidebarTab] = useState<'carrinho' | 'entrada' | 'reposicao' | 'logs'>('carrinho');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<Ingredient | null>(null);

  // ── Carrinho (RETIRADA) ───────────────────────────────────
  const [cart, setCart] = useState<Record<string, number>>({});
  const [selectedUser, setSelectedUser] = useState(MOCK_USERS[0]);
  const [notes, setNotes] = useState('');

  // ── Aba Entrada ───────────────────────────────────────────
  const [entradaItems, setEntradaItems] = useState<{ id: string; qty: number }[]>([]);
  const [entradaUser, setEntradaUser] = useState(MOCK_USERS[0]);
  const [entradaSearchQuery, setEntradaSearchQuery] = useState('');
  const [entradaNote, setEntradaNote] = useState('');
  const [entradaSuccess, setEntradaSuccess] = useState(false);

  const filteredIngForEntrada = entradaSearchQuery.trim()
    ? ingredients.filter(i =>
      i.name.toLowerCase().includes(entradaSearchQuery.toLowerCase()))
    : ingredients;

  const addEntradaItem = (ingId: string) => {
    setEntradaItems(prev => {
      if (prev.find(i => i.id === ingId)) return prev;
      return [...prev, { id: ingId, qty: 1 }];
    });
    setEntradaSearchQuery('');
  };

  const updateEntradaQty = (ingId: string, val: string) => {
    const num = parseFloat(val);
    if (isNaN(num) || num <= 0) {
      setEntradaItems(prev => prev.filter(i => i.id !== ingId));
    } else {
      setEntradaItems(prev => prev.map(i => i.id === ingId ? { ...i, qty: +num.toFixed(3) } : i));
    }
  };

  const handleEntradaCheckout = () => {
    if (entradaItems.length === 0) return;
    const itemsToLog = entradaItems.map(({ id, qty }) => ({ ingredientId: id, quantity: qty }));
    registerInventoryTransaction(entradaUser, 'ENTRADA', itemsToLog, entradaNote || undefined);
    setEntradaItems([]);
    setEntradaNote('');
    setEntradaSuccess(true);
    setTimeout(() => { setEntradaSuccess(false); setSidebarTab('logs'); }, 1500);
  };

  const entradaCost = entradaItems.reduce((acc, { id, qty }) => {
    const ing = ingredients.find(i => i.id === id);
    return acc + (ing ? ing.costPerUnit * qty : 0);
  }, 0);

  // ✨ Retirada por Receita
  const [recipeMode, setRecipeMode] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState('');
  const [recipePortions, setRecipePortions] = useState(1);

  const aisles = useMemo(() => {
    const acc: Record<string, Ingredient[]> = { proteina: [], carboidrato: [], molho: [], misc: [], embalagem: [] };
    ingredients.forEach(ing => { if (acc[ing.category]) acc[ing.category].push(ing); });
    return acc;
  }, [ingredients]);

  const alertItems = ingredients.filter(i => i.minStock && i.stock <= i.minStock);

  // ✨ Patrimônio total em estoque
  const patrimonioTotal = ingredients.reduce((acc, i) => acc + i.stock * i.costPerUnit, 0);

  // Pratos que têm ficha técnica
  const menuItemsWithRecipe = ALL_MENU.filter(m => recipes.some(r => r.menuItemId === m.id));

  // ✨ Pré-preenche o carrinho com os ingredientes da receita × porções (editável)
  const handlePreencherPorReceita = () => {
    const recipe = recipes.find(r => r.menuItemId === selectedRecipeId);
    if (!recipe) return;
    const portionsFactor = recipePortions / (recipe.yield || 1);
    const newCart: Record<string, number> = { ...cart };
    recipe.items.forEach(ri => {
      const qty = +(ri.quantity * portionsFactor).toFixed(3);
      newCart[ri.ingredientId] = (newCart[ri.ingredientId] || 0) + qty;
    });
    setCart(newCart);
    setRecipeMode(false);
    setSidebarTab('carrinho');
  };

  const handleAddToCart = (id: string, delta: number) => {
    setSidebarTab('carrinho');
    setCart(prev => {
      const current = prev[id] || 0;
      const next = Math.max(0, +(current + delta).toFixed(3));
      if (next === 0) { const copy = { ...prev }; delete copy[id]; return copy; }
      return { ...prev, [id]: next };
    });
  };

  // Editar quantidade diretamente no carrinho
  const handleCartQtyEdit = (id: string, value: string) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) {
      setCart(prev => { const copy = { ...prev }; delete copy[id]; return copy; });
    } else {
      setCart(prev => ({ ...prev, [id]: +num.toFixed(3) }));
    }
  };

  const selectedIngredientsForCart = Object.keys(cart).map(id => {
    const ing = ingredients.find(i => i.id === id);
    return ing ? { ...ing, cartQty: cart[id] } : null;
  }).filter(Boolean) as (Ingredient & { cartQty: number })[];

  // ✨ Custo total da movimentação no carrinho
  const cartCost = selectedIngredientsForCart.reduce((acc, i) => acc + i.costPerUnit * i.cartQty, 0);

  const handleCheckout = () => {
    if (Object.keys(cart).length === 0) return;
    const itemsToLog = Object.entries(cart).map(([id, qty]) => ({
      ingredientId: id,
      quantity: -qty, // Carrinho é apenas RETIRADA
    }));
    const notesWithRecipe = notes || (recipeMode && selectedRecipeId
      ? `Receita: ${ALL_MENU.find(m => m.id === selectedRecipeId)?.name} ×${recipePortions}`
      : '');
    registerInventoryTransaction(selectedUser, 'RETIRADA', itemsToLog, notesWithRecipe);
    setCart({});
    setNotes('');
    setSidebarTab('logs');
  };

  // ✨ Exportar lista de compras para clipboard
  const handleExportList = () => {
    const lines = [
      '📋 LISTA DE COMPRAS — SushiFlow',
      `📅 ${new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}`,
      '─'.repeat(40),
      ...alertItems.map(item => {
        const sugerido = Math.max(0, ((item.minStock || 0) * 1.5) - item.stock);
        const isUnit = ['un', 'cx'].includes(item.unit);
        return `• ${item.name}: comprar ${sugerido.toFixed(isUnit ? 0 : 1)} ${item.unit}  (tem: ${item.stock}, mín: ${item.minStock})`;
      }),
      '─'.repeat(40),
      `💰 Custo estimado: R$ ${alertItems.reduce((acc, i) => acc + Math.max(0, ((i.minStock || 0) * 1.5 - i.stock)) * i.costPerUnit, 0).toFixed(2)}`,
    ];
    navigator.clipboard.writeText(lines.join('\n'))
      .then(() => alert('✅ Lista copiada para o clipboard!'))
      .catch(() => alert(lines.join('\n')));
  };

  return (
    <div className="h-full flex flex-col md:flex-row bg-[#080c10] overflow-hidden">
      {(showAddModal || editingIngredient) && (
        <IngredientModal
          onClose={() => { setShowAddModal(false); setEditingIngredient(null); }}
          onAdd={addIngredient}
          onUpdate={updateIngredient}
          initial={editingIngredient ?? undefined}
        />
      )}

      {/* ─── PRATELEIRAS ──────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <div className="p-6 lg:p-10 pb-4 shrink-0 border-b border-white/5 bg-[#0b1015]">
          <div className="flex flex-col sm:flex-row items-start sm:items-end justify-between gap-4 mb-6">
            <div>
              <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1 flex items-center gap-2">
                <span className="material-symbols-outlined text-[12px]">storefront</span>
                Mercadinho SushiFlow
              </p>
              <h2 className="text-3xl font-black italic uppercase tracking-tighter text-white">Inventário em Tempo Real</h2>
            </div>

            {/* ✨ Patrimônio + Botão cadastrar */}
            <div className="flex items-center gap-3">
              <div className="bg-[#111820] border border-white/5 py-2 px-4 rounded-2xl shadow-lg text-right">
                <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest leading-none">Patrimônio em Estoque</p>
                <p className="text-xl font-black text-white italic tracking-tighter">R$ {patrimonioTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
              <button onClick={() => setShowAddModal(true)}
                className="size-12 bg-primary/20 hover:bg-primary/30 border border-primary/40 text-primary rounded-2xl flex items-center justify-center transition-all"
                title="Cadastrar novo ingrediente">
                <span className="material-symbols-outlined">add</span>
              </button>
            </div>
          </div>

          {/* Abas dos Corredores */}
          <div className="flex flex-wrap gap-2">
            {Object.keys(aisles).map(key => {
              const ui = CATEGORY_UI[key];
              const isActive = activeTab === key;
              const alertCount = aisles[key].filter(i => i.minStock && i.stock <= i.minStock).length;
              return (
                <button key={key} onClick={() => setActiveTab(key)}
                  className={`relative flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all border ${isActive ? `${ui.bg} ${ui.border} ${ui.color}` : 'bg-white/5 border-transparent text-slate-400 hover:bg-white/10'
                    }`}>
                  <span className="material-symbols-outlined text-sm">{ui.icon}</span>
                  <span className="uppercase tracking-widest">{ui.label.split(': ')[0]}</span>
                  {alertCount > 0 && (
                    <span className="absolute -top-1 -right-1 size-4 bg-rose-500 rounded-full text-[9px] font-black text-white flex items-center justify-center">
                      {alertCount}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Grade de Produtos */}
        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 lg:p-10">
          <div className="space-y-6">
            <h3 className="text-xl font-black uppercase tracking-widest text-white italic pl-2 border-l-4 border-emerald-500">
              {CATEGORY_UI[activeTab].label}
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-24">
              {aisles[activeTab].map(ing => {
                const status = getStockStatus(ing.stock, ing.minStock);
                const isUnit = ['un', 'cx'].includes(ing.unit);
                const step = isUnit ? 1 : 0.5;
                const inCart = cart[ing.id] || 0;

                return (
                  <div key={ing.id}
                    className={`group relative bg-[#111820] border rounded-2xl p-4 transition-all shadow-md flex flex-col ${inCart > 0 ? 'border-primary shadow-primary/20 scale-[1.02]' : 'border-white/5 hover:border-white/20'
                      }`}>

                    {/* ✨ Botão de edição */}
                    <button
                      onClick={() => setEditingIngredient(ing)}
                      className="absolute top-3 left-3 size-7 bg-white/5 hover:bg-indigo-500/20 hover:text-indigo-400 border border-white/5 hover:border-indigo-500/30 rounded-lg flex items-center justify-center text-slate-600 transition-all z-10"
                      title="Editar ingrediente">
                      <span className="material-symbols-outlined text-sm">edit</span>
                    </button>

                    {/* Barra de nível (medidor) */}
                    {ing.minStock && (
                      <div className="absolute right-3 top-3 bottom-24 w-1.5 bg-black/50 rounded-full border border-white/10 overflow-hidden flex flex-col justify-end">
                        <div className={`w-full transition-all duration-700 ${status.color}`} style={{ height: `${status.pct}%` }} />
                      </div>
                    )}

                    <div className="pr-6 flex-1">
                      <div className="size-10 rounded-xl mb-3 flex items-center justify-center bg-white/5 text-slate-400">
                        <span className="material-symbols-outlined text-xl">{CATEGORY_UI[activeTab].icon}</span>
                      </div>
                      <h4 className="font-bold text-sm text-white leading-tight mb-2">{ing.name}</h4>
                      <div className="flex gap-2 text-[10px] font-mono flex-wrap">
                        <span className="px-2 py-0.5 bg-white/5 rounded text-slate-400">R$ {ing.costPerUnit.toFixed(2)}/{ing.unit}</span>
                        {ing.minStock && <span className="px-2 py-0.5 bg-white/5 rounded text-slate-400">Mín: {ing.minStock}</span>}
                        {/* ✨ Valor imobilizado desse item */}
                        <span className="px-2 py-0.5 bg-emerald-500/10 rounded text-emerald-600">
                          R$ {(ing.stock * ing.costPerUnit).toFixed(2)}
                        </span>
                      </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5 text-center">
                      <p className={`text-2xl font-black italic tracking-tighter ${status.alert ? status.color.replace('bg-', 'text-') : 'text-white'}`}>
                        {ing.stock}
                        <span className="text-sm ml-0.5">{ing.unit}</span>
                      </p>
                      <p className="text-[9px] uppercase tracking-widest text-slate-500 font-bold mb-3">Na Prateleira</p>
                    </div>

                    <div className="flex items-center gap-1 bg-[#0b1015] p-1 rounded-xl">
                      <button onClick={() => handleAddToCart(ing.id, -step)} disabled={inCart === 0}
                        className={`size-8 rounded-lg flex items-center justify-center transition-colors ${inCart > 0 ? 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30' : 'text-slate-600'}`}>
                        <span className="material-symbols-outlined text-sm font-black">remove</span>
                      </button>
                      <button onClick={() => handleAddToCart(ing.id, step)}
                        className={`flex-1 flex items-center justify-center gap-1 text-[10px] font-black uppercase tracking-widest rounded-lg py-2 transition-colors ${inCart > 0 ? 'bg-primary text-white' : 'bg-primary/10 text-primary hover:bg-primary/20'}`}>
                        <span className="material-symbols-outlined text-[14px]">shopping_cart</span>
                        {inCart > 0 ? `${inCart} ${ing.unit}` : 'Carrinho'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ─── SIDEBAR ──────────────────────────────── */}
      <aside className="w-full md:w-[360px] lg:w-[410px] bg-[#0d1218] border-t md:border-t-0 md:border-l border-white/5 flex flex-col shrink-0 shadow-[-10px_0_30px_rgba(0,0,0,0.5)] z-10">

        {/* Abas */}
        <div className="grid grid-cols-4 border-b border-white/5">
          {([
            { key: 'carrinho', label: 'Retirada', icon: 'shopping_cart', color: 'text-primary border-primary bg-primary/5', badge: Object.keys(cart).length },
            { key: 'entrada', label: 'Entrada', icon: 'add_box', color: 'text-emerald-500 border-emerald-500 bg-emerald-500/5', badge: entradaItems.length },
            { key: 'reposicao', label: 'Repor', icon: 'warning', color: 'text-amber-500 border-amber-500 bg-amber-500/5', badge: alertItems.length },
            { key: 'logs', label: 'Logs', icon: 'receipt_long', color: 'text-slate-400 border-slate-400 bg-slate-400/5', badge: 0 },
          ] as const).map(tab => (
            <button key={tab.key} onClick={() => setSidebarTab(tab.key as typeof sidebarTab)}
              className={`py-3 text-[9px] font-black uppercase tracking-widest border-b-2 transition-colors relative flex flex-col items-center gap-0.5 ${sidebarTab === tab.key ? tab.color : 'text-slate-600 border-transparent hover:text-slate-400 hover:bg-white/5'
                }`}>
              <span className="material-symbols-outlined text-base">{tab.icon}</span>
              {tab.label}
              {tab.badge > 0 && (
                <span className="absolute top-1.5 right-2 size-4 bg-rose-500 rounded-full text-[8px] font-black text-white flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-hidden relative">

          {/* ── ABA: CARRINHO (RETIRADA) ─────────── */}
          {sidebarTab === 'carrinho' && (
            <div className="absolute inset-0 flex flex-col p-5 animate-in fade-in duration-200">
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <span className="material-symbols-outlined text-primary text-sm">shopping_cart</span>
                <h3 className="text-sm font-black italic uppercase text-white">Retirada do Estoque</h3>
              </div>
              <div className="space-y-3 mb-4 shrink-0">

                {/* Responsável */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Responsável</label>
                  <select value={selectedUser} onChange={e => setSelectedUser(e.target.value)}
                    className="w-full bg-[#111820] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-primary appearance-none">
                    {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* ✨ Retirada por Receita */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Receita (opcional)</label>
                    <button onClick={() => setRecipeMode(v => !v)}
                      className={`text-[9px] font-black uppercase px-2 py-1 rounded-lg transition-all ${recipeMode ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-white/5 text-slate-500'
                        }`}>
                      {recipeMode ? '✕ Fechar' : '+ Por Receita'}
                    </button>
                  </div>

                  {recipeMode && (
                    <div className="bg-[#080c10] border border-white/10 rounded-xl p-3 space-y-3 animate-in slide-in-from-top-2">
                      <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)}
                        className="w-full bg-[#111820] border border-white/5 rounded-lg px-3 py-2 text-xs font-bold text-white focus:outline-none focus:border-primary appearance-none">
                        <option value="">Selecione o prato...</option>
                        {menuItemsWithRecipe.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      <div className="flex items-center gap-2">
                        <div className="flex-1">
                          <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Porções</label>
                          <input type="number" min={1} value={recipePortions}
                            onChange={e => setRecipePortions(Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-full bg-[#111820] border border-white/5 rounded-lg px-3 py-2 text-sm font-black text-white focus:outline-none focus:border-primary" />
                        </div>
                        <button onClick={handlePreencherPorReceita} disabled={!selectedRecipeId}
                          className="mt-4 px-4 py-2 bg-indigo-500 hover:bg-indigo-400 disabled:opacity-30 disabled:cursor-not-allowed text-white rounded-lg font-black text-[10px] uppercase transition-colors">
                          Preencher
                        </button>
                      </div>
                      <p className="text-[9px] text-slate-500 italic">
                        Os ingredientes serão pré-calculados. Você pode ajustar as quantidades livremente antes de confirmar.
                      </p>
                    </div>
                  )}
                </div>

                {/* Observações */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Observação</label>
                  <input type="text" value={notes} onChange={e => setNotes(e.target.value)}
                    placeholder="Ex: Refugo, emergência..."
                    className="w-full bg-[#111820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
              </div>

              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 pb-2 border-b border-white/5 shrink-0">
                Itens{selectedIngredientsForCart.length > 0 && ` (${selectedIngredientsForCart.length})`}
              </h4>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {selectedIngredientsForCart.length > 0 ? selectedIngredientsForCart.map(item => (
                  <div key={item.id} className="flex items-center gap-2 p-3 bg-white/5 rounded-xl border border-white/5">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-bold text-white truncate">{item.name}</p>
                      <p className="text-[10px] text-slate-500">Prateleira: {item.stock} {item.unit}</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-rose-400">-</span>
                      <input
                        type="number"
                        min={0}
                        step={['un', 'cx'].includes(item.unit) ? 1 : 0.1}
                        value={item.cartQty}
                        onChange={e => handleCartQtyEdit(item.id, e.target.value)}
                        className="w-16 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-xs font-black text-white text-center focus:outline-none focus:border-primary"
                      />
                      <span className="text-[10px] text-slate-500">{item.unit}</span>
                    </div>
                    <button onClick={() => handleAddToCart(item.id, -item.cartQty)}
                      className="size-6 bg-white/5 rounded flex justify-center items-center text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                      <span className="material-symbols-outlined text-[14px]">close</span>
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-10 opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-2 text-primary block">add_shopping_cart</span>
                    <p className="text-xs font-bold text-slate-400 uppercase">Carrinho Vazio</p>
                    <p className="text-[10px] text-slate-500 mt-1">Clique nos itens das prateleiras<br />ou use "Por Receita"</p>
                  </div>
                )}
              </div>

              {selectedIngredientsForCart.length > 0 && (
                <div className="pt-4 mt-3 border-t border-white/5 shrink-0 space-y-3">
                  {/* ✨ Custo da movimentação */}
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo Retirado</span>
                    <span className="text-base font-black italic text-rose-400">
                      - R$ {cartCost.toFixed(2)}
                    </span>
                  </div>
                  <button onClick={handleCheckout}
                    className="w-full py-4 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95 bg-primary shadow-primary/20 hover:bg-primary/80">
                    <span className="material-symbols-outlined text-sm">inventory</span>
                    Confirmar Retirada
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ABA: ENTRADA ─────────────────────── */}
          {sidebarTab === 'entrada' && (
            <div className="absolute inset-0 flex flex-col p-5 animate-in fade-in duration-200">

              {/* Cabeçalho da aba */}
              <div className="flex items-center gap-2 mb-4 shrink-0">
                <span className="material-symbols-outlined text-emerald-500 text-sm">add_box</span>
                <h3 className="text-sm font-black italic uppercase text-white">Entrada de Mercadoria</h3>
              </div>

              {/* Sucesso flash */}
              {entradaSuccess && (
                <div className="mb-3 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center gap-2 text-emerald-400 text-xs font-black animate-in zoom-in-95 shrink-0">
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Entrada registrada com sucesso!
                </div>
              )}

              <div className="space-y-3 mb-4 shrink-0">
                {/* Responsável */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Recebido por</label>
                  <select value={entradaUser} onChange={e => setEntradaUser(e.target.value)}
                    className="w-full bg-[#111820] border border-white/10 rounded-xl px-4 py-2.5 text-sm font-bold text-white focus:outline-none focus:border-emerald-500 appearance-none">
                    {MOCK_USERS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>

                {/* Busca de ingrediente */}
                <div className="relative">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Adicionar Produto</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-sm">search</span>
                    <input
                      type="text"
                      placeholder="Buscar ingrediente..."
                      value={entradaSearchQuery}
                      onChange={e => setEntradaSearchQuery(e.target.value)}
                      className="w-full bg-[#111820] border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500"
                    />
                  </div>
                  {/* Dropdown de resultados */}
                  {entradaSearchQuery.trim() && (
                    <div className="absolute z-20 w-full mt-1 bg-[#1a2229] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-40 overflow-y-auto">
                      {filteredIngForEntrada.length > 0 ? filteredIngForEntrada.map(ing => (
                        <button key={ing.id} onClick={() => addEntradaItem(ing.id)}
                          className="w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-emerald-500/10 hover:text-white transition-colors flex items-center justify-between">
                          <span className="font-bold">{ing.name}</span>
                          <span className="text-slate-500 font-mono">{ing.stock} {ing.unit}</span>
                        </button>
                      )) : (
                        <p className="px-4 py-3 text-xs text-slate-500">Nenhum resultado</p>
                      )}
                    </div>
                  )}
                </div>

                {/* Nota / NF */}
                <div>
                  <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-1 block">Nota Fiscal / Observação</label>
                  <input type="text" value={entradaNote} onChange={e => setEntradaNote(e.target.value)}
                    placeholder="Ex: NF 00123, Fornecedor X..."
                    className="w-full bg-[#111820] border border-white/10 rounded-xl px-4 py-2.5 text-sm text-white focus:outline-none focus:border-emerald-500" />
                </div>
              </div>

              {/* Lista de itens adicionados */}
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2 pb-2 border-b border-white/5 shrink-0">
                Itens a Receber {entradaItems.length > 0 && `(${entradaItems.length})`}
              </h4>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-2 pr-1">
                {entradaItems.length > 0 ? entradaItems.map(({ id, qty }) => {
                  const ing = ingredients.find(i => i.id === id);
                  if (!ing) return null;
                  return (
                    <div key={id} className="flex items-center gap-2 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-white truncate">{ing.name}</p>
                        <p className="text-[10px] text-slate-500">Prateleira: {ing.stock} {ing.unit}</p>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-400">+</span>
                        <input
                          type="number" min={0.1} step={['un', 'cx'].includes(ing.unit) ? 1 : 0.1}
                          value={qty}
                          onChange={e => updateEntradaQty(id, e.target.value)}
                          className="w-16 bg-black/40 border border-emerald-500/30 rounded-lg px-2 py-1 text-xs font-black text-emerald-300 text-center focus:outline-none focus:border-emerald-400"
                        />
                        <span className="text-[10px] text-slate-500">{ing.unit}</span>
                      </div>
                      <button onClick={() => setEntradaItems(p => p.filter(i => i.id !== id))}
                        className="size-6 bg-white/5 rounded flex justify-center items-center text-slate-500 hover:bg-rose-500/20 hover:text-rose-400 transition-colors">
                        <span className="material-symbols-outlined text-[14px]">close</span>
                      </button>
                    </div>
                  );
                }) : (
                  <div className="text-center py-10 opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500 block">add_box</span>
                    <p className="text-xs font-bold text-slate-400 uppercase">Nenhum produto</p>
                    <p className="text-[10px] text-slate-500 mt-1">Busque um ingrediente acima<br />e defina a quantidade recebida</p>
                  </div>
                )}
              </div>

              {entradaItems.length > 0 && (
                <div className="pt-4 mt-3 border-t border-white/5 shrink-0 space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Valor Total Entrada</span>
                    <span className="text-base font-black italic text-emerald-400">+ R$ {entradaCost.toFixed(2)}</span>
                  </div>
                  <button onClick={handleEntradaCheckout}
                    className="w-full py-4 rounded-xl text-white text-xs font-black uppercase tracking-widest shadow-lg flex justify-center items-center gap-2 transition-all active:scale-95 bg-emerald-600 shadow-emerald-600/20 hover:bg-emerald-500">
                    <span className="material-symbols-outlined text-sm">inventory</span>
                    Confirmar Entrada
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── ABA: REPOSIÇÃO ───────────────────── */}
          {sidebarTab === 'reposicao' && (
            <div className="absolute inset-0 flex flex-col p-5 animate-in fade-in duration-200">
              <h3 className="text-sm font-black italic uppercase text-amber-500 mb-4 flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined">warning</span>
                Alertas de Compra
              </h3>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-1 border-b border-white/5 mb-4 pb-4">
                {alertItems.length > 0 ? alertItems.map(item => {
                  const sugerido = Math.max(0, ((item.minStock || 0) * 1.5) - item.stock);
                  const isUnit = ['un', 'cx'].includes(item.unit);
                  const custo = sugerido * item.costPerUnit;
                  return (
                    <div key={item.id} className="p-4 bg-amber-500/5 border border-amber-500/20 rounded-xl">
                      <p className="text-[9px] font-black tracking-widest text-amber-500 uppercase mb-1">Reposição Necessária</p>
                      <h4 className="text-sm font-bold text-white mb-2">{item.name}</h4>
                      <div className="grid grid-cols-3 gap-2 text-[10px] font-mono">
                        <div className="bg-black/30 rounded px-2 py-1 text-center">
                          <p className="text-slate-500">Tem</p>
                          <p className="text-amber-400 font-bold">{item.stock} {item.unit}</p>
                        </div>
                        <div className="bg-black/30 rounded px-2 py-1 text-center">
                          <p className="text-slate-500">Mín</p>
                          <p className="text-white font-bold">{item.minStock} {item.unit}</p>
                        </div>
                        <div className="bg-black/30 rounded px-2 py-1 text-center">
                          <p className="text-slate-500">Comprar</p>
                          <p className="text-rose-400 font-bold">{sugerido.toFixed(isUnit ? 0 : 1)} {item.unit}</p>
                        </div>
                      </div>
                      {/* ✨ Custo estimado por item */}
                      <p className="text-[10px] text-slate-500 mt-2 text-right">≈ R$ {custo.toFixed(2)}</p>
                    </div>
                  );
                }) : (
                  <div className="text-center py-10 opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-2 text-emerald-500 block">check_circle</span>
                    <p className="text-xs font-bold text-slate-400 uppercase">Tudo em Ordem</p>
                  </div>
                )}
              </div>

              <div className="shrink-0">
                <div className="flex justify-between items-center mb-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Custo Estimado da Compra</p>
                </div>
                <p className="text-3xl font-black italic tracking-tighter text-white mb-4">
                  R$ {alertItems.reduce((acc, i) => acc + Math.max(0, ((i.minStock || 0) * 1.5 - i.stock)) * i.costPerUnit, 0).toFixed(2)}
                </p>
                {/* ✨ Exportar lista funcionando */}
                <button onClick={handleExportList}
                  className="w-full py-3 bg-[#111820] border border-white/10 hover:bg-white/5 transition-all rounded-xl text-white text-xs font-black uppercase tracking-widest flex justify-center items-center gap-2">
                  <span className="material-symbols-outlined text-sm">content_copy</span>
                  Copiar Lista de Compras
                </button>
              </div>
            </div>
          )}

          {/* ── ABA: LOGS ────────────────────────── */}
          {sidebarTab === 'logs' && (
            <div className="absolute inset-0 flex flex-col p-5 animate-in fade-in duration-200">
              <h3 className="text-sm font-black italic uppercase text-emerald-500 mb-4 flex items-center gap-2 shrink-0">
                <span className="material-symbols-outlined">receipt_long</span>
                Extrato de Movimentações
              </h3>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-4 pr-1">
                {inventoryLogs.length > 0 ? inventoryLogs.map(log => {
                  // ✨ Calcula custo real da movimentação
                  const logCost = log.items.reduce((acc, li) => {
                    const ing = ingredients.find(i => i.id === li.ingredientId);
                    return acc + (ing ? ing.costPerUnit * Math.abs(li.quantity) : 0);
                  }, 0);
                  return (
                    <div key={log.id} className="p-4 bg-[#111820] border border-white/5 rounded-2xl relative">
                      <div className={`absolute top-0 right-0 px-2 py-1 text-[8px] font-black rounded-bl-lg rounded-tr-2xl uppercase ${log.type === 'RETIRADA' ? 'bg-rose-500/20 text-rose-400' :
                        log.type === 'ENTRADA' ? 'bg-emerald-500/20 text-emerald-400' :
                          'bg-slate-500/20 text-slate-400'
                        }`}>{log.type}</div>

                      <p className="font-bold text-sm text-white mb-0.5">
                        <span className="material-symbols-outlined text-xs mr-1 align-baseline text-slate-500">person</span>
                        {log.user}
                      </p>
                      <p className="text-[10px] text-slate-500 uppercase tracking-widest mb-3">
                        {new Date(log.timestamp).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}
                      </p>

                      <div className="space-y-1 mt-3 pt-3 border-t border-white/5">
                        {log.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-xs">
                            <span className="text-slate-300">
                              {item.quantity > 0 ? '+' : ''}{item.quantity} {item.ingredientName}
                            </span>
                            {/* ✨ Custo por item no log */}
                            {(() => {
                              const ing = ingredients.find(i => i.id === item.ingredientId);
                              if (!ing) return null;
                              const cost = ing.costPerUnit * Math.abs(item.quantity);
                              return <span className="text-slate-500 font-mono">R$ {cost.toFixed(2)}</span>;
                            })()}
                          </div>
                        ))}
                      </div>

                      {/* ✨ Total da movimentação */}
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-white/5">
                        <span className="text-[9px] text-slate-500 uppercase font-bold">Total movimentado</span>
                        <span className={`text-sm font-black italic ${log.type === 'RETIRADA' ? 'text-rose-400' : 'text-emerald-400'}`}>
                          {log.type === 'RETIRADA' ? '-' : '+'} R$ {logCost.toFixed(2)}
                        </span>
                      </div>

                      {log.notes && (
                        <div className="mt-2 p-2 bg-white/5 border border-white/5 rounded-lg text-[10px] text-slate-400 italic">
                          "{log.notes}"
                        </div>
                      )}
                    </div>
                  );
                }) : (
                  <div className="text-center py-10 opacity-50">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-500 block">history</span>
                    <p className="text-xs font-bold text-slate-400 uppercase">Nenhuma Movimentação</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>
  );
};

export default InventoryControl;
