import React, { useState, useMemo } from 'react';
import { useCMV } from '../../context/CMVContext';
import { sushiMenu, barMenu, kitchenMenu } from '../../utils/mockData';
import { Ingredient, Recipe } from '../../types';
import { useTables } from '../../context/TableContext';

const ALL_MENU = [...sushiMenu, ...barMenu, ...kitchenMenu];

type Tab = 'panel' | 'recipes' | 'ingredients' | 'audit';

const CMV_IDEAL = 35; // % limite saudável

// ─── Helpers ───────────────────────────────────────────────────────────────
const getCMVColor = (pct: number, text = false) => {
    if (pct === 0) return text ? 'text-slate-600' : 'bg-slate-800';
    if (pct <= 30) return text ? 'text-emerald-400' : 'bg-emerald-500';
    if (pct <= 40) return text ? 'text-amber-400' : 'bg-amber-500';
    return text ? 'text-rose-400' : 'bg-rose-500';
};

const getCMVLabel = (pct: number) => {
    if (pct === 0) return { label: 'Sem ficha', cls: 'bg-slate-800/50 text-slate-500 border-slate-700' };
    if (pct <= 30) return { label: 'Excelente', cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' };
    if (pct <= 40) return { label: 'Aceitável', cls: 'bg-amber-500/10 text-amber-400 border-amber-500/30' };
    return { label: 'Crítico', cls: 'bg-rose-500/10 text-rose-400 border-rose-500/30' };
};

// ─── Componente Principal ─────────────────────────────────────────────────
const CMVView: React.FC = () => {
    const { closedTickets } = useTables();
    const { ingredients, recipes, inventoryLogs, addIngredient, updateIngredient, removeIngredient, saveRecipe, getItemCost, getItemCMVPercent, getOverallCMV } = useCMV();
    const [activeTab, setActiveTab] = useState<Tab>('panel');
    const [editRecipe, setEditRecipe] = useState<Recipe | null>(null);
    const [editIngModal, setEditIngModal] = useState<Ingredient | null>(null);
    const [showNewIng, setShowNewIng] = useState(false);
    const [newIng, setNewIng] = useState<Partial<Ingredient>>({ category: 'misc', unit: 'kg' });

    const overallCMV = useMemo(() => getOverallCMV(), [getOverallCMV]);

    // Todos os pratos com CMV calculado
    const dishCMV = useMemo(() =>
        ALL_MENU.map(m => ({
            ...m,
            cost: getItemCost(m.id),
            cmvPct: getItemCMVPercent(m.id),
            margin: m.price - getItemCost(m.id),
        })).sort((a, b) => b.cmvPct - a.cmvPct),
        [getItemCost, getItemCMVPercent]
    );

    const withRecipe = dishCMV.filter(d => d.cmvPct > 0);
    const mostExpensive = [...dishCMV].filter(d => d.cost > 0).sort((a, b) => b.cost - a.cost)[0];
    const mostProfitable = [...dishCMV].filter(d => d.margin > 0).sort((a, b) => b.margin - a.margin)[0];

    // --- CÁLCULO DE AUDITORIA (Teórico vs Real) ---
    const auditData = useMemo(() => {
        // 1. Mapear Consumo Teórico pelos Tickets Fechados
        const theoreticalUsage: Record<string, number> = {};
        closedTickets.forEach(ticket => {
            ticket.items.forEach(item => {
                const menuItem = ALL_MENU.find(m => m.name === item.name);
                if (!menuItem) return;
                const recipe = recipes.find(r => r.menuItemId === menuItem.id);
                if (!recipe) return;

                const portions = item.qty / (recipe.yield || 1);
                recipe.items.forEach(ri => {
                    theoreticalUsage[ri.ingredientId] = (theoreticalUsage[ri.ingredientId] || 0) + (ri.quantity * portions);
                });
            });
        });

        // 2. Mapear Consumo Real Reportado (Apenas Retiradas/Ajustes) nos Logs
        const reportedUsage: Record<string, number> = {};
        inventoryLogs.forEach(log => {
            if (log.type === 'RETIRADA' || log.type === 'AJUSTE') {
                log.items.forEach(li => {
                    // Logs de retirada/ajuste trazem qty negativo
                    // Vamos armazenar como positivo para comparar "O que foi consumido"
                    const absQty = Math.abs(li.quantity);
                    reportedUsage[li.ingredientId] = (reportedUsage[li.ingredientId] || 0) + absQty;
                });
            }
        });

        // 3. Cruzar Dados para encontrar as Divergências
        return ingredients.map(ing => {
            const teorico = theoreticalUsage[ing.id] || 0;
            const real = reportedUsage[ing.id] || 0;
            const diff = teorico - real; // Positivo: Sobejou (Teórico maior que real - talvez n foi tudo reportado). Negativo: Faltou (Usou mais doq deveria).
            const isAlert = diff < 0; // Gastaram mais do que o PDV mandou gastar -> Desperdício/Ladrão
            const lostCost = isAlert ? Math.abs(diff) * ing.costPerUnit : 0;

            return {
                ...ing,
                teorico,
                real,
                diff,
                isAlert,
                lostCost
            };
        }).filter(i => i.teorico > 0 || i.real > 0).sort((a, b) => b.lostCost - a.lostCost); // Ordena por maior prejuizo
    }, [closedTickets, recipes, inventoryLogs, ingredients]);

    return (
        <div className="h-full flex flex-col overflow-hidden bg-[#080c10]">
            {/* Header */}
            <div className="relative px-8 pt-8 pb-6 border-b border-white/5 shrink-0 overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/20 via-transparent to-transparent pointer-events-none" />
                <div className="absolute top-0 right-0 w-80 h-80 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
                <div className="relative z-10 flex items-end justify-between flex-wrap gap-4">
                    <div>
                        <p className="text-[10px] font-black text-emerald-500/70 uppercase tracking-widest mb-1">Módulo Gerencial</p>
                        <h1 className="text-4xl font-black tracking-tighter italic uppercase text-white">Gestão de CMV</h1>
                        <p className="text-sm text-slate-500 mt-1">Custo de Mercadoria Vendida — Meta ideal: abaixo de {CMV_IDEAL}%</p>
                    </div>
                    {/* CMV Geral Destaque */}
                    <div className="bg-[#111820] border border-white/5 rounded-2xl px-6 py-3 flex items-center gap-4">
                        <div>
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CMV Geral</p>
                            <p className={`text-5xl font-black italic tracking-tighter ${getCMVColor(overallCMV.percent, true)}`}>
                                {overallCMV.percent > 0 ? `${overallCMV.percent.toFixed(1)}%` : '--'}
                            </p>
                        </div>
                        <div className={`size-12 rounded-2xl flex items-center justify-center ${overallCMV.percent === 0 ? 'bg-slate-800' :
                            overallCMV.percent <= 30 ? 'bg-emerald-500/20' :
                                overallCMV.percent <= 40 ? 'bg-amber-500/20' : 'bg-rose-500/20'
                            }`}>
                            <span className={`material-symbols-outlined text-2xl ${getCMVColor(overallCMV.percent, true)}`}>
                                {overallCMV.percent === 0 ? 'help' : overallCMV.percent <= CMV_IDEAL ? 'trending_down' : 'trending_up'}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Abas */}
                <div className="relative z-10 flex flex-wrap gap-1 mt-6 bg-black/30 p-1 rounded-xl border border-white/5 w-fit">
                    {([['panel', 'Painel CMV', 'monitoring'], ['recipes', 'Fichas Técnicas', 'menu_book'], ['audit', 'Auditoria de Sobra/Falta', 'troubleshoot'], ['ingredients', 'Insumos', 'grocery']] as const).map(([id, label, icon]) => (
                        <button key={id} onClick={() => setActiveTab(id as Tab)} className={`flex items-center gap-2 px-5 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${activeTab === id ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/20' : 'text-slate-500 hover:text-slate-300'}`}>
                            <span className="material-symbols-outlined text-sm">{icon}</span>
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-8 pb-16">

                {/* ─── ABA: Painel CMV ─────────────────────────────────────────────── */}
                {activeTab === 'panel' && (
                    <div className="space-y-8">
                        {/* KPIs */}
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            <div className="bg-[#111820] border border-white/5 rounded-[2rem] p-6">
                                <div className="size-11 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-3">
                                    <span className="material-symbols-outlined text-emerald-400">price_check</span>
                                </div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">CMV Geral Estimado</p>
                                <p className={`text-3xl font-black ${getCMVColor(overallCMV.percent, true)}`}>{overallCMV.percent > 0 ? `${overallCMV.percent.toFixed(1)}%` : '--'}</p>
                                <p className="text-[10px] text-slate-600 font-bold mt-1">Meta: abaixo de {CMV_IDEAL}%</p>
                            </div>
                            <div className="bg-[#111820] border border-white/5 rounded-[2rem] p-6">
                                <div className="size-11 rounded-xl bg-cyan-500/10 flex items-center justify-center mb-3">
                                    <span className="material-symbols-outlined text-cyan-400">receipt_long</span>
                                </div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Pratos com Ficha</p>
                                <p className="text-3xl font-black text-white">{withRecipe.length}<span className="text-sm text-slate-500 font-bold ml-1">/ {ALL_MENU.length}</span></p>
                                <p className="text-[10px] text-slate-600 font-bold mt-1">Fichas técnicas cadastradas</p>
                            </div>
                            <div className="bg-[#111820] border border-white/5 rounded-[2rem] p-6">
                                <div className="size-11 rounded-xl bg-rose-500/10 flex items-center justify-center mb-3">
                                    <span className="material-symbols-outlined text-rose-400">local_fire_department</span>
                                </div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Maior Custo</p>
                                <p className="text-xl font-black text-white leading-tight">{mostExpensive?.name || '--'}</p>
                                <p className="text-[10px] text-rose-400 font-bold mt-1">R$ {mostExpensive?.cost.toFixed(2) || '--'} / porção</p>
                            </div>
                            <div className="bg-[#111820] border border-white/5 rounded-[2rem] p-6">
                                <div className="size-11 rounded-xl bg-amber-500/10 flex items-center justify-center mb-3">
                                    <span className="material-symbols-outlined text-amber-400">star</span>
                                </div>
                                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Maior Margem</p>
                                <p className="text-xl font-black text-white leading-tight">{mostProfitable?.name || '--'}</p>
                                <p className="text-[10px] text-amber-400 font-bold mt-1">R$ {mostProfitable?.margin.toFixed(2) || '--'} / porção</p>
                            </div>
                        </div>

                        {/* Gráfico de CMV por Prato */}
                        <div className="bg-[#111820] border border-white/5 rounded-[2rem] p-6">
                            <div className="flex items-center justify-between mb-6">
                                <div className="flex items-center gap-3">
                                    <span className="material-symbols-outlined text-emerald-400">bar_chart</span>
                                    <h3 className="text-sm font-black uppercase tracking-widest text-white">CMV por Prato</h3>
                                </div>
                                <div className="flex gap-4 text-[9px] font-black uppercase tracking-widest">
                                    <span className="flex items-center gap-1 text-emerald-400"><span className="size-2 rounded-full bg-emerald-500 inline-block" />≤ 30% Excelente</span>
                                    <span className="flex items-center gap-1 text-amber-400"><span className="size-2 rounded-full bg-amber-500 inline-block" />≤ 40% Aceitável</span>
                                    <span className="flex items-center gap-1 text-rose-400"><span className="size-2 rounded-full bg-rose-500 inline-block" />&gt; 40% Crítico</span>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {dishCMV.filter(d => d.cmvPct > 0).map(dish => (
                                    <div key={dish.id} className="flex items-center gap-4">
                                        <p className="text-xs font-bold text-slate-400 w-40 shrink-0 truncate">{dish.name}</p>
                                        <div className="flex-1 h-7 bg-black/40 rounded-full overflow-hidden border border-white/5 relative">
                                            <div
                                                className={`h-full rounded-full transition-all duration-700 flex items-center justify-end pr-3 ${getCMVColor(dish.cmvPct)}`}
                                                style={{ width: `${Math.min(dish.cmvPct, 100)}%` }}
                                            >
                                                <span className="text-[10px] font-black text-white">{dish.cmvPct.toFixed(1)}%</span>
                                            </div>
                                            {/* Linha de meta (35%) */}
                                            <div className="absolute top-0 bottom-0 border-l-2 border-white/30 border-dashed" style={{ left: `${CMV_IDEAL}%` }} />
                                        </div>
                                        <div className="w-24 text-right shrink-0">
                                            <p className="text-[10px] font-black text-slate-500">R$ {dish.cost.toFixed(2)}</p>
                                            <p className="text-[9px] text-emerald-400/70 font-bold">+R$ {dish.margin.toFixed(2)}</p>
                                        </div>
                                    </div>
                                ))}
                                {dishCMV.filter(d => d.cmvPct === 0).length > 0 && (
                                    <p className="text-[10px] text-slate-600 font-bold pt-2 border-t border-white/5">
                                        {dishCMV.filter(d => d.cmvPct === 0).length} prato(s) sem ficha técnica cadastrada
                                    </p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── ABA: Fichas Técnicas ─────────────────────────────────────────── */}
                {activeTab === 'recipes' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {ALL_MENU.map(menuItem => {
                                const pct = getItemCMVPercent(menuItem.id);
                                const cost = getItemCost(menuItem.id);
                                const { label, cls } = getCMVLabel(pct);
                                const recipe = recipes.find(r => r.menuItemId === menuItem.id);
                                return (
                                    <button
                                        key={menuItem.id}
                                        onClick={() => setEditRecipe(recipe || { menuItemId: menuItem.id, items: [], yield: 1 })}
                                        className="bg-[#111820] border border-white/5 rounded-[1.5rem] p-5 text-left hover:border-white/20 hover:scale-[1.02] transition-all group relative overflow-hidden"
                                    >
                                        <div className={`absolute inset-0 opacity-0 group-hover:opacity-5 ${pct > 0 ? getCMVColor(pct) : 'bg-white'} transition-opacity rounded-[1.5rem]`} />
                                        <div className="flex justify-between items-start mb-3">
                                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${cls}`}>{label}</span>
                                            <span className="material-symbols-outlined text-slate-600 group-hover:text-slate-400 transition-colors text-sm">edit</span>
                                        </div>
                                        <h4 className="font-black text-white text-sm leading-tight mb-1">{menuItem.name}</h4>
                                        <p className="text-[10px] text-slate-500 font-bold mb-3">Venda: R$ {menuItem.price.toFixed(2)}</p>
                                        {recipe ? (
                                            <div className="space-y-1">
                                                <div className="flex justify-between">
                                                    <span className="text-[10px] text-slate-500">Custo:</span>
                                                    <span className="text-[10px] font-black text-white">R$ {cost.toFixed(2)}</span>
                                                </div>
                                                <div className="flex justify-between">
                                                    <span className="text-[10px] text-slate-500">CMV:</span>
                                                    <span className={`text-[10px] font-black ${getCMVColor(pct, true)}`}>{pct.toFixed(1)}%</span>
                                                </div>
                                                <div className="w-full h-1.5 bg-black/40 rounded-full mt-2">
                                                    <div className={`h-full rounded-full ${getCMVColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
                                                </div>
                                            </div>
                                        ) : (
                                            <p className="text-[10px] text-slate-600 font-bold flex items-center gap-1">
                                                <span className="material-symbols-outlined text-xs">add_circle</span>
                                                Adicionar ficha técnica
                                            </p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* ─── ABA: Insumos ─────────────────────────────────────────────────── */}
                {activeTab === 'ingredients' && (
                    <div className="space-y-4">
                        <div className="flex justify-between items-center">
                            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{ingredients.length} insumos cadastrados</p>
                            <button onClick={() => { setNewIng({ category: 'misc', unit: 'kg' }); setShowNewIng(true); }} className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-emerald-600/20">
                                <span className="material-symbols-outlined text-sm">add</span>
                                Novo Insumo
                            </button>
                        </div>

                        <div className="bg-[#111820] border border-white/5 rounded-[2rem] overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-black/20 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                                        <th className="px-6 py-3">Insumo</th>
                                        <th className="px-6 py-3">Categoria</th>
                                        <th className="px-6 py-3">Unidade</th>
                                        <th className="px-6 py-3">Custo / Un.</th>
                                        <th className="px-6 py-3">Estoque</th>
                                        <th className="px-6 py-3 text-right">Ações</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5">
                                    {ingredients.map(ing => (
                                        <tr key={ing.id} className="hover:bg-white/[0.02] transition-colors group">
                                            <td className="px-6 py-3 font-bold text-white text-sm">{ing.name}</td>
                                            <td className="px-6 py-3">
                                                <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase border ${ing.category === 'proteina' ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' :
                                                    ing.category === 'carboidrato' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                                                        ing.category === 'molho' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                                                            ing.category === 'embalagem' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                                                                'bg-slate-700/50 text-slate-400 border-slate-700'
                                                    }`}>{ing.category}</span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-400 text-xs font-mono">{ing.unit}</td>
                                            <td className="px-6 py-3">
                                                <span className="text-sm font-black text-emerald-400 font-mono">R$ {ing.costPerUnit.toFixed(2)}</span>
                                            </td>
                                            <td className="px-6 py-3 text-slate-400 text-xs font-mono">{ing.stock} {ing.unit}</td>
                                            <td className="px-6 py-3 text-right">
                                                <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button onClick={() => setEditIngModal({ ...ing })} className="size-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-slate-400 hover:text-white transition-colors">
                                                        <span className="material-symbols-outlined text-sm">edit</span>
                                                    </button>
                                                    <button onClick={() => removeIngredient(ing.id)} className="size-8 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 hover:text-rose-300 transition-colors">
                                                        <span className="material-symbols-outlined text-sm">delete</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* ─── ABA: Auditoria de Estoque ──────────────────────────────────────── */}
                {activeTab === 'audit' && (
                    <div className="space-y-6">
                        <div className="flex justify-between items-end mb-4">
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-widest text-emerald-500 italic flex items-center gap-2">
                                    <span className="material-symbols-outlined">troubleshoot</span>
                                    Auditoria: Teórico vs Real
                                </h3>
                                <p className="text-xs text-slate-500 font-bold max-w-2xl mt-1">Cruzamos o "Consumo Teórico" (Receitas dos pratos vendidos) com o "Consumo Real" (O que a cozinha retirou do Estoque através do Carrinho). Divergências negativas indicam desperdício, erro de corte, ou extravio.</p>
                            </div>
                            <div className="bg-[#111820] border border-white/5 py-3 px-6 rounded-2xl">
                                <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">Total Faltante Sugestivo</p>
                                <p className="text-2xl font-black italic text-rose-500">R$ {auditData.reduce((acc, i) => acc + i.lostCost, 0).toFixed(2)}</p>
                            </div>
                        </div>

                        <div className="bg-[#111820] border border-white/5 rounded-[2rem] overflow-hidden">
                            <table className="w-full text-left">
                                <thead>
                                    <tr className="bg-black/20 text-[9px] font-black uppercase tracking-widest text-slate-500 border-b border-white/5">
                                        <th className="px-6 py-4">Insumo</th>
                                        <th className="px-6 py-4 text-center">Consumo Teórico<br /><span className="text-[8px] text-emerald-600 leading-none">Vendido PDV</span></th>
                                        <th className="px-6 py-4 text-center">Consumo Real<br /><span className="text-[8px] text-emerald-600 leading-none">Reportado Carrinho</span></th>
                                        <th className="px-6 py-4 text-right">Divergência<br /><span className="text-[8px] text-emerald-600 leading-none">Sobra / Faltante</span></th>
                                        <th className="px-6 py-4 text-right">Potencial Perda R$</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-white/5 text-sm">
                                    {auditData.map(item => {
                                        const isUnit = ['un', 'cx'].includes(item.unit);
                                        const unitStr = isUnit ? '' : item.unit;
                                        return (
                                            <tr key={item.id} className="hover:bg-white/[0.02] transition-colors">
                                                <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-slate-300 bg-white/[0.01]">
                                                    {item.teorico.toFixed(isUnit ? 0 : 2)} <span className="text-[10px] text-slate-500">{unitStr}</span>
                                                </td>
                                                <td className="px-6 py-4 text-center font-mono font-bold text-slate-300">
                                                    {item.real.toFixed(isUnit ? 0 : 2)} <span className="text-[10px] text-slate-500">{unitStr}</span>
                                                </td>
                                                <td className={`px-6 py-4 text-right font-black font-mono flex items-center justify-end gap-2 ${item.isAlert ? 'text-rose-500 bg-rose-500/5' : item.diff > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>
                                                    {item.isAlert && <span className="material-symbols-outlined text-[14px]">warning</span>}
                                                    {item.diff > 0 ? '+' : ''}{item.diff.toFixed(isUnit ? 0 : 2)} <span className="text-[10px] opacity-50">{unitStr}</span>
                                                </td>
                                                <td className="px-6 py-4 text-right font-black font-mono">
                                                    {item.isAlert && item.lostCost > 0 ? (
                                                        <span className="px-2 py-1 bg-rose-500/20 text-rose-400 rounded-lg">R$ {item.lostCost.toFixed(2)}</span>
                                                    ) : (
                                                        <span className="text-slate-600">--</span>
                                                    )}
                                                </td>
                                            </tr>
                                        )
                                    })}
                                    {auditData.length === 0 && (
                                        <tr>
                                            <td colSpan={5} className="py-12 text-center text-slate-500 font-bold uppercase tracking-widest text-xs">
                                                Tudo perfeito. Nenhuma venda ou retirada registrada ainda.
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}
            </div>

            {/* ─── MODAL: Editar Ficha Técnica ─────────────────────────────────── */}
            {editRecipe && (
                <RecipeModal
                    recipe={editRecipe}
                    menuItem={ALL_MENU.find(m => m.id === editRecipe.menuItemId)!}
                    ingredients={ingredients}
                    getItemCost={getItemCost}
                    getItemCMVPercent={getItemCMVPercent}
                    onSave={(r) => { saveRecipe(r); setEditRecipe(null); }}
                    onClose={() => setEditRecipe(null)}
                />
            )}

            {/* ─── MODAL: Editar Insumo ────────────────────────────────────────── */}
            {editIngModal && (
                <IngredientModal
                    ingredient={editIngModal}
                    onSave={(updates) => { updateIngredient(editIngModal.id, updates); setEditIngModal(null); }}
                    onClose={() => setEditIngModal(null)}
                />
            )}

            {/* ─── MODAL: Novo Insumo ──────────────────────────────────────────── */}
            {showNewIng && (
                <NewIngredientModal
                    onSave={(ing) => { addIngredient(ing); setShowNewIng(false); }}
                    onClose={() => setShowNewIng(false)}
                />
            )}
        </div>
    );
};

// ─── Modal: Ficha Técnica ──────────────────────────────────────────────────
const RecipeModal: React.FC<{
    recipe: Recipe;
    menuItem: { name: string; price: number };
    ingredients: Ingredient[];
    getItemCost: (id: string) => number;
    getItemCMVPercent: (id: string) => number;
    onSave: (r: Recipe) => void;
    onClose: () => void;
}> = ({ recipe, menuItem, ingredients, onSave, onClose }) => {
    const [localRecipe, setLocalRecipe] = useState<Recipe>({ ...recipe, items: [...recipe.items] });
    const [newIngId, setNewIngId] = useState('');

    // CMV calculado em tempo real a partir da ficha local
    const localCost = localRecipe.items.reduce((acc, ri) => {
        const ing = ingredients.find(i => i.id === ri.ingredientId);
        return acc + (ing ? ing.costPerUnit * ri.quantity : 0);
    }, 0) / (localRecipe.yield || 1);

    const localCMVPct = menuItem.price > 0 ? (localCost / menuItem.price) * 100 : 0;

    const updateQty = (ingredientId: string, qty: number) => {
        setLocalRecipe(prev => ({
            ...prev,
            items: prev.items.map(i => i.ingredientId === ingredientId ? { ...i, quantity: qty } : i)
        }));
    };

    const addItem = () => {
        if (!newIngId || localRecipe.items.some(i => i.ingredientId === newIngId)) return;
        setLocalRecipe(prev => ({ ...prev, items: [...prev.items, { ingredientId: newIngId, quantity: 0.1 }] }));
        setNewIngId('');
    };

    const removeItem = (ingId: string) => {
        setLocalRecipe(prev => ({ ...prev, items: prev.items.filter(i => i.ingredientId !== ingId) }));
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in">
            <div className="bg-[#12161b] border border-white/10 rounded-[2.5rem] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 overflow-hidden flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-start">
                    <div>
                        <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest">Ficha Técnica</p>
                        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">{menuItem.name}</h3>
                        <p className="text-xs text-slate-500 font-bold mt-0.5">Preço de venda: R$ {menuItem.price.toFixed(2)}</p>
                    </div>
                    {/* CMV ao Vivo */}
                    <div className="text-right">
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">CMV ao Vivo</p>
                        <p className={`text-4xl font-black italic ${getCMVColor(localCMVPct, true)}`}>{localCMVPct.toFixed(1)}%</p>
                        <p className="text-[10px] text-slate-500 font-mono">Custo: R$ {localCost.toFixed(2)}</p>
                    </div>
                </div>

                <div className="p-6 space-y-8 overflow-y-auto custom-scrollbar flex-1">

                    {/* Seção 1: Insumos (Financeiro/CMV) */}
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest shrink-0">Rendimento (porções)</label>
                            <input
                                type="number"
                                min={1}
                                value={localRecipe.yield}
                                onChange={e => setLocalRecipe(prev => ({ ...prev, yield: Number(e.target.value) }))}
                                className="w-20 bg-black/30 border border-white/10 rounded-xl px-3 py-1.5 text-white text-sm font-black text-center outline-none focus:border-emerald-500 transition-colors"
                            />
                        </div>

                        {/* Ingredientes */}
                        <div className="space-y-2">
                            {localRecipe.items.map(ri => {
                                const ing = ingredients.find(i => i.id === ri.ingredientId);
                                if (!ing) return null;
                                const lineCost = ing.costPerUnit * ri.quantity;
                                return (
                                    <div key={ri.ingredientId} className="flex items-center gap-3 bg-black/20 rounded-xl px-4 py-2 border border-white/5">
                                        <div className="flex-1">
                                            <p className="text-sm font-bold text-white">{ing.name}</p>
                                            <p className="text-[9px] text-slate-500 font-mono">R$ {ing.costPerUnit.toFixed(2)} / {ing.unit}</p>
                                        </div>
                                        <input
                                            type="number"
                                            step="0.001"
                                            min="0"
                                            value={ri.quantity}
                                            onChange={e => updateQty(ri.ingredientId, Number(e.target.value))}
                                            className="w-24 bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-mono text-center outline-none focus:border-emerald-500 transition-colors"
                                        />
                                        <span className="text-[9px] text-slate-500 w-8">{ing.unit}</span>
                                        <span className="text-[10px] font-black text-emerald-400 w-16 text-right font-mono">R$ {lineCost.toFixed(2)}</span>
                                        <button onClick={() => removeItem(ri.ingredientId)} className="size-6 rounded-lg bg-rose-500/10 text-rose-400 hover:text-rose-300 flex items-center justify-center transition-colors">
                                            <span className="material-symbols-outlined text-xs">close</span>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Adicionar ingrediente */}
                        <div className="flex gap-2">
                            <select
                                value={newIngId}
                                onChange={e => setNewIngId(e.target.value)}
                                className="flex-1 bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none focus:border-emerald-500 transition-colors"
                            >
                                <option value="">Selecionar insumo...</option>
                                {ingredients.filter(i => !localRecipe.items.some(ri => ri.ingredientId === i.id)).map(i => (
                                    <option key={i.id} value={i.id}>{i.name} (R$ {i.costPerUnit.toFixed(2)}/{i.unit})</option>
                                ))}
                            </select>
                            <button onClick={addItem} disabled={!newIngId} className="px-4 py-2 bg-emerald-600 disabled:opacity-30 text-white rounded-xl text-xs font-black uppercase transition-all hover:bg-emerald-500">
                                <span className="material-symbols-outlined text-sm">add</span>
                            </button>
                        </div>
                    </div>

                    {/* Seção 2: Modo de Preparo (Cozinha) */}
                    <div className="pt-8 border-t border-white/5 space-y-4">
                        <div className="flex justify-between items-center mb-4">
                            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest flex items-center gap-2">
                                <span className="material-symbols-outlined text-sm">skillet</span> Instruções para a Cozinha
                            </h4>
                            <div className="flex items-center gap-2">
                                <label className="text-[9px] font-bold text-slate-500 uppercase">Tempo Médio (min)</label>
                                <input
                                    type="number"
                                    min={0}
                                    placeholder="0"
                                    value={localRecipe.prepTime || ''}
                                    onChange={e => setLocalRecipe(prev => ({ ...prev, prepTime: Number(e.target.value) || undefined }))}
                                    className="w-16 bg-black/30 border border-white/10 rounded-lg px-2 py-1 text-white text-xs font-bold text-center outline-none focus:border-emerald-500"
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            {(localRecipe.prepSteps || []).map((step, idx) => (
                                <div key={idx} className="flex gap-2">
                                    <span className="mt-2 text-[10px] font-black text-slate-600 w-4">{idx + 1}.</span>
                                    <textarea
                                        value={step}
                                        onChange={e => {
                                            const newSteps = [...(localRecipe.prepSteps || [])];
                                            newSteps[idx] = e.target.value;
                                            setLocalRecipe(prev => ({ ...prev, prepSteps: newSteps }));
                                        }}
                                        placeholder={`Descreva a etapa ${idx + 1}...`}
                                        className="flex-1 bg-black/20 border border-white/5 rounded-xl px-3 py-2 text-white text-sm outline-none focus:border-emerald-500/50 resize-y min-h-[44px]"
                                    />
                                    <button
                                        onClick={() => {
                                            const newSteps = [...(localRecipe.prepSteps || [])];
                                            newSteps.splice(idx, 1);
                                            setLocalRecipe(prev => ({ ...prev, prepSteps: newSteps }));
                                        }}
                                        className="mt-2 size-8 text-slate-500 hover:text-rose-400 shrink-0 flex items-center justify-center transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-sm">delete</span>
                                    </button>
                                </div>
                            ))}
                        </div>

                        <button
                            onClick={() => setLocalRecipe(prev => ({ ...prev, prepSteps: [...(prev.prepSteps || []), ''] }))}
                            className="w-full py-2 bg-emerald-500/5 hover:bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-xl text-xs font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2"
                        >
                            <span className="material-symbols-outlined text-sm">add_circle</span> Adicionar Etapa
                        </button>
                    </div>
                </div>

                <div className="p-6 border-t border-white/5 flex gap-3 bg-[#12161b] shrink-0 mt-auto">
                    <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-white rounded-xl text-xs font-black uppercase border border-white/10 hover:bg-white/10 transition-all">Cancelar</button>
                    <button onClick={() => onSave(localRecipe)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-emerald-500 transition-all">
                        <span className="material-symbols-outlined text-sm mr-1">save</span>
                        Salvar Ficha
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Modal: Editar Insumo ──────────────────────────────────────────────────
const IngredientModal: React.FC<{
    ingredient: Ingredient;
    onSave: (updates: Partial<Ingredient>) => void;
    onClose: () => void;
}> = ({ ingredient, onSave, onClose }) => {
    const [form, setForm] = useState({ ...ingredient });
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in">
            <div className="bg-[#12161b] border border-white/10 rounded-[2.5rem] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-xl font-black text-white uppercase italic mb-6">Editar Insumo</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nome</label>
                        <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Custo / Unid. (R$)</label>
                            <input type="number" step="0.01" value={form.costPerUnit} onChange={e => setForm(p => ({ ...p, costPerUnit: Number(e.target.value) }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors font-mono" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Estoque</label>
                            <input type="number" step="0.1" value={form.stock} onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors font-mono" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Unidade</label>
                            <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as any }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors">
                                {['kg', 'g', 'L', 'ml', 'un', 'cx'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Categoria</label>
                            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors">
                                {['proteina', 'carboidrato', 'molho', 'embalagem', 'misc'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-white rounded-xl text-xs font-black uppercase border border-white/10 hover:bg-white/10 transition-all">Cancelar</button>
                    <button onClick={() => onSave(form)} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-emerald-500 transition-all">Salvar</button>
                </div>
            </div>
        </div>
    );
};

// ─── Modal: Novo Insumo ────────────────────────────────────────────────────
const NewIngredientModal: React.FC<{
    onSave: (ing: Ingredient) => void;
    onClose: () => void;
}> = ({ onSave, onClose }) => {
    const [form, setForm] = useState<Partial<Ingredient>>({ unit: 'kg', category: 'misc', costPerUnit: 0, stock: 0 });
    const handleSave = () => {
        if (!form.name) return;
        onSave({ id: `ing${Date.now()}`, name: form.name!, unit: form.unit!, costPerUnit: form.costPerUnit!, stock: form.stock!, category: form.category! });
    };
    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-6 animate-in fade-in">
            <div className="bg-[#12161b] border border-white/10 rounded-[2.5rem] w-full max-w-md p-6 shadow-2xl animate-in zoom-in-95">
                <h3 className="text-xl font-black text-white uppercase italic mb-6">Novo Insumo</h3>
                <div className="space-y-4">
                    <div>
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Nome do Insumo</label>
                        <input placeholder="Ex: Salmão Premium (Kg)" value={form.name || ''} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Custo / Unid. (R$)</label>
                            <input type="number" step="0.01" placeholder="0.00" value={form.costPerUnit || ''} onChange={e => setForm(p => ({ ...p, costPerUnit: Number(e.target.value) }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors font-mono" />
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Estoque Inicial</label>
                            <input type="number" step="0.1" placeholder="0" value={form.stock || ''} onChange={e => setForm(p => ({ ...p, stock: Number(e.target.value) }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors font-mono" />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Unidade</label>
                            <select value={form.unit} onChange={e => setForm(p => ({ ...p, unit: e.target.value as any }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors">
                                {['kg', 'g', 'L', 'ml', 'un', 'cx'].map(u => <option key={u} value={u}>{u}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest block mb-1.5">Categoria</label>
                            <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value as any }))} className="w-full bg-black/30 border border-white/10 rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-emerald-500 transition-colors">
                                {['proteina', 'carboidrato', 'molho', 'embalagem', 'misc'].map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                        </div>
                    </div>
                </div>
                <div className="flex gap-3 mt-6">
                    <button onClick={onClose} className="flex-1 py-3 bg-white/5 text-white rounded-xl text-xs font-black uppercase border border-white/10 hover:bg-white/10 transition-all">Cancelar</button>
                    <button onClick={handleSave} disabled={!form.name} className="flex-1 py-3 bg-emerald-600 disabled:opacity-40 text-white rounded-xl text-xs font-black uppercase shadow-lg hover:bg-emerald-500 transition-all">
                        <span className="material-symbols-outlined text-sm mr-1">add</span>
                        Cadastrar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default CMVView;
