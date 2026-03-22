import React, { createContext, useContext, useState, useEffect } from 'react';
import { MenuItem } from '../types';
import { sushiMenu, kitchenMenu, barMenu } from '../utils/mockData';

export interface Category {
  id: string;
  name: string;
  order: number;
}

interface MenuContextData {
  categories: Category[];
  items: MenuItem[];
  addCategory: (category: Omit<Category, 'id'>) => void;
  updateCategory: (id: string, updates: Partial<Category>) => void;
  removeCategory: (id: string) => void;
  addItem: (item: Omit<MenuItem, 'id'>) => void;
  updateItem: (id: string, updates: Partial<MenuItem>) => void;
  removeItem: (id: string) => void;
  toggleItemAvailability: (id: string) => void;
}

const MenuContext = createContext<MenuContextData>({} as MenuContextData);

const initialCategories: Category[] = [
  { id: 'cat_nigiri', name: 'Nigiri', order: 1 },
  { id: 'cat_temaki', name: 'Temaki', order: 2 },
  { id: 'cat_uramaki', name: 'Uramaki', order: 3 },
  { id: 'cat_sashimi', name: 'Sashimi', order: 4 },
  { id: 'cat_especiais', name: 'Especiais', order: 5 },
  { id: 'cat_entradas', name: 'Entradas', order: 6 },
  { id: 'cat_pratos', name: 'Pratos Quentes', order: 7 },
  { id: 'cat_sopas', name: 'Sopas', order: 8 },
  { id: 'cat_fritos', name: 'Fritos', order: 9 },
  { id: 'cat_sake', name: 'Sake', order: 10 },
  { id: 'cat_drinks', name: 'Drinks', order: 11 },
  { id: 'cat_soft', name: 'Soft Drinks', order: 12 },
  { id: 'cat_cervejas', name: 'Cervejas', order: 13 },
];

const initialItems: MenuItem[] = [...sushiMenu, ...kitchenMenu, ...barMenu];

export const MenuProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [categories, setCategories] = useState<Category[]>(() => {
    const saved = localStorage.getItem('sushiflow_menu_categories');
    return saved ? JSON.parse(saved) : initialCategories;
  });

  const [items, setItems] = useState<MenuItem[]>(() => {
    const saved = localStorage.getItem('sushiflow_menu_items');
    return saved ? JSON.parse(saved) : initialItems;
  });

  useEffect(() => {
    localStorage.setItem('sushiflow_menu_categories', JSON.stringify(categories));
  }, [categories]);

  useEffect(() => {
    localStorage.setItem('sushiflow_menu_items', JSON.stringify(items));
  }, [items]);

  const addCategory = (category: Omit<Category, 'id'>) => {
    const newCategory: Category = {
      ...category,
      id: `cat_${Date.now()}`
    };
    setCategories(prev => [...prev, newCategory]);
  };

  const updateCategory = (id: string, updates: Partial<Category>) => {
    setCategories(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
  };

  const removeCategory = (id: string) => {
    setCategories(prev => prev.filter(c => c.id !== id));
    // Also remove items associated with this category or move them to 'Uncategorized'?
    // For now, let's keep it simple. Usually preventing deletion if there are items is best,
    // but here we aren't enforcing constraints. Just leaving items orphaned or we can remove them.
    // Let's remove them to avoid weird states.
    // Wait, categories uses string name or id? In `MenuItem`, category is a string (name historically).
    // Let's fix this depending on how it's used. In mockData, category is the name.
  };

  const addItem = (item: Omit<MenuItem, 'id'>) => {
    const newItem: MenuItem = {
      ...item,
      id: `item_${Date.now()}`
    };
    setItems(prev => [...prev, newItem]);
  };

  const updateItem = (id: string, updates: Partial<MenuItem>) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, ...updates } : item));
  };

  const removeItem = (id: string) => {
    setItems(prev => prev.filter(item => item.id !== id));
  };

  const toggleItemAvailability = (id: string) => {
    setItems(prev => prev.map(item => item.id === id ? { ...item, available: !item.available } : item));
  };

  return (
    <MenuContext.Provider value={{
      categories,
      items,
      addCategory,
      updateCategory,
      removeCategory,
      addItem,
      updateItem,
      removeItem,
      toggleItemAvailability
    }}>
      {children}
    </MenuContext.Provider>
  );
};

export const useMenu = () => useContext(MenuContext);
