import React, { createContext, useContext, useState, useCallback } from 'react';
import { Ingredient, Recipe, InventoryLog } from '../types';
import { mockIngredients, mockRecipes, sushiMenu, barMenu, kitchenMenu } from '../utils/mockData';
import { useTables } from './TableContext';

const ALL_MENU = [...sushiMenu, ...barMenu, ...kitchenMenu];

export interface Supplier {
    id: string; name: string; categories: string[]; contact: string; deliveryDays: string; reliabilityScore: number;
}

export interface PurchaseOrder {
    id: string; supplierId: string; status: 'RASCUNHO' | 'COTAÇÃO' | 'AGUARDANDO_ENTREGA' | 'RECEBIDO';
    items: { ingredientId: string; quantity: number; quotedPrice: number }[];
    createdAt: number; updatedAt: number; totalEstimated: number;
}

export type ExtendedIngredient = Ingredient & { supplierIds?: string[] };

interface CMVContextData {
    ingredients: ExtendedIngredient[]; recipes: Recipe[]; inventoryLogs: InventoryLog[]; suppliers: Supplier[]; purchaseOrders: PurchaseOrder[];
    addIngredient: (ing: ExtendedIngredient) => void;
    updateIngredient: (id: string, updates: Partial<ExtendedIngredient>) => void;
    removeIngredient: (id: string) => void;
    saveRecipe: (recipe: Recipe) => void;
    registerInventoryTransaction: (user: string, type: 'RETIRADA' | 'ENTRADA' | 'AJUSTE', items: { ingredientId: string; quantity: number }[], notes?: string) => void;
    getItemCost: (menuItemId: string) => number;
    getItemCMVPercent: (menuItemId: string) => number;
    getOverallCMV: () => { percent: number; totalCost: number; totalRevenue: number };
    addSupplier: (supplier: Supplier, productIds: string[]) => void;
    updateSupplierLinks: (supplierId: string, productIds: string[]) => void; // ✨ NOVA
    createPurchaseOrder: (supplierId: string, items: { ingredientId: string; quantity: number; quotedPrice: number }[]) => void;
    updateOrderQuote: (orderId: string, updatedItems: { ingredientId: string; quantity: number; quotedPrice: number }[]) => void;
    receivePurchaseOrder: (orderId: string, finalItems: { ingredientId: string; quantity: number; quotedPrice: number }[]) => void;
}

const CMVContext = createContext<CMVContextData>({} as CMVContextData);

export const CMVProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const { closedTickets } = useTables();

    const [ingredients, setIngredients] = useState<ExtendedIngredient[]>(() => {
        const saved = localStorage.getItem('@sushiflow:ingredients'); return saved ? JSON.parse(saved) : mockIngredients;
    });
    const [recipes, setRecipes] = useState<Recipe[]>(() => {
        const saved = localStorage.getItem('@sushiflow:recipes'); return saved ? JSON.parse(saved) : mockRecipes;
    });
    const [inventoryLogs, setInventoryLogs] = useState<InventoryLog[]>(() => {
        const saved = localStorage.getItem('@sushiflow:inventoryLogs'); return saved ? JSON.parse(saved) : [];
    });
    const [suppliers, setSuppliers] = useState<Supplier[]>(() => {
        const saved = localStorage.getItem('@sushiflow:suppliers'); return saved ? JSON.parse(saved) : [];
    });
    const [purchaseOrders, setPurchaseOrders] = useState<PurchaseOrder[]>(() => {
        const saved = localStorage.getItem('@sushiflow:purchaseOrders'); return saved ? JSON.parse(saved) : [];
    });

    const persist = (ings: ExtendedIngredient[], recs: Recipe[], logs: InventoryLog[], sups: Supplier[], orders: PurchaseOrder[]) => {
        localStorage.setItem('@sushiflow:ingredients', JSON.stringify(ings));
        localStorage.setItem('@sushiflow:recipes', JSON.stringify(recs));
        localStorage.setItem('@sushiflow:inventoryLogs', JSON.stringify(logs));
        localStorage.setItem('@sushiflow:suppliers', JSON.stringify(sups));
        localStorage.setItem('@sushiflow:purchaseOrders', JSON.stringify(orders));
    };

    const addIngredient = (ing: ExtendedIngredient) => setIngredients(prev => { const next = [...prev, ing]; persist(next, recipes, inventoryLogs, suppliers, purchaseOrders); return next; });
    const updateIngredient = (id: string, updates: Partial<ExtendedIngredient>) => setIngredients(prev => { const next = prev.map(i => i.id === id ? { ...i, ...updates } : i); persist(next, recipes, inventoryLogs, suppliers, purchaseOrders); return next; });
    const removeIngredient = (id: string) => setIngredients(prev => { const next = prev.filter(i => i.id !== id); persist(next, recipes, inventoryLogs, suppliers, purchaseOrders); return next; });

    // ✨ Lógica para Salvar Fornecedor e Vínculos Iniciais
    const addSupplier = (supplier: Supplier, productIds: string[]) => {
        const nextSuppliers = [...suppliers, supplier];
        const nextIngredients = ingredients.map(ing => {
            if (productIds.includes(ing.id)) {
                const ids = ing.supplierIds || [];
                return { ...ing, supplierIds: ids.includes(supplier.id) ? ids : [...ids, supplier.id] };
            }
            return ing;
        });
        setSuppliers(nextSuppliers);
        setIngredients(nextIngredients);
        persist(nextIngredients, recipes, inventoryLogs, nextSuppliers, purchaseOrders);
    };

    // ✨ Lógica para Atualizar Vínculos (Editar)
    const updateSupplierLinks = (supplierId: string, productIds: string[]) => {
        const nextIngredients = ingredients.map(ing => {
            const currentIds = ing.supplierIds || [];
            const shouldBeLinked = productIds.includes(ing.id);
            const isCurrentlyLinked = currentIds.includes(supplierId);

            if (shouldBeLinked && !isCurrentlyLinked) {
                return { ...ing, supplierIds: [...currentIds, supplierId] };
            } else if (!shouldBeLinked && isCurrentlyLinked) {
                return { ...ing, supplierIds: currentIds.filter(id => id !== supplierId) };
            }
            return ing;
        });
        setIngredients(nextIngredients);
        persist(nextIngredients, recipes, inventoryLogs, suppliers, purchaseOrders);
    };

    const saveRecipe = (recipe: Recipe) => setRecipes(prev => {
        const exists = prev.some(r => r.menuItemId === recipe.menuItemId);
        const next = exists ? prev.map(r => r.menuItemId === recipe.menuItemId ? recipe : r) : [...prev, recipe];
        persist(ingredients, next, inventoryLogs, suppliers, purchaseOrders); return next;
    });

    const registerInventoryTransaction = (user: string, type: 'RETIRADA' | 'ENTRADA' | 'AJUSTE', items: { ingredientId: string; quantity: number }[], notes?: string) => {
        const timestamp = Date.now();
        const newLog: InventoryLog = {
            id: `log_${timestamp}_${Math.random().toString(36).substr(2, 5)}`, timestamp, user, type, notes,
            items: items.map(req => {
                const ing = ingredients.find(i => i.id === req.ingredientId);
                return { ingredientId: req.ingredientId, ingredientName: ing ? ing.name : 'Desconhecido', quantity: req.quantity };
            })
        };
        let nextIngredients = [...ingredients];
        items.forEach(req => {
            const idx = nextIngredients.findIndex(i => i.id === req.ingredientId);
            if (idx > -1) nextIngredients[idx] = { ...nextIngredients[idx], stock: Math.max(0, nextIngredients[idx].stock + req.quantity) };
        });
        setIngredients(nextIngredients);
        setInventoryLogs(prev => { const next = [newLog, ...prev]; persist(nextIngredients, recipes, next, suppliers, purchaseOrders); return next; });
    };

    const createPurchaseOrder = (supplierId: string, items: { ingredientId: string; quantity: number; quotedPrice: number }[]) => {
        const totalEstimated = items.reduce((acc, item) => acc + (item.quotedPrice * item.quantity), 0);
        const newOrder: PurchaseOrder = { id: `po_${Date.now()}`, supplierId, status: 'COTAÇÃO', items, createdAt: Date.now(), updatedAt: Date.now(), totalEstimated };
        setPurchaseOrders(prev => { const next = [newOrder, ...prev]; persist(ingredients, recipes, inventoryLogs, suppliers, next); return next; });
    };

    const updateOrderQuote = (orderId: string, updatedItems: { ingredientId: string; quantity: number; quotedPrice: number }[]) => {
        const totalEstimated = updatedItems.reduce((acc, item) => acc + (item.quotedPrice * item.quantity), 0);
        setPurchaseOrders(prev => {
            const next = prev.map(o => o.id === orderId ? { ...o, items: updatedItems, totalEstimated, status: 'AGUARDANDO_ENTREGA', updatedAt: Date.now() } : o);
            persist(ingredients, recipes, inventoryLogs, suppliers, next); return next;
        });
    };

    const receivePurchaseOrder = (orderId: string, finalItems: { ingredientId: string; quantity: number; quotedPrice: number }[]) => {
        let nextIngredients = [...ingredients];
        finalItems.forEach(item => {
            const idx = nextIngredients.findIndex(i => i.id === item.ingredientId);
            if (idx > -1 && item.quantity > 0) {
                nextIngredients[idx] = { ...nextIngredients[idx], stock: nextIngredients[idx].stock + item.quantity, costPerUnit: item.quotedPrice };
            }
        });
        const newLog: InventoryLog = {
            id: `log_${Date.now()}_rcv`, timestamp: Date.now(), user: 'Sistema (Recebimento NF)', type: 'ENTRADA', notes: `NF Pedido ${orderId.split('_')[1]}`,
            items: finalItems.filter(i => i.quantity > 0).map(req => ({ ingredientId: req.ingredientId, ingredientName: nextIngredients.find(i => i.id === req.ingredientId)?.name || 'Desconhecido', quantity: req.quantity }))
        };
        setIngredients(nextIngredients);
        setInventoryLogs(prevLogs => {
            const nextLogs = [newLog, ...prevLogs];
            setPurchaseOrders(prevOrders => {
                const nextOrders = prevOrders.map(o => o.id === orderId ? { ...o, items: finalItems, status: 'RECEBIDO', updatedAt: Date.now() } : o);
                persist(nextIngredients, recipes, nextLogs, suppliers, nextOrders); return nextOrders;
            });
            return nextLogs;
        });
    };

    const getItemCost = useCallback((menuItemId: string): number => {
        const recipe = recipes.find(r => r.menuItemId === menuItemId); if (!recipe) return 0;
        return recipe.items.reduce((acc, ri) => {
            const ing = ingredients.find(i => i.id === ri.ingredientId); return acc + (ing ? ing.costPerUnit * ri.quantity : 0);
        }, 0) / (recipe.yield || 1);
    }, [recipes, ingredients]);

    const getItemCMVPercent = useCallback((menuItemId: string): number => {
        const cost = getItemCost(menuItemId); const menuItem = ALL_MENU.find(m => m.id === menuItemId);
        if (!menuItem || menuItem.price === 0 || cost === 0) return 0; return (cost / menuItem.price) * 100;
    }, [getItemCost]);

    const getOverallCMV = useCallback((): { percent: number; totalCost: number; totalRevenue: number } => {
        let totalRevenue = 0; let totalCost = 0;
        closedTickets.forEach(ticket => {
            ticket.items.forEach(item => {
                const menuItem = ALL_MENU.find(m => m.name === item.name);
                totalRevenue += item.price * item.qty;
                if (menuItem) totalCost += getItemCost(menuItem.id) * item.qty;
            });
        });
        if (totalRevenue === 0) return { percent: 0, totalCost: 0, totalRevenue: 0 };
        return { percent: (totalCost / totalRevenue) * 100, totalCost, totalRevenue };
    }, [closedTickets, getItemCost, recipes]);

    return (
        <CMVContext.Provider value={{
            ingredients, recipes, inventoryLogs, suppliers, purchaseOrders,
            addIngredient, updateIngredient, removeIngredient, saveRecipe, registerInventoryTransaction,
            getItemCost, getItemCMVPercent, getOverallCMV, addSupplier, updateSupplierLinks, createPurchaseOrder,
            updateOrderQuote, receivePurchaseOrder
        }}>
            {children}
        </CMVContext.Provider>
    );
};

export const useCMV = () => useContext(CMVContext);