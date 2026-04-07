import React, { useMemo, useState, useRef } from 'react';
import { useCMV, Supplier, ExtendedIngredient } from '../../context/CMVContext';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';

const ALL_MENU = [...sushiMenu, ...barMenu, ...kitchenMenu];

const CATEGORY_UI: Record<string, { label: string; icon: string; color: string; bg: string }> = {
  peixes: { label: 'Peixes & Frutos do Mar', icon: 'set_meal', color: 'text-sky-400', bg: 'bg-sky-400/10' },
  hortifruti: { label: 'Hortifruti', icon: 'nutrition', color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
  mercearia: { label: 'Mercearia & Secos', icon: 'rice_bowl', color: 'text-amber-400', bg: 'bg-amber-500/10' },
  embalagens: { label: 'Embalagens', icon: 'takeout_dining', color: 'text-rose-400', bg: 'bg-rose-500/10' },
  bebidas: { label: 'Bebidas', icon: 'local_shipping', color: 'text-purple-400', bg: 'bg-purple-400/10' },
  outros: { label: 'Insumos Gerais', icon: 'inventory_2', color: 'text-slate-400', bg: 'bg-slate-400/10' }
};

const USERS = [
  { name: 'Kenji (Gerente)', pin: '1234' },
  { name: 'Takashi (Sushiman)', pin: '0000' },
  { name: 'Carlos (Cozinha)', pin: '1111' }
];

const REASONS = ['Padrão (Produção)', '⚠️ Erro/Queimou', '💥 Caiu no chão', '🗑️ Insumo estragado', '✍️ Outros'];

type Mode = 'RETIRADA' | 'ENTRADA';

// ─── MODAL DE INGREDIENTE (CADASTRO E EDIÇÃO) ───
const IngredientModal: React.FC<{
  onClose: () => void;
  onSave: (ing: ExtendedIngredient) => void;
  suppliers: Supplier[];
  existingIngredient?: ExtendedIngredient;
}> = ({ onClose, onSave, suppliers, existingIngredient }) => {
  const [form, setForm] = useState({
    name: existingIngredient?.name || '',
    image: existingIngredient?.image || '',
    category: existingIngredient?.category || 'peixes',
    unit: existingIngredient?.unit || 'kg',
    costPerUnit: existingIngredient?.costPerUnit?.toString() || '',
    stock: existingIngredient?.stock?.toString() || '',
    minStock: existingIngredient?.minStock?.toString() || ''
  });

  const [imagePreview, setImagePreview] = useState(existingIngredient?.image || '');
  const [selectedSuppliers, setSelectedSuppliers] = useState<string[]>(existingIngredient?.supplierIds || []);
  const [imageResults, setImageResults] = useState<string[]>([]);
  const [searchingImages, setSearchingImages] = useState(false);
  const set = (k: string, v: string) => setForm(p => ({ ...p, [k]: v }));

  const toggleSupplier = (id: string) => {
    setSelectedSuppliers(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
  };

  const searchGoogleImages = async () => {
    if (!form.name.trim()) {
      alert('Digite o nome do insumo primeiro!');
      return;
    }
    setSearchingImages(true);
    setImageResults([]);
    try {
      const query = encodeURIComponent(form.name);
      console.log('Buscando:', query);
      const response = await fetch(`https://api.unsplash.com/search/photos?query=${query}&per_page=8&orientation=squarish`, {
        headers: {
          'Authorization': 'Client-ID AvqQ8Vk2gGqzJf9FpGxY3tNBhE6LBfXzWqJYJhV7B8M'
        }
      });
      console.log('Response:', response);
      const data = await response.json();
      console.log('Data:', data);
      if (data.results && data.results.length > 0) {
        const urls = data.results.map((item: any) => item.urls?.small).filter(Boolean);
        setImageResults(urls);
      } else {
        alert('Nenhuma imagem encontrada para "' + form.name + '"');
      }
    } catch (error) {
      console.error('Erro ao buscar imagens:', error);
      alert('Erro ao buscar imagens: ' + error);
    } finally {
      setSearchingImages(false);
    }
  };

  const selectImage = (url: string) => {
    setImagePreview(url);
    set('image', url);
    setImageResults([]);
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result as string;
        setImagePreview(base64);
        set('image', base64);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...existingIngredient,
      id: existingIngredient?.id || `ing_${Date.now()}`,
      name: form.name,
      image: form.image,
      category: form.category as any,
      unit: form.unit,
      costPerUnit: parseFloat(form.costPerUnit) || 0,
      stock: parseFloat(form.stock) || 0,
      minStock: parseFloat(form.minStock) || 0,
      supplierIds: selectedSuppliers
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-md p-2 md:p-4">
      <div className="bg-[#0d1218] border border-white/10 rounded-[2rem] md:rounded-[2.5rem] p-6 md:p-8 w-full max-w-md shadow-2xl animate-in zoom-in-95 max-h-[95vh] overflow-y-auto custom-scrollbar">
        <div className="flex justify-between items-center mb-6 md:mb-8">
          <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-tighter">
            {existingIngredient ? 'Editar Produto' : 'Novo Produto'}
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white"><span className="material-symbols-outlined">close</span></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-5 md:space-y-6">
          <div className="space-y-4">
            <div className="flex flex-col items-center">
              <label className="text-[10px] font-black uppercase text-slate-500 mb-2 block tracking-widest">Foto do Insumo</label>
              <div className="relative w-24 h-24 rounded-2xl border-2 border-dashed border-white/20 bg-white/5 overflow-hidden hover:border-indigo-500 transition-colors group">
                {imagePreview ? (
                  <>
                    <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                    <button type="button" onClick={() => { setImagePreview(''); set('image', ''); }} className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white">
                      <span className="material-symbols-outlined">delete</span>
                    </button>
                  </>
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer">
                    <span className="material-symbols-outlined text-slate-500 text-2xl">add_photo_alternate</span>
                    <span className="text-[8px] text-slate-600 font-black uppercase mt-1">Foto</span>
                    <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
                  </label>
                  )}
              </div>
              <div className="w-full mt-3 space-y-2">
                <button 
                  type="button" 
                  onClick={searchGoogleImages}
                  disabled={searchingImages}
                  className="w-full px-3 py-2 bg-indigo-600 rounded-xl text-xs font-black text-white disabled:opacity-50"
                >
                  {searchingImages ? 'Buscando...' : 'Buscar imagem na Web'}
                </button>
                
                <input 
                  type="url" 
                  placeholder="Ou cole o link direto da imagem aqui..." 
                  value={form.image.startsWith('data:') ? '' : form.image}
                  onChange={e => {
                    const url = e.target.value;
                    set('image', url);
                    setImagePreview(url);
                  }}
                  className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none"
                />
                
                {imageResults.length > 0 && (
                  <div className="grid grid-cols-4 gap-2 p-2 bg-black border border-white/10 rounded-xl">
                    {imageResults.map((url, idx) => (
                      <button key={idx} type="button" onClick={() => selectImage(url)} className="aspect-square rounded-lg overflow-hidden border-2 border-transparent hover:border-indigo-500 transition-all">
                        <img src={url} alt="Result" className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block tracking-widest">Nome do Insumo</label>
              <input required type="text" value={form.name} onChange={e => set('name', e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Categoria</label>
                <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none">
                  {Object.entries(CATEGORY_UI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Unidade</label>
                <select value={form.unit} onChange={e => set('unit', e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none">
                  {['kg', 'g', 'L', 'ml', 'un', 'cx', 'pct'].map(u => <option key={u} value={u}>{u}</option>)}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-emerald-500/5 p-3 rounded-2xl border border-emerald-500/10">
                <label className="text-[10px] font-black uppercase text-emerald-400 mb-1 block">Estoque Atual</label>
                <input required type="number" step="0.1" value={form.stock} onChange={e => set('stock', e.target.value)} className="w-full bg-transparent text-white text-lg font-black outline-none" />
              </div>
              <div className="bg-rose-500/5 p-3 rounded-2xl border border-rose-500/10">
                <label className="text-[10px] font-black uppercase text-rose-400 mb-1 block">Mínimo (Alerta)</label>
                <input required type="number" step="0.1" value={form.minStock} onChange={e => set('minStock', e.target.value)} className="w-full bg-transparent text-white text-lg font-black outline-none" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block tracking-widest">Custo Unitário (R$)</label>
              <input required type="number" step="0.01" value={form.costPerUnit} onChange={e => set('costPerUnit', e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-indigo-500 outline-none" />
            </div>
          </div>

          <div className="pt-4 border-t border-white/5">
            <label className="text-[10px] font-black uppercase text-indigo-400 mb-3 block tracking-widest">Fornecedores Homologados</label>
            <div className="space-y-2 max-h-32 overflow-y-auto custom-scrollbar pr-2">
              {suppliers.map(sup => (
                <label key={sup.id} className="flex items-center gap-3 p-3 bg-white/5 rounded-xl cursor-pointer hover:bg-white/10 transition-colors">
                  <input type="checkbox" checked={selectedSuppliers.includes(sup.id)} onChange={() => toggleSupplier(sup.id)} className="w-5 h-5 accent-indigo-500 rounded border-white/10" />
                  <span className="text-xs text-white font-bold">{sup.name}</span>
                </label>
              ))}
            </div>
          </div>

          <button type="submit" className="w-full py-4 md:py-5 bg-indigo-600 text-white rounded-2xl font-black uppercase tracking-[0.2em] text-xs shadow-lg shadow-indigo-600/20 active:scale-95 transition-all">
            {existingIngredient ? 'Salvar Alterações' : 'Cadastrar no Sistema'}
          </button>
          <button type="button" onClick={onClose} className="w-full py-2 text-slate-600 text-[10px] font-black uppercase tracking-widest">Cancelar</button>
        </form>
      </div>
    </div>
  );
};

// ─── MODAL DE RECEITAS (PRODUÇÃO) ───
const RecipeProductionModal: React.FC<{ onClose: () => void; recipes: any[]; onProduce: (recipeId: string, multiplier: number) => void }> = ({ onClose, recipes, onProduce }) => {
  const [selectedRecipe, setSelectedRecipe] = useState('');
  const [multiplier, setMultiplier] = useState(1);
  const menuItemsWithRecipe = ALL_MENU.filter(m => recipes.some(r => r.menuItemId === m.id));

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#0d1218] border border-rose-500/30 rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl animate-in zoom-in-95">
        <h2 className="text-xl font-black text-rose-400 italic mb-6 flex items-center gap-2"><span className="material-symbols-outlined">skillet</span> Produzir Receita</h2>
        <div className="space-y-5">
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Ficha Técnica Selecionada</label>
            <select value={selectedRecipe} onChange={e => setSelectedRecipe(e.target.value)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-white focus:border-rose-500 outline-none">
              <option value="">Selecione...</option>
              {menuItemsWithRecipe.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 mb-1 block">Quantidade de Lotes/Porções</label>
            <input type="number" min="1" value={multiplier} onChange={e => setMultiplier(parseInt(e.target.value) || 1)} className="w-full bg-black border border-white/10 rounded-xl px-4 py-4 text-center text-2xl font-black text-white outline-none" />
          </div>
          <button onClick={() => { if (selectedRecipe) onProduce(selectedRecipe, multiplier); onClose(); }} disabled={!selectedRecipe} className="w-full py-4 md:py-5 bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-lg shadow-rose-600/30">
            Baixar Ingredientes
          </button>
          <button onClick={onClose} className="w-full py-2 text-slate-600 text-[10px] font-black uppercase">Voltar</button>
        </div>
      </div>
    </div>
  );
};

// ─── COMPONENTE PRINCIPAL ───
const InventoryControl: React.FC = () => {
  const { ingredients, recipes, suppliers, addIngredient, updateIngredient, registerInventoryTransaction } = useCMV();

  // Estados Base
  const [mode, setMode] = useState<Mode>('RETIRADA');
  const [isManagerAuth, setIsManagerAuth] = useState(false);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [mobileCartOpen, setMobileCartOpen] = useState(false); // ✨ Novo Estado Mobile

  // Modais
  const [showAddModal, setShowAddModal] = useState(false);
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [managerLoginModal, setManagerLoginModal] = useState(false);
  const [editingIngredient, setEditingIngredient] = useState<ExtendedIngredient | undefined>(undefined);

  const [selectedUser, setSelectedUser] = useState(USERS[0].name);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState(false);
  const [withdrawalReason, setWithdrawalReason] = useState(REASONS[0]);
  const [authNotes, setAuthNotes] = useState('');

  const cartItemsDetailed = useMemo(() => {
    return Object.entries(cart).map(([id, qty]) => {
      const ing = ingredients.find(i => i.id === id);
      return ing ? { ...ing, qty, subtotal: ing.costPerUnit * qty } : null;
    }).filter(Boolean);
  }, [cart, ingredients]);

  const totalValue = cartItemsDetailed.reduce((acc, item) => acc + item!.subtotal, 0);
  const totalItems = cartItemsDetailed.reduce((acc, item) => acc + item!.qty, 0);

  const handleAddToCart = (product: ExtendedIngredient, qtyDelta: number = 1) => {
    setCart(prev => {
      const currentQty = prev[product.id] || 0;
      const newQty = Math.max(0, +(currentQty + qtyDelta).toFixed(3));
      if (newQty <= 0) { const { [product.id]: _, ...rest } = prev; return rest; }
      return { ...prev, [product.id]: newQty };
    });
  };

  const handleLoadRecipe = (menuItemId: string, multiplier: number) => {
    const recipe = recipes.find(r => r.menuItemId === menuItemId);
    if (!recipe) return;
    const newCart = { ...cart };
    recipe.items.forEach(ri => { newCart[ri.ingredientId] = (newCart[ri.ingredientId] || 0) + (ri.quantity * multiplier); });
    setCart(newCart);
    setAuthNotes(`Produção: ${ALL_MENU.find(m => m.id === menuItemId)?.name} (x${multiplier})`);
    setMobileCartOpen(true); // Abre o carrinho ao carregar receita
  };

  const handleConfirmWithAuth = () => {
    const userObj = USERS.find(u => u.name === selectedUser);
    if (!userObj || userObj.pin !== pinInput) { setPinError(true); return; }
    const itemsToLog = cartItemsDetailed.map(item => ({ ingredientId: item!.id, quantity: mode === 'RETIRADA' ? -item!.qty : item!.qty }));
    registerInventoryTransaction(selectedUser, mode, itemsToLog, `Motivo: ${withdrawalReason} | Obs: ${authNotes}`);
    setCart({}); setAuthModalOpen(false); setMobileCartOpen(false); setPinInput(''); alert(`✅ Movimentação Concluída!`);
  };

  const handleManagerLogin = () => {
    if (pinInput === '1234') { setIsManagerAuth(true); setManagerLoginModal(false); setPinInput(''); }
    else { setPinError(true); }
  };

  const theme = mode === 'RETIRADA' ? 'rose' : 'emerald';

  return (
    <div className="h-full flex flex-col bg-[#05070a] text-slate-100 font-sans overflow-hidden relative">

      {showAddModal && (
        <IngredientModal
          onClose={() => { setShowAddModal(false); setEditingIngredient(undefined); }}
          onSave={(ing) => {
            if (editingIngredient) updateIngredient(ing.id, ing);
            else addIngredient(ing);
          }}
          suppliers={suppliers}
          existingIngredient={editingIngredient}
        />
      )}

      {/* MODAL PIN GERENTE */}
      {managerLoginModal && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#0d1218] border border-indigo-500/30 rounded-[2.5rem] p-8 w-full max-w-xs text-center shadow-2xl">
            <span className="material-symbols-outlined text-5xl text-indigo-400 mb-4">admin_panel_settings</span>
            <h3 className="text-xl font-black text-white italic uppercase mb-6">Acesso Gestor</h3>
            <input type="password" maxLength={4} value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(false); }} placeholder="PIN" className="w-full bg-black border border-white/10 rounded-2xl py-4 text-center text-4xl tracking-[0.5em] text-white focus:border-indigo-500 outline-none" />
            {pinError && <p className="text-rose-500 text-[10px] font-black uppercase mt-4">Senha Incorreta</p>}
            <button onClick={handleManagerLogin} className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-6">Entrar</button>
            <button onClick={() => setManagerLoginModal(false)} className="w-full py-2 text-slate-600 text-[10px] font-black uppercase mt-2">Cancelar</button>
          </div>
        </div>
      )}

      {/* HEADER RESPONSIVO */}
      <header className="flex flex-col md:flex-row items-center justify-between p-3 md:p-4 bg-[#0d1218] border-b border-white/5 shadow-lg shrink-0 gap-3 md:gap-4 z-20">
        <div className="flex items-center justify-between w-full md:w-auto">
          <div className="flex items-center gap-3">
            <div className={`size-10 bg-${theme}-500/10 border border-${theme}-500/30 rounded-full flex items-center justify-center text-${theme}-400 shadow-lg`}><span className="material-symbols-outlined text-xl">inventory_2</span></div>
            <div><h1 className="text-xl font-black text-white italic tracking-tighter">SUSHI<span className={`text-${theme}-400`}>FLOW</span></h1><p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-none">Estoque Operacional</p></div>
          </div>
          {/* Botão Carrinho Mobile no Header */}
          <button onClick={() => setMobileCartOpen(true)} className="md:hidden relative p-2 text-white">
            <span className="material-symbols-outlined text-2xl">receipt_long</span>
            {totalItems > 0 && <span className="absolute top-0 right-0 size-4 bg-rose-600 rounded-full text-[8px] flex items-center justify-center font-black">{totalItems}</span>}
          </button>
        </div>

        <div className="flex bg-black/50 p-1 rounded-xl border border-white/5 w-full md:w-auto gap-1">
          <button onClick={() => setMode('RETIRADA')} className={`flex-1 px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${mode === 'RETIRADA' ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-500'}`}>Retirada</button>
          <button onClick={() => setMode('ENTRADA')} className={`flex-1 px-4 py-2 rounded-lg text-[10px] md:text-xs font-black uppercase tracking-widest transition-all ${mode === 'ENTRADA' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-500'}`}>Entrada</button>

          {isManagerAuth ? (
            <button onClick={() => setIsManagerAuth(false)} className="px-3 py-2 text-rose-400 hover:text-rose-300 transition-colors flex items-center gap-2 text-[10px] font-black uppercase">
              <span className="material-symbols-outlined text-sm">logout</span>
            </button>
          ) : (
            <button onClick={() => { setManagerLoginModal(true); setPinInput(''); }} className="px-3 py-2 text-slate-700 hover:text-slate-400 transition-colors flex items-center gap-2 text-[10px] font-black uppercase">
              <span className="material-symbols-outlined text-sm">lock</span>
            </button>
          )}
        </div>

        {isManagerAuth && (
          <button onClick={() => { setEditingIngredient(undefined); setShowAddModal(true); }} className="hidden md:flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white rounded-xl text-xs font-black uppercase tracking-widest shadow-lg">
            <span className="material-symbols-outlined text-sm">add</span> Novo Produto
          </button>
        )}
      </header>

      {/* CONTEÚDO PRINCIPAL */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 flex flex-col overflow-hidden relative">
          <div className="p-3 md:p-4 bg-[#0d1218] border-b border-white/5 shrink-0 space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-500">search</span>
                <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Buscar..." className="w-full h-11 md:h-12 bg-black rounded-xl border border-white/10 pl-10 pr-4 text-sm text-white focus:border-indigo-500 outline-none transition-all" />
              </div>
              {mode === 'RETIRADA' && (
                <button onClick={() => setShowRecipeModal(true)} className="px-3 md:px-4 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-xl flex items-center justify-center hover:bg-rose-500 hover:text-white transition-all shadow-lg font-black text-[10px] uppercase tracking-widest gap-2">
                  <span className="material-symbols-outlined text-lg">skillet</span> <span className="hidden sm:inline">Receita</span>
                </button>
              )}
            </div>
            <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pb-1">
              <button onClick={() => setSelectedCategory('all')} className={`shrink-0 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${selectedCategory === 'all' ? `bg-${theme}-500 text-white border-${theme}-500` : 'bg-white/5 text-slate-400 border-transparent'}`}>Tudo</button>
              {Object.entries(CATEGORY_UI).map(([key, ui]) => (
                <button key={key} onClick={() => setSelectedCategory(key)} className={`shrink-0 flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest border ${selectedCategory === key ? `${ui.bg} ${ui.color} border-current` : 'bg-white/5 text-slate-400 border-transparent'}`}>
                  <span className="material-symbols-outlined text-sm">{ui.icon}</span> {ui.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 pb-24 md:pb-4">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
              {ingredients.filter(ing => (selectedCategory === 'all' || ing.category === selectedCategory) && (!searchQuery || ing.name.toLowerCase().includes(searchQuery.toLowerCase()))).map(product => {
                const inCartQty = cart[product.id] || 0;
                const isLow = product.minStock && product.stock <= product.minStock;
                return (
                  <button key={product.id} onClick={() => handleAddToCart(product)} className={`bg-[#11161d] border-2 rounded-2xl p-3 md:p-4 text-left flex flex-col relative transition-all active:scale-95 h-[160px] md:h-[192px] ${inCartQty > 0 ? `border-${theme}-500 bg-${theme}-500/5` : isLow ? 'border-rose-500/30 bg-rose-500/5' : 'border-white/5 hover:border-white/20'}`}>
                    {inCartQty > 0 && <div className={`absolute -top-2 -right-2 bg-${theme}-500 text-white font-black rounded-full size-6 md:size-7 flex items-center justify-center text-[10px] md:text-xs shadow-lg animate-in zoom-in`}>{inCartQty}</div>}

                    {isManagerAuth && (
                      <div onClick={(e) => { e.stopPropagation(); setEditingIngredient(product); setShowAddModal(true); }} className="absolute top-2 right-2 size-7 md:size-8 bg-black/60 rounded-full flex items-center justify-center text-slate-500 hover:text-indigo-400 hover:bg-black transition-all z-20">
                        <span className="material-symbols-outlined text-sm">edit</span>
                      </div>
                    )}

                    {product.image && (
                      <div className="w-full aspect-square mb-2 rounded-lg overflow-hidden bg-black/30">
                        <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                      </div>
                    )}

                    <h4 className="text-[10px] md:text-[11px] font-bold text-white line-clamp-2 mb-2 leading-tight h-8">{product.name}</h4>
                    <div className="mt-auto border-t border-white/5 pt-2 flex justify-between items-center">
                      <span className={`text-[10px] font-black font-mono ${isLow ? 'text-rose-400' : 'text-slate-400'}`}>{product.stock} {product.unit}</span>
                      {isLow && <span className="material-symbols-outlined text-xs text-rose-500 animate-pulse">warning</span>}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* GAVETA CARRINHO (SIDEBAR NO DESKTOP, MODAL NO MOBILE) */}
        <div className={`
          fixed inset-y-0 right-0 z-[100] w-full sm:w-96 bg-[#080b0f] shadow-2xl transition-transform duration-300 transform
          ${mobileCartOpen ? 'translate-x-0' : 'translate-x-full'}
          md:static md:w-80 md:translate-x-0 md:border-l border-white/5 flex flex-col
        `}>
          <div className="flex items-center justify-between p-4 md:p-6 border-b border-white/5 bg-[#0d1218]">
            <h2 className={`text-xs font-black uppercase tracking-widest text-${theme}-400`}>Conferência de {mode}</h2>
            <div className="flex items-center gap-2">
              <button onClick={() => setCart({})} className="text-[10px] text-slate-700 uppercase font-black hover:text-white transition-colors">Limpar</button>
              <button onClick={() => setMobileCartOpen(false)} className="md:hidden text-slate-500 p-1"><span className="material-symbols-outlined">close</span></button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto space-y-2 p-4 custom-scrollbar">
            {cartItemsDetailed.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center opacity-20">
                <span className="material-symbols-outlined text-6xl">shopping_cart</span>
                <p className="text-[10px] font-black uppercase mt-2">Vazio</p>
              </div>
            ) : cartItemsDetailed.map(item => (
              <div key={item!.id} className="grid grid-cols-[1fr,90px] gap-2 p-3 bg-white/5 rounded-xl border border-white/5 items-center">
                <span className="text-[11px] font-bold text-white truncate">{item!.name}</span>
                <div className="flex items-center justify-between bg-black/60 rounded-lg p-1 border border-white/5">
                  <button onClick={() => handleAddToCart(item!, -1)} className="text-rose-500 font-black px-2 py-1">-</button>
                  <span className="text-white font-black text-xs">{item!.qty}</span>
                  <button onClick={() => handleAddToCart(item!, 1)} className="text-emerald-500 font-black px-2 py-1">+</button>
                </div>
              </div>
            ))}
          </div>

          <div className="p-4 md:p-6 bg-[#11161d] border-t border-white/5 shadow-inner">
            <div className="flex justify-between items-end mb-4">
              <p className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Total</p>
              <p className={`text-2xl md:text-3xl font-black text-${theme}-400 italic font-mono`}>R$ {totalValue.toFixed(2)}</p>
            </div>
            <button onClick={() => setAuthModalOpen(true)} disabled={totalItems === 0} className={`w-full py-4 md:py-5 bg-${theme}-600 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-lg active:scale-95 disabled:opacity-30`}>
              Confirmar Operação
            </button>
          </div>
        </div>
      </div>

      {/* BOTÃO FLUTUANTE (FAB) MOBILE */}
      {totalItems > 0 && !mobileCartOpen && (
        <button
          onClick={() => setMobileCartOpen(true)}
          className="md:hidden fixed bottom-6 right-6 z-40 size-16 bg-rose-600 rounded-full shadow-2xl flex items-center justify-center animate-in slide-in-from-bottom-10"
        >
          <span className="material-symbols-outlined text-white text-3xl">receipt_long</span>
          <div className="absolute -top-1 -right-1 size-6 bg-white text-rose-600 rounded-full flex items-center justify-center text-xs font-black shadow-lg">
            {totalItems}
          </div>
        </button>
      )}

      {/* MODAL AUTORIZAÇÃO */}
      {authModalOpen && (
        <div className="fixed inset-0 z-[400] bg-black/95 backdrop-blur-md flex items-center justify-center p-2 md:p-4">
          <div className="bg-[#0d1218] border border-white/10 rounded-[2.5rem] p-6 md:p-8 w-full max-w-sm shadow-2xl">
            <h3 className="text-center font-black text-white italic uppercase mb-6 md:mb-8 tracking-[0.2em]">Assinatura Digital</h3>
            <div className="space-y-4">
              <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setPinError(false); }} className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-white outline-none">
                {USERS.map(u => <option key={u.name} value={u.name}>{u.name}</option>)}
              </select>
              {mode === 'RETIRADA' && <select value={withdrawalReason} onChange={e => setWithdrawalReason(e.target.value)} className="w-full bg-black border border-rose-500/30 text-rose-400 rounded-xl px-4 py-3 text-sm font-black uppercase">{REASONS.map(r => <option key={r} value={r}>{r}</option>)}</select>}
              <input type="text" value={authNotes} onChange={e => setAuthNotes(e.target.value)} placeholder="Observações (opcional)" className="w-full bg-black border border-white/10 rounded-xl px-4 py-3 text-sm text-slate-400" />
              <input type="password" inputMode="numeric" maxLength={4} value={pinInput} onChange={e => { setPinInput(e.target.value); setPinError(false); }} placeholder="PIN ****" className="w-full bg-black border border-white/10 rounded-xl py-5 text-center text-3xl tracking-[0.5em] text-white focus:border-indigo-500 outline-none" />
              {pinError && <p className="text-rose-500 text-center text-[10px] font-black uppercase animate-bounce">PIN INCORRETO</p>}
              <button onClick={handleConfirmWithAuth} className={`w-full py-4 md:py-5 bg-${theme}-600 text-white rounded-2xl font-black uppercase text-xs tracking-widest mt-4`}>Autorizar Agora</button>
              <button onClick={() => { setAuthModalOpen(false); setPinInput(''); }} className="w-full py-2 text-slate-600 text-[10px] font-black uppercase">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {showRecipeModal && <RecipeProductionModal onClose={() => setShowRecipeModal(false)} recipes={recipes} onProduce={handleLoadRecipe} />}
    </div>
  );
};

export default InventoryControl;