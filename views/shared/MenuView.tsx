import React, { useState, useEffect, useMemo } from 'react';
import { useCMV } from '../../context/CMVContext';
import { MenuItem, Recipe, Ingredient } from '../../types';

const MenuView: React.FC = () => {
  const [activeSubCategory, setActiveSubCategory] = useState<string>('Tudo');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  
  // -- API States --
  const [apiProducts, setApiProducts] = useState<MenuItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [localMenuData] = useState<Record<string, { price?: number; image?: string; available?: boolean }>>(() => {
    const saved = localStorage.getItem('sushiflow_menu_custom');
    return saved ? JSON.parse(saved) : {};
  });
  
  // Custom items are still maintained locally for now
  const [customItems, setCustomItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('sushiflow_menu_items');
    return saved ? JSON.parse(saved) : [];
  });
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecipeItem, setSelectedRecipeItem] = useState<MenuItem | null>(null);

  const { recipes, ingredients, getItemCost, getItemCMVPercent } = useCMV();

  // 1. Fetching Products from API
  useEffect(() => {
    const fetchMenu = async () => {
      setIsLoading(true);
      setFetchError(null);
      try {
        const response = await fetch('http://localhost:3001/api/produtos');
        if (!response.ok) throw new Error('Falha ao carregar cardápio');
        
        const data = await response.json();
        
        // Map database result to Frontend's MenuItem format
        const formattedItems: MenuItem[] = data.map((dbItem: any) => ({
          id: dbItem.id,
          name: dbItem.nome,
          description: dbItem.descricao || '',
          price: parseFloat(dbItem.preco),
          category: dbItem.categoria || 'Outros',
          image: dbItem.imagem_url || 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=400&fit=crop',
          available: true // Assuming if returned from API standard endpoint it's active
        }));
        
        setApiProducts(formattedItems);
      } catch (error: any) {
        console.error("Erro no fetch do menu:", error);
        setFetchError('Não foi possível conectar ao servidor. Mantenha os dados mockados temporariamente se precisar.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenu();
  }, []);

  const menuSource = useMemo(() => {
    // Combine API products + Custom items stored locally
    return [...apiProducts, ...customItems];
  }, [apiProducts, customItems]);

  const subCategories = useMemo(() => {
    const cats = Array.from(new Set(menuSource.map(i => i.category)));
    return ['Tudo', ...cats];
  }, [menuSource]);

  const filteredMenu = useMemo(() =>
    menuSource.filter(item => {
      const matchSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.description.toLowerCase().includes(searchQuery.toLowerCase());
      const matchSub = activeSubCategory === 'Tudo' || item.category === activeSubCategory;
      return matchSearch && matchSub;
    }), [menuSource, searchQuery, activeSubCategory]);

  const handleCopyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const handleAddNewItem = (newItem: MenuItem) => {
    const updated = [...customItems, newItem];
    setCustomItems(updated);
    localStorage.setItem('sushiflow_menu_items', JSON.stringify(updated));
    setIsAddModalOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-[#0d1117] relative">

      {/* Header */}
      <div className="p-6 border-b border-border-dark bg-card-dark/20 flex flex-col md:flex-row md:items-center justify-between gap-6 shrink-0">
        <div className="flex items-center gap-4 self-start">
          <h2 className="text-xl font-black uppercase italic tracking-wider text-white flex items-center gap-3">
             <span className="material-symbols-outlined text-primary text-2xl">restaurant_menu</span>
             Gestão de Cardápio
          </h2>
          {isLoading && (
            <span className="text-xs font-bold text-slate-400 animate-pulse bg-white/5 px-3 py-1.5 rounded-full border border-white/10 flex items-center gap-2">
              <span className="size-2 rounded-full bg-primary animate-ping"></span>
              Sincronizando com DB...
            </span>
          )}
          {fetchError && (
             <span className="text-xs font-bold text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full border border-rose-500/20 flex items-center gap-2">
               <span className="material-symbols-outlined text-sm">wifi_off</span>
               Offline Mode
             </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <input type="text" placeholder="Pesquisar item..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="bg-background-dark border border-border-dark rounded-xl pl-6 pr-4 py-2.5 text-xs w-64 focus:ring-1 focus:ring-primary text-white outline-none" />
          <button onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 bg-white text-black px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all shadow-lg">
            <span className="material-symbols-outlined text-sm">add</span>
            Adicionar
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar categorias */}
        <aside className="w-56 border-r border-border-dark bg-background-dark/30 overflow-y-auto custom-scrollbar p-6 shrink-0">
          <nav className="space-y-1">
            {subCategories.map(cat => (
              <button key={cat} onClick={() => setActiveSubCategory(cat)}
                className={`w-full text-left px-4 py-3 rounded-xl text-xs font-bold transition-all ${activeSubCategory === cat ? 'bg-primary/10 text-primary' : 'text-slate-400 hover:bg-white/5'
                  }`}>
                {cat}
              </button>
            ))}
          </nav>
        </aside>

        {/* Grade do cardápio */}
        <main className="flex-1 overflow-y-auto p-8 custom-scrollbar bg-[radial-gradient(circle_at_top_right,_#1a1f26_0%,_#0d1117_100%)]">
          {isLoading ? (
             // Skeleton Loader
             <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
                {[...Array(8)].map((_, i) => (
                  <div key={i} className="bg-card-dark/20 border border-white/5 rounded-[2.5rem] overflow-hidden flex flex-col h-[400px]">
                     <div className="h-48 bg-white/5 animate-pulse"></div>
                     <div className="p-6 flex-1 flex flex-col gap-3">
                        <div className="flex justify-between items-start">
                           <div className="h-5 bg-white/5 rounded-md w-1/2 animate-pulse"></div>
                           <div className="h-5 bg-white/5 rounded-md w-1/4 animate-pulse"></div>
                        </div>
                        <div className="h-3 bg-white/5 rounded w-3/4 animate-pulse mt-2"></div>
                        <div className="h-3 bg-white/5 rounded w-2/4 animate-pulse"></div>
                        
                        <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
                           <div className="h-10 bg-white/5 rounded-xl w-full animate-pulse"></div>
                           <div className="h-8 bg-white/5 rounded-lg w-full animate-pulse"></div>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          ) : filteredMenu.length === 0 ? (
             <div className="flex flex-col items-center justify-center h-full text-slate-500 space-y-4">
                 <span className="material-symbols-outlined text-6xl opacity-50">search_off</span>
                 <p className="font-bold uppercase tracking-widest">Nenhum item encontrado.</p>
                 {fetchError && <p className="text-xs text-rose-400 mt-2 bg-rose-500/10 px-4 py-2 rounded-xl">Certifique-se de iniciar o backend com "node api_server.js".</p>}
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-6">
              {filteredMenu.map(item => {
                const displayPrice = localMenuData[item.id]?.price ?? item.price;
                const displayImage = localMenuData[item.id]?.image ?? item.image;
                const hasRecipe = recipes.some(r => r.menuItemId === item.id);
                const cost = getItemCost(item.id);
                const cmvPct = getItemCMVPercent(item.id);

                return (
                  <div key={item.id}
                    className="group bg-card-dark/40 backdrop-blur-md border border-border-dark rounded-[2.5rem] overflow-hidden hover:border-primary/40 transition-all shadow-xl flex flex-col">

                    {/* Imagem */}
                    <div className="h-48 overflow-hidden relative cursor-zoom-in" onClick={() => setLightboxImage(displayImage)}>
                      <img src={displayImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={item.name} 
                           onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?q=80&w=400&fit=crop' }}/>
                      <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="material-symbols-outlined text-white text-3xl">zoom_in</span>
                      </div>
                      <div className="absolute top-3 left-3 px-2 py-1 rounded-xl text-[10px] font-black backdrop-blur-md bg-black/60 text-white uppercase tracking-widest border border-white/10 shadow-lg">
                         {item.category}
                      </div>
                      {/* Badge CMV% na imagem */}
                      {hasRecipe && cmvPct > 0 && (
                        <div className={`absolute top-3 right-3 px-2 py-1 rounded-xl text-[10px] font-black backdrop-blur-md border ${cmvPct <= 30 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30'
                            : cmvPct <= 45 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                              : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
                          }`}>
                          CMV {cmvPct.toFixed(0)}%
                        </div>
                      )}
                    </div>

                    <div className="p-6 flex-1 flex flex-col">
                      <div className="flex justify-between items-start mb-1">
                        <h4 className="font-black text-white group-hover:text-primary transition-colors">{item.name}</h4>
                        <span className="text-lg font-black text-white italic">R$ {displayPrice.toFixed(2)}</span>
                      </div>

                      {/* Custo de produção no card */}
                      {cost > 0 && (
                        <p className="text-[10px] text-slate-600 font-mono mb-2">
                          Custo: <span className="text-slate-400">R$ {cost.toFixed(2)}</span>
                          <span className="mx-1">·</span>
                          Margem: <span className="text-emerald-500">{(100 - cmvPct).toFixed(0)}%</span>
                        </p>
                      )}

                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-4 italic leading-tight line-clamp-2">"{item.description}"</p>

                      <div className="mt-auto pt-4 border-t border-white/5 space-y-3">
                        {/* Botão Livro de Receitas */}
                        <button onClick={() => setSelectedRecipeItem(item)}
                          className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest border transition-all ${hasRecipe
                              ? 'bg-primary/10 border-primary/30 text-primary hover:bg-primary/20'
                              : 'bg-white/5 border-white/10 text-slate-400 hover:bg-white/10 hover:text-white group-hover:border-primary/20'
                            }`}>
                          <span className="material-symbols-outlined text-sm">menu_book</span>
                          {hasRecipe ? 'Ver Receita' : 'Cadastrar Receita'}
                        </button>

                        {/* Link da imagem */}
                        <div className="flex items-center gap-2 bg-black/30 p-2 rounded-lg border border-white/5 hover:border-white/20 transition-colors">
                          <span className="text-[9px] text-slate-600 uppercase tracking-widest mr-1">IMG</span>
                          <span className="text-[9px] text-slate-500 truncate flex-1 font-mono">{displayImage}</span>
                          <button onClick={() => handleCopyLink(item.id, displayImage)}
                            className={`p-1 rounded transition-all ${copiedId === item.id ? 'text-emerald-500' : 'text-slate-600 hover:text-white'}`}>
                            <span className="material-symbols-outlined text-xs">{copiedId === item.id ? 'check' : 'content_copy'}</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>

      {/* Lightbox */}
      {lightboxImage && (
        <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl flex items-center justify-center p-10 animate-in fade-in duration-300"
          onClick={() => setLightboxImage(null)}>
          <img src={lightboxImage} className="max-w-full max-h-full rounded-3xl shadow-2xl animate-in zoom-in-95 duration-500 border border-white/10" alt="Full View" />
          <button className="absolute top-10 right-10 size-14 bg-white/10 rounded-full flex items-center justify-center text-white hover:bg-primary transition-all">
            <span className="material-symbols-outlined text-3xl">close</span>
          </button>
        </div>
      )}

      {/* Modal: Livro de Receitas */}
      {selectedRecipeItem && (
        <RecipeViewerModal
          item={selectedRecipeItem}
          recipe={recipes.find(r => r.menuItemId === selectedRecipeItem.id) || null}
          allIngredients={ingredients}
          itemCost={getItemCost(selectedRecipeItem.id)}
          itemCMV={getItemCMVPercent(selectedRecipeItem.id)}
          onClose={() => setSelectedRecipeItem(null)}
        />
      )}

      <AddItemModal isOpen={isAddModalOpen} onClose={() => setIsAddModalOpen(false)}
        onAdd={handleAddNewItem} categories={subCategories.filter(c => c !== 'Tudo')} />
    </div>
  );
};

// ─── Modal: Adicionar item ──────────────────────────────────
const AddItemModal: React.FC<{
  isOpen: boolean; onClose: () => void; onAdd: (item: MenuItem) => void;
  categories: string[];
}> = ({ isOpen, onClose, onAdd, categories }) => {
  const [formData, setFormData] = useState({
    name: '', category: '', price: '', description: '',
    image: 'https://images.unsplash.com/photo-1553621042-f6e147245754?q=80&w=400&auto=format&fit=crop',
    spicy: false, vegan: false, glutenFree: false,
  });

  useEffect(() => {
    if (isOpen && categories.length > 0) setFormData(p => ({ ...p, category: categories[0] }));
  }, [isOpen, categories]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      id: `custom-novo-${Date.now()}`,
      name: formData.name, category: formData.category, price: parseFloat(formData.price),
      description: formData.description, available: true, image: formData.image,
      spicy: formData.spicy, vegan: formData.vegan, glutenFree: formData.glutenFree,
    });
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-md p-6">
      <div className="bg-card-dark border border-border-dark w-full max-w-2xl rounded-[3rem] p-10 animate-in zoom-in-95">
        <h3 className="text-3xl font-black italic uppercase mb-8">Novo Item no Cardápio</h3>
        <form onSubmit={handleSubmit} className="space-y-6">
          <input required className="w-full bg-background-dark border border-border-dark rounded-2xl p-4 text-white" placeholder="Nome do Prato" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
          <div className="grid grid-cols-2 gap-4">
            <select className="bg-background-dark border border-border-dark rounded-2xl p-4 text-white appearance-none" value={formData.category} onChange={e => setFormData({ ...formData, category: e.target.value })}>
              {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              <option value="Nova Categoria">Nova Categoria...</option>
            </select>
            <input required className="bg-background-dark border border-border-dark rounded-2xl p-4 text-white" placeholder="Preço" type="number" step="0.01" value={formData.price} onChange={e => setFormData({ ...formData, price: e.target.value })} />
          </div>
          <input className="w-full bg-background-dark border border-border-dark rounded-2xl p-4 text-white" placeholder="URL da Imagem" value={formData.image} onChange={e => setFormData({ ...formData, image: e.target.value })} />
          <textarea required className="w-full bg-background-dark border border-border-dark rounded-2xl p-4 text-white h-32" placeholder="Descrição" value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} />
          <div className="flex gap-4">
            <button type="button" onClick={onClose} className="flex-1 py-4 bg-white/5 rounded-2xl font-black uppercase tracking-widest">Cancelar</button>
            <button type="submit" className="flex-1 py-4 bg-primary rounded-2xl font-black uppercase tracking-widest text-white shadow-xl shadow-primary/20">Salvar Item</button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ─── Modal: Visualizador/Editor de Receita ─────────────────
const RecipeViewerModal: React.FC<{
  item: MenuItem;
  recipe: Recipe | null;
  allIngredients: Ingredient[];
  itemCost: number;
  itemCMV: number;
  onClose: () => void;
}> = ({ item, recipe, allIngredients, itemCost, itemCMV, onClose }) => {
  const { saveRecipe } = useCMV();

  // ✨ Escalonamento de porções
  const [portions, setPortions] = useState(recipe?.yield || 1);
  const multiplier = portions / (recipe?.yield || 1);

  // ✨ Modo edição
  const [isEditing, setIsEditing] = useState(!recipe); // abre em edição se não tiver receita
  const [editRecipe, setEditRecipe] = useState<Recipe>(() => recipe ?? {
    menuItemId: item.id,
    yield: 1,
    prepTime: 0,
    prepSteps: [],
    items: [],
  });
  const [newStep, setNewStep] = useState('');
  const [newIngId, setNewIngId] = useState('');
  const [newIngQty, setNewIngQty] = useState('');

  const handleSave = () => {
    saveRecipe({ ...editRecipe, menuItemId: item.id });
    setIsEditing(false);
  };

  const addStep = () => {
    if (!newStep.trim()) return;
    setEditRecipe(p => ({ ...p, prepSteps: [...(p.prepSteps || []), newStep.trim()] }));
    setNewStep('');
  };

  const removeStep = (idx: number) => {
    setEditRecipe(p => ({ ...p, prepSteps: (p.prepSteps || []).filter((_, i) => i !== idx) }));
  };

  const addIngredient = () => {
    if (!newIngId || !newIngQty) return;
    const qty = parseFloat(newIngQty);
    if (isNaN(qty) || qty <= 0) return;
    setEditRecipe(p => ({
      ...p,
      items: [...p.items.filter(i => i.ingredientId !== newIngId), { ingredientId: newIngId, quantity: qty }],
    }));
    setNewIngQty('');
    setNewIngId('');
  };

  const removeIngredient = (ingId: string) => {
    setEditRecipe(p => ({ ...p, items: p.items.filter(i => i.ingredientId !== ingId) }));
  };

  // Ingredientes da receita em exibição (com escalonamento)
  const displayItems = (isEditing ? editRecipe : recipe)?.items ?? [];

  const cmvColor = itemCMV <= 0 ? 'text-slate-400'
    : itemCMV <= 30 ? 'text-emerald-400'
      : itemCMV <= 45 ? 'text-amber-400'
        : 'text-rose-400';

  return (
    <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/95 backdrop-blur-xl p-6 animate-in fade-in duration-300">
      <div className="bg-[#12161b] border border-white/10 rounded-[3rem] w-full max-w-5xl h-[90vh] flex overflow-hidden shadow-2xl animate-in zoom-in-95 duration-500">

        {/* Esquerdo: imagem + métricas */}
        <div className="w-2/5 relative bg-black/50 overflow-hidden shrink-0 flex flex-col">
          <div className="relative flex-1">
            <img src={item.image} className="absolute inset-0 w-full h-full object-cover opacity-60" alt={item.name} />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12161b] via-[#12161b]/80 to-transparent" />

            <div className="absolute inset-0 p-8 flex flex-col justify-end">
              <div className="flex gap-2 mb-3 flex-wrap">
                <span className="px-3 py-1 bg-white/10 backdrop-blur-md rounded-lg text-[10px] font-black uppercase tracking-widest text-white">{item.category}</span>
                {item.spicy && <span className="px-3 py-1 bg-rose-500/20 text-rose-400 rounded-lg text-[10px] font-black uppercase">Apimentado</span>}
                {item.vegan && <span className="px-3 py-1 bg-emerald-500/20 text-emerald-400 rounded-lg text-[10px] font-black uppercase">Vegano</span>}
              </div>
              <h2 className="text-3xl font-black italic tracking-tighter text-white mb-1 leading-none">{item.name}</h2>
              <p className="text-xs font-bold text-slate-400 italic mb-6">"{item.description}"</p>

              {/* Métricas: Tempo, Rendimento, Custo, CMV */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Preparo</p>
                  <p className="text-lg font-black text-white flex items-center gap-1">
                    <span className="material-symbols-outlined text-primary text-lg">timer</span>
                    {(isEditing ? editRecipe.prepTime : recipe?.prepTime) || '--'} min
                  </p>
                </div>
                <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Rende</p>
                  <p className="text-lg font-black text-white">
                    {(isEditing ? editRecipe.yield : recipe?.yield) || 1} porção{((isEditing ? editRecipe.yield : recipe?.yield) || 1) > 1 ? 'ões' : ''}
                  </p>
                </div>
                {/* ✨ Custo e CMV% */}
                <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">Custo/Porção</p>
                  <p className="text-lg font-black text-white">
                    R$ {itemCost > 0 ? itemCost.toFixed(2) : '--'}
                  </p>
                </div>
                <div className="p-3 bg-white/5 backdrop-blur-md rounded-2xl border border-white/10">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500">CMV</p>
                  <p className={`text-lg font-black ${cmvColor}`}>
                    {itemCMV > 0 ? `${itemCMV.toFixed(1)}%` : '--'}
                  </p>
                </div>
              </div>

              {/* ✨ Escalonador de porções (só no modo visualização) */}
              {!isEditing && recipe && (
                <div className="mt-4 p-3 bg-white/5 rounded-2xl border border-white/10">
                  <p className="text-[9px] uppercase font-black tracking-widest text-slate-500 mb-2">Escalar para</p>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setPortions(p => Math.max(1, p - 1))}
                      className="size-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-white transition-all">
                      <span className="material-symbols-outlined text-sm">remove</span>
                    </button>
                    <span className="text-xl font-black text-white text-center flex-1">{portions} porç.</span>
                    <button onClick={() => setPortions(p => p + 1)}
                      className="size-8 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg flex items-center justify-center text-white transition-all">
                      <span className="material-symbols-outlined text-sm">add</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Direito: ingredientes + instruções */}
        <div className="flex-1 flex flex-col bg-[#0a0d11]">
          {/* Barra superior com actions */}
          <div className="flex items-center justify-between px-8 py-5 border-b border-white/5 shrink-0">
            <h3 className="text-sm font-black uppercase tracking-widest text-white flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">menu_book</span>
              {isEditing ? 'Editando Receita' : 'Livro de Receitas'}
            </h3>
            <div className="flex items-center gap-2">
              {isEditing ? (
                <>
                  <button onClick={() => { setIsEditing(false); setEditRecipe(recipe ?? { menuItemId: item.id, yield: 1, prepTime: 0, prepSteps: [], items: [] }); }}
                    className="px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-xs font-black text-slate-400 transition-all">
                    Cancelar
                  </button>
                  <button onClick={handleSave}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 rounded-xl text-xs font-black text-white transition-all flex items-center gap-1">
                    <span className="material-symbols-outlined text-sm">save</span>
                    Salvar
                  </button>
                </>
              ) : (
                <button onClick={() => setIsEditing(true)}
                  className="px-4 py-2 bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/30 rounded-xl text-xs font-black text-indigo-400 transition-all flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">edit</span>
                  Editar
                </button>
              )}
              <button onClick={onClose}
                className="size-9 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-slate-400 hover:text-white transition-all">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">

            {/* ── INSUMOS ─────────────────────────────── */}
            <section>
              <h4 className="text-sm font-black uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">kitchen</span>
                Insumos Necessários
                {!isEditing && recipe && portions !== recipe.yield && (
                  <span className="ml-2 px-2 py-0.5 bg-primary/10 border border-primary/30 rounded-lg text-[9px] font-black text-primary">
                    ×{multiplier.toFixed(2)} escala
                  </span>
                )}
              </h4>

              {displayItems.length === 0 ? (
                <div className="p-6 bg-white/5 border border-white/5 rounded-2xl text-center">
                  <span className="material-symbols-outlined text-slate-500 text-3xl mb-2 block">assignment_late</span>
                  <p className="text-xs font-bold text-slate-400 uppercase">
                    {isEditing ? 'Adicione ingredientes abaixo' : 'Receita sem ficha técnica cadastrada.'}
                  </p>
                </div>
              ) : (
                <ul className="grid grid-cols-2 gap-2">
                  {displayItems.map((ri, idx) => {
                    const ing = allIngredients.find(i => i.id === ri.ingredientId);
                    if (!ing) return null;
                    const qtyScaled = isEditing ? ri.quantity : +(ri.quantity * multiplier).toFixed(3);
                    // ✨ Alerta de estoque baixo
                    const stockLow = ing.minStock && ing.stock <= ing.minStock;
                    return (
                      <li key={idx}
                        className={`flex items-center justify-between p-3 rounded-xl border transition-colors ${stockLow
                            ? 'bg-rose-500/5 border-rose-500/30'
                            : 'bg-[#12161b] border-white/5 hover:border-white/10'
                          }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {stockLow && (
                            <span className="material-symbols-outlined text-rose-400 text-sm shrink-0" title="Estoque baixo!">warning</span>
                          )}
                          <span className={`text-sm font-bold truncate ${stockLow ? 'text-rose-300' : 'text-slate-300'}`}>{ing.name}</span>
                        </div>
                        <div className="flex items-center gap-2 shrink-0 ml-2">
                          <span className="text-xs font-black text-white px-2 py-1 bg-white/10 rounded-lg whitespace-nowrap">
                            {qtyScaled} {ing.unit}
                          </span>
                          {isEditing && (
                            <button onClick={() => removeIngredient(ri.ingredientId)}
                              className="size-6 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-md flex items-center justify-center transition-all">
                              <span className="material-symbols-outlined text-xs">close</span>
                            </button>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}

              {/* ✨ Adicionar ingrediente (modo edição) */}
              {isEditing && (
                <div className="mt-3 flex gap-2 items-end">
                  <div className="flex-1">
                    <select value={newIngId} onChange={e => setNewIngId(e.target.value)}
                      className="w-full bg-[#111820] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary appearance-none">
                      <option value="">+ Selecionar insumo...</option>
                      {allIngredients.map(ing => (
                        <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                      ))}
                    </select>
                  </div>
                  <input type="number" step="0.01" min="0" placeholder="Qtd" value={newIngQty}
                    onChange={e => setNewIngQty(e.target.value)}
                    className="w-20 bg-[#111820] border border-white/10 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-primary" />
                  <button onClick={addIngredient}
                    className="px-4 py-2.5 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary rounded-xl text-xs font-black transition-all">
                    Add
                  </button>
                </div>
              )}

              {/* ✨ Métricas de edição */}
              {isEditing && (
                <div className="mt-4 grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Rende (porções)</label>
                    <input type="number" min={1} value={editRecipe.yield}
                      onChange={e => setEditRecipe(p => ({ ...p, yield: parseInt(e.target.value) || 1 }))}
                      className="w-full bg-[#111820] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="text-[9px] text-slate-500 uppercase font-bold block mb-1">Preparo (min)</label>
                    <input type="number" min={0} value={editRecipe.prepTime || ''}
                      onChange={e => setEditRecipe(p => ({ ...p, prepTime: parseInt(e.target.value) || 0 }))}
                      className="w-full bg-[#111820] border border-white/10 rounded-xl px-3 py-2 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
              )}
            </section>

            {/* ── MODO DE PREPARO ──────────────────────── */}
            <section>
              <h4 className="text-sm font-black uppercase tracking-widest text-emerald-500 mb-4 flex items-center gap-2">
                <span className="material-symbols-outlined">skillet</span>
                Modo de Preparo
              </h4>

              {(isEditing ? editRecipe.prepSteps : recipe?.prepSteps)?.length === 0 || !(isEditing ? editRecipe.prepSteps : recipe?.prepSteps) ? (
                <div className="p-8 bg-white/5 border border-white/5 border-dashed rounded-3xl text-center">
                  <span className="material-symbols-outlined text-slate-500 text-3xl mb-3 block">edit_note</span>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">
                    {isEditing ? 'Adicione os passos abaixo' : 'Nenhuma instrução cadastrada.'}
                  </p>
                  {!isEditing && (
                    <p className="text-[10px] text-slate-600 mt-1">Clique em "Editar" para adicionar o passo-a-passo.</p>
                  )}
                </div>
              ) : (
                <div className="space-y-3 relative">
                  {!isEditing && <div className="absolute top-4 bottom-4 left-4 w-0.5 bg-gradient-to-b from-emerald-500/50 to-transparent" />}
                  {(isEditing ? editRecipe.prepSteps : recipe?.prepSteps)!.map((step, idx) => (
                    <div key={idx} className={`flex gap-3 relative z-10 ${!isEditing ? 'group' : ''}`}>
                      <div className={`size-8 rounded-full flex items-center justify-center font-black text-xs shrink-0 transition-colors shadow-lg ${isEditing
                          ? 'bg-[#1a2129] border border-white/10 text-slate-400'
                          : 'bg-[#12161b] border-2 border-emerald-500/30 text-emerald-400 group-hover:bg-emerald-500/20 group-hover:border-emerald-500'
                        }`}>
                        {idx + 1}
                      </div>
                      <div className="flex-1 bg-[#12161b] hover:bg-[#1a2129] p-4 rounded-2xl border border-white/5 transition-colors flex items-start gap-2">
                        <p className="text-sm font-bold text-slate-300 leading-relaxed flex-1">{step}</p>
                        {isEditing && (
                          <button onClick={() => removeStep(idx)}
                            className="size-6 shrink-0 bg-rose-500/10 hover:bg-rose-500/30 text-rose-400 rounded-md flex items-center justify-center transition-all mt-0.5">
                            <span className="material-symbols-outlined text-xs">close</span>
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* ✨ Adicionar passo (modo edição) */}
              {isEditing && (
                <div className="mt-3 flex gap-2">
                  <input type="text" placeholder="Descreva o próximo passo..." value={newStep}
                    onChange={e => setNewStep(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addStep()}
                    className="flex-1 bg-[#111820] border border-white/10 rounded-xl px-4 py-2.5 text-xs text-white focus:outline-none focus:border-emerald-500" />
                  <button onClick={addStep}
                    className="px-4 py-2.5 bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/30 text-emerald-400 rounded-xl text-xs font-black transition-all">
                    Add Passo
                  </button>
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MenuView;
