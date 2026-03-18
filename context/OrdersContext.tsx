import React, { createContext, useContext, useState, useEffect } from 'react';
import { Order, OrderStatus } from '../types';
import { mockOrders } from '../utils/mockData';

interface OrdersContextData {
    orders: Order[];
    addOrder: (order: Order) => void;
    updateOrder: (id: string, updates: Partial<Order>) => void;
    removeOrder: (id: string) => void;
    setOrders: React.Dispatch<React.SetStateAction<Order[]>>;
}

const OrdersContext = createContext<OrdersContextData>({} as OrdersContextData);

export const OrdersProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [orders, setOrders] = useState<Order[]>(() => {
        const saved = localStorage.getItem('@sushiflow:orders');
        return saved ? JSON.parse(saved) : mockOrders;
    });

    useEffect(() => {
        localStorage.setItem('@sushiflow:orders', JSON.stringify(orders));
    }, [orders]);

    const addOrder = (order: Order) => {
        setOrders(prev => [order, ...prev]);
    };

    const updateOrder = (id: string, updates: Partial<Order>) => {
        setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } : o));
    };

    const removeOrder = (id: string) => {
        setOrders(prev => prev.filter(o => o.id !== id));
    };

    return (
        <OrdersContext.Provider value={{ orders, addOrder, updateOrder, removeOrder, setOrders }}>
            {children}
        </OrdersContext.Provider>
    );
};

export const useOrders = () => useContext(OrdersContext);
