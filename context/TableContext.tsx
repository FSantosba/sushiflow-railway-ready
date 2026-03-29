import React, { createContext, useContext, useState, useEffect } from 'react';
import { Table, TableStatus, MenuItem, ClosedTicket } from '../types';
import { mockTables } from '../utils/mockData';

export interface CartItem {
    id: string;
    menuItemId: string;
    name: string;
    price: number;
    qty: number;
    notes?: string; // ✨ Observações por item
    status: 'DRAFT' | 'PENDING' | 'READY' | 'SERVED';
    createdAt: number; // ✨ timestamp real para KDS timer
    readyAt?: number; // ✨ momento em que foi marcado como pronto
}

interface TableContextData {
    tables: Table[];
    openTables: Record<string, CartItem[]>;
    activeTableId: string;
    closedTickets: ClosedTicket[]; // ✨ Histórico de tickets
    selectActiveTable: (id: string) => void;
    addItemToTable: (tableId: string, item: MenuItem, notes?: string) => void;
    removeItemFromTable: (tableId: string, itemId: string) => void;
    updateItemQuantity: (tableId: string, itemId: string, delta: number) => void;
    closeTable: (tableId: string, paymentMethod: string) => void;
    getTableTotal: (tableId: string) => number;
    updateItemStatus: (tableId: string, itemId: string, status: 'PENDING' | 'READY' | 'SERVED') => void;
    sendTableOrder: (tableId: string) => void;
    moveTableItems: (fromId: string, toId: string) => void; // ✨ Trocar de Mesa
    notifyReadyCount: number; // ✨ Contador de itens prontos (notificação)
    clearReadyNotifications: () => void;
    addTable: (capacity: number, area?: string) => void;
    removeTable: (tableId: string) => void;
}

const TableContext = createContext<TableContextData>({} as TableContextData);

export const TableProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [tables, setTables] = useState<Table[]>(() => {
        const saved = localStorage.getItem('@sushiflow:tables');
        return saved ? JSON.parse(saved) : mockTables;
    });

    const [openTables, setOpenTables] = useState<Record<string, CartItem[]>>(() => {
        const saved = localStorage.getItem('@sushiflow:tableOrders');
        return saved ? JSON.parse(saved) : {};
    });

    const [closedTickets, setClosedTickets] = useState<ClosedTicket[]>(() => {
        const saved = localStorage.getItem('@sushiflow:closedTickets');
        return saved ? JSON.parse(saved) : [];
    });

    const [activeTableId, setActiveTableId] = useState<string>('01');
    const [prevReadyCount, setPrevReadyCount] = useState(0);
    const [notifyReadyCount, setNotifyReadyCount] = useState(0);

    useEffect(() => {
        localStorage.setItem('@sushiflow:tables', JSON.stringify(tables));
    }, [tables]);

    useEffect(() => {
        localStorage.setItem('@sushiflow:tableOrders', JSON.stringify(openTables));

        // ✨ Detectar novos itens READY para notificar o garçom
        const readyCount = (Object.values(openTables).flat() as CartItem[]).filter(i => i.status === 'READY').length;
        if (readyCount > prevReadyCount) {
            setNotifyReadyCount(c => c + (readyCount - prevReadyCount));
        }
        setPrevReadyCount(readyCount);
    }, [openTables]);

    useEffect(() => {
        localStorage.setItem('@sushiflow:closedTickets', JSON.stringify(closedTickets));
    }, [closedTickets]);

    const selectActiveTable = (id: string) => setActiveTableId(id);

    const clearReadyNotifications = () => setNotifyReadyCount(0);

    const addTable = (capacity: number, area?: string) => {
        // Gerar ID único e sequencial
        const prefix = area === 'vip' ? 'VIP ' : area === 'external' ? 'EXT ' : '';
        const existing = tables.filter(t => t.id.startsWith(prefix));
        const nums = existing
            .map(t => parseInt(t.id.replace(prefix, '').trim()))
            .filter(n => !isNaN(n));
        const nextNum = nums.length > 0 ? Math.max(...nums) + 1 : 1;
        const newId = prefix ? `${prefix}${nextNum}` : String(nextNum).padStart(2, '0');
        const newTable: Table = { id: newId, status: TableStatus.FREE, capacity };
        setTables(prev => [...prev, newTable]);
    };

    const removeTable = (tableId: string) => {
        setTables(prev => prev.filter(t => t.id !== tableId));
        setOpenTables(prev => {
            const next = { ...prev };
            delete next[tableId];
            return next;
        });
    };

    const addItemToTable = (tableId: string, item: MenuItem, notes?: string) => {
        setOpenTables(prev => {
            const tableCart = prev[tableId] || [];
            // Se não tiver notas, agrupa com item existente
            const existingItemIndex = !notes
                ? tableCart.findIndex(i => i.menuItemId === item.id && i.status === 'DRAFT' && !i.notes)
                : -1;

            let newCart;
            if (existingItemIndex >= 0) {
                newCart = [...tableCart];
                newCart[existingItemIndex] = { ...newCart[existingItemIndex], qty: newCart[existingItemIndex].qty + 1 };
            } else {
                newCart = [...tableCart, {
                    id: Math.random().toString(36).substr(2, 9),
                    menuItemId: item.id,
                    name: item.name,
                    price: item.price,
                    qty: 1,
                    notes: notes || undefined,
                    status: 'DRAFT' as const,
                    createdAt: Date.now(),
                }];
            }

            // Atualizar status da mesa
            const table = tables.find(t => t.id === tableId);
            if (table && table.status === TableStatus.FREE) {
                setTables(prevTables => prevTables.map(t =>
                    t.id === tableId ? { ...t, status: TableStatus.OCCUPIED, timeActive: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) } : t
                ));
            }

            return { ...prev, [tableId]: newCart };
        });
    };

    const updateItemQuantity = (tableId: string, itemId: string, delta: number) => {
        setOpenTables(prev => {
            const tableCart = prev[tableId] || [];
            const newCart = tableCart.map(item => {
                if (item.id === itemId) {
                    const newQty = Math.max(0, item.qty + delta);
                    return { ...item, qty: newQty };
                }
                return item;
            }).filter(item => item.qty > 0);

            return { ...prev, [tableId]: newCart };
        });
    };

    const updateItemStatus = (tableId: string, itemId: string, status: 'PENDING' | 'READY' | 'SERVED') => {
        setOpenTables(prev => {
            const tableCart = prev[tableId] || [];
            const newCart = tableCart.map(item => {
                if (item.id === itemId) {
                    const readyAt = status === 'READY' && !item.readyAt ? Date.now() : item.readyAt;
                    return { ...item, status, readyAt };
                }
                return item;
            });

            return { ...prev, [tableId]: newCart };
        });
    };

    const sendTableOrder = (tableId: string) => {
        setOpenTables(prev => {
            const tableCart = prev[tableId] || [];
            const hasDrafts = tableCart.some(item => item.status === 'DRAFT');

            if (!hasDrafts) return prev;

            const newCart = tableCart.map(item => {
                if (item.status === 'DRAFT') {
                    return { ...item, status: 'PENDING' as const };
                }
                return item;
            });

            return { ...prev, [tableId]: newCart };
        });
    };

    const removeItemFromTable = (tableId: string, itemId: string) => {
        setOpenTables(prev => ({
            ...prev,
            [tableId]: prev[tableId]?.filter(i => i.id !== itemId) || []
        }));
    };

    const moveTableItems = (fromId: string, toId: string) => {
        const items = openTables[fromId] || [];
        if (items.length === 0) return;
        // Move cart to target table
        setOpenTables(prev => {
            const next = { ...prev };
            next[toId] = [...(prev[toId] || []), ...items];
            delete next[fromId];
            return next;
        });
        // Update table statuses
        setTables(prev => prev.map(t => {
            if (t.id === fromId) return { ...t, status: TableStatus.FREE, timeActive: undefined, currentTotal: undefined };
            if (t.id === toId) return { ...t, status: TableStatus.OCCUPIED, timeActive: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
            return t;
        }));
    };

    const closeTable = (tableId: string, paymentMethod: string) => {
        const cart = openTables[tableId] || [];
        const subtotal = cart.reduce((acc, item) => acc + item.price * item.qty, 0);
        const total = subtotal * 1.1; // 10% serviço

        // ✨ Salvar ticket no histórico
        if (cart.length > 0) {
            const ticket: ClosedTicket = {
                id: `ticket-${Date.now()}`,
                tableId,
                closedAt: Date.now(),
                items: cart.map(i => ({
                    name: i.name,
                    qty: i.qty,
                    price: i.price,
                    prepTimeMs: i.readyAt ? i.readyAt - i.createdAt : undefined
                })),
                subtotal,
                total,
                paymentMethod,
            };
            setClosedTickets(prev => [ticket, ...prev].slice(0, 100)); // Guardar últimos 100
        }

        // Limpar mesa
        setOpenTables(prev => {
            const newState = { ...prev };
            delete newState[tableId];
            return newState;
        });

        setTables(prev => prev.map(t =>
            t.id === tableId ? { ...t, status: TableStatus.FREE, timeActive: undefined, currentTotal: undefined } : t
        ));
    };

    const getTableTotal = (tableId: string) => {
        const cart = openTables[tableId] || [];
        return cart.reduce((acc, item) => acc + (item.price * item.qty), 0);
    };

    return (
        <TableContext.Provider value={{
            tables,
            openTables,
            activeTableId,
            closedTickets,
            selectActiveTable,
            addItemToTable,
            removeItemFromTable,
            updateItemQuantity,
            closeTable,
            getTableTotal,
            updateItemStatus,
            sendTableOrder,
            moveTableItems,
            notifyReadyCount,
            clearReadyNotifications,
            addTable,
            removeTable,
        }}>
            {children}
        </TableContext.Provider>
    );
};

export const useTables = () => useContext(TableContext);
