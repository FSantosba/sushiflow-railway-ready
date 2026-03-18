import React, { createContext, useContext, useState, useCallback } from 'react';
import { Ingredient, Recipe, InventoryLog } from '../types';
import { mockIngredients, mockRecipes } from '../utils/mockData';
import { useTables } from './TableContext';
import { sushiMenu, barMenu, kitchenMenu } from '../utils/mockData';

const ALL_MENU = [...sushiMenu, ...barMenu, ...kitchenMenu];

interface CMVContextData {
    ingredients: Ingredient[];
    recipes: Recipe[];
    inventoryLogs: InventoryLog[];
    addIngredient: (ing: Ingredient) => void;
    updateIngredient: (id: string, updates: Partial<Ingredient>) => void;
    removeIngredient: (id: string) => void;
    saveRecipe: (recipe: Recipe) => void;
    registerInventoryTransaction: (user: string, type: 'RETIRADA' | 'ENTRADA' | 'AJUSTE', items: { ingredientId: string; quantity: number }[], notes?: string) => void;
    /** Custo de produção de 1 porção de um prato (R$) */
    getItemCost: (menuItemId: string) => number;
    /** CMV% de um prato: (custo / preço_venda) × 100 */
    getItemCMVPercent: (menuItemId: string) => number;
    /** CMV geral ponderado pelas vendas reais dos tickets fechados */
    getOverallCMV: () => { percent: number; totalCost: number; totalRevenue: number };
}

const CMVContext = createContext<CMVContextData>({} as CMVContextData);

export const CMVProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { closedTickets } = useTables();

    const [ingredients, setIngredients] = useState<Ingredient[]>(() => {
        const saved = localStorage.getItem('@sushiflow:ingredients');
        return saved ? JSON.parse(saved) : mockIngredients;
    });

    const [recipes, setRecipes] = useState<Recipe[]>(() => {
        const saved = localStorage.getItem('@sushiflow:recipes');
        return saved ? JSON.parse(saved) : mockRecipes;
    });

    const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>(() => {
        const saved = localStorage.getItem('@sushiflow:inventoryLogs');
        return saved ? JSON.parse(saved) : [];
    });

    const persist = (ings: Ingredient[], recs: Recipe[], logs: InventoryLog[]) => {
        localStorage.setItem('@sushiflow:ingredients', JSON.stringify(ings));
        localStorage.setItem('@sushiflow:recipes', JSON.stringify(recs));
        localStorage.setItem('@sushiflow:inventoryLogs', JSON.stringify(logs));
    };

    const addIngredient = (ing: Ingredient) => {
        setIngredients(prev => { const next = [...prev, ing]; persist(next, recipes, inventoryLogs); return next; });
    };

    const updateIngredient = (id: string, updates: Partial<Ingredient>) => {
        setIngredients(prev => {
            const next = prev.map(i => i.id === id ? { ...i, ...updates } : i);
            persist(next, recipes, inventoryLogs);
            return next;
        });
    };

    const removeIngredient = (id: string) => {
        setIngredients(prev => { const next = prev.filter(i => i.id !== id); persist(next, recipes, inventoryLogs); return next; });
    };

    const saveRecipe = (recipe: Recipe) => {
        setRecipes(prev => {
            const exists = prev.some(r => r.menuItemId === recipe.menuItemId);
            const next = exists
                ? prev.map(r => r.menuItemId === recipe.menuItemId ? recipe : r)
                : [...prev, recipe];
            persist(ingredients, next, inventoryLogs);
            return next;
        });
    };

    const registerInventoryTransaction = (user: string, type: 'RETIRADA' | 'ENTRADA' | 'AJUSTE', items: { ingredientId: string; quantity: number }[], notes?: string) => {
        const timestamp = Date.now();
        const newLog: InventoryLog = {
            id: `log_${timestamp}_${Math.random().toString(36).substr(2, 5)}`,
            timestamp,
            user,
            type,
            notes,
            items: items.map(req => {
                const ing = ingredients.find(i => i.id === req.ingredientId);
                return {
                    ingredientId: req.ingredientId,
                    ingredientName: ing ? ing.name : 'Item Desconhecido',
                    quantity: req.quantity
                };
            })
        };

        // Atualiza Logs e deduz do Ingredientes em uma tacada só
        let nextIngredients = [...ingredients];
        items.forEach(req => {
            const idx = nextIngredients.findIndex(i => i.id === req.ingredientId);
            if (idx > -1) {
                // se for retirada/ajuste negativo, req.quantity será negativo.
                // se for entrada, positivo.
                nextIngredients[idx] = { ...nextIngredients[idx], stock: Math.max(0, nextIngredients[idx].stock + req.quantity) };
            }
        });

        setIngredients(nextIngredients);
        setInventoryLogs(prev => {
            const next = [newLog, ...prev];
            persist(nextIngredients, recipes, next);
            return next;
        });
    };

    const getItemCost = useCallback((menuItemId: string): number => {
        const recipe = recipes.find(r => r.menuItemId === menuItemId);
        if (!recipe) return 0;
        const totalCost = recipe.items.reduce((acc, ri) => {
            const ing = ingredients.find(i => i.id === ri.ingredientId);
            return acc + (ing ? ing.costPerUnit * ri.quantity : 0);
        }, 0);
        return totalCost / (recipe.yield || 1);
    }, [recipes, ingredients]);

    const getItemCMVPercent = useCallback((menuItemId: string): number => {
        const cost = getItemCost(menuItemId);
        const menuItem = ALL_MENU.find(m => m.id === menuItemId);
        if (!menuItem || menuItem.price === 0 || cost === 0) return 0;
        return (cost / menuItem.price) * 100;
    }, [getItemCost]);

    const getOverallCMV = useCallback((): { percent: number; totalCost: number; totalRevenue: number } => {
        let totalRevenue = 0;
        let totalCost = 0;

        closedTickets.forEach(ticket => {
            ticket.items.forEach(item => {
                // Tentar encontrar o menuItem pelo nome
                const menuItem = ALL_MENU.find(m => m.name === item.name);
                const itemRevenue = item.price * item.qty;
                totalRevenue += itemRevenue;
                if (menuItem) {
                    totalCost += getItemCost(menuItem.id) * item.qty;
                }
            });
        });

        // Fallback: se não tiver tickets fechados, calcular média simples de todos os pratos com receita
        if (totalRevenue === 0) {
            const itemsWithRecipe = ALL_MENU.filter(m => recipes.some(r => r.menuItemId === m.id));
            if (itemsWithRecipe.length > 0) {
                const avgCMV = itemsWithRecipe.reduce((acc, m) => acc + getItemCMVPercent(m.id), 0) / itemsWithRecipe.length;
                return { percent: avgCMV, totalCost: 0, totalRevenue: 0 };
            }
            return { percent: 0, totalCost: 0, totalRevenue: 0 };
        }

        return {
            percent: totalRevenue > 0 ? (totalCost / totalRevenue) * 100 : 0,
            totalCost,
            totalRevenue,
        };
    }, [closedTickets, getItemCost, getItemCMVPercent, recipes]);

    return (
        <CMVContext.Provider value={{
            ingredients, recipes, inventoryLogs,
            addIngredient, updateIngredient, removeIngredient, saveRecipe,
            registerInventoryTransaction,
            getItemCost, getItemCMVPercent, getOverallCMV,
        }}>
            {children}
        </CMVContext.Provider>
    );
};

export const useCMV = () => useContext(CMVContext);
