import React, { createContext, useContext, useState, useEffect } from 'react';

export type UserRole = 'manager' | 'waiter' | 'kitchen' | 'cashier' | 'driver' | 'delivery_manager';

export interface AppUser {
    id: string;
    name: string;
    role: UserRole;
    pin: string;
    avatar: string;
    color: string;
    allowedScreens: string[];
}

const INITIAL_USERS: AppUser[] = [
    { id: 'u1', name: 'Kenji Sato', role: 'manager', pin: '1234', avatar: '\uD83C\uDF63', color: 'from-primary to-orange-700', allowedScreens: ['all'] },
    { id: 'u2', name: 'Carla Oliveira', role: 'waiter', pin: '2222', avatar: '\uD83C\uDF74', color: 'from-cyan-500 to-blue-700', allowedScreens: ['mesas', 'cardapio'] },
    { id: 'u3', name: 'Takashi Mitsui', role: 'kitchen', pin: '3333', avatar: '\uD83D\uDC68\u200D\uD83C\uDF73', color: 'from-emerald-500 to-green-700', allowedScreens: ['cozinha'] },
    { id: 'u4', name: 'Bruno Lima', role: 'cashier', pin: '4444', avatar: '\uD83D\uDCB0', color: 'from-purple-500 to-violet-700', allowedScreens: ['caixa', 'pdv'] },
];

const ROLE_LABELS: Record<UserRole, string> = {
    manager: 'Gerente',
    waiter: 'Gar\u00e7om',
    kitchen: 'Cozinha',
    cashier: 'Caixa',
    driver: 'Motoboy',
    delivery_manager: 'Expedição'
};

interface AuthContextData {
    currentUser: AppUser | null;
    users: AppUser[];
    login: (userId: string, pin: string) => boolean;
    logout: () => void;
    getRoleLabel: (role: UserRole) => string;
    saveUser: (user: AppUser) => void;
    deleteUser: (userId: string) => void;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [users, setUsers] = useState<AppUser[]>(() => {
        const saved = localStorage.getItem('@sushiflow:users');
        if (saved) return JSON.parse(saved);
        return INITIAL_USERS;
    });

    const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
        const saved = localStorage.getItem('@sushiflow:currentUser');
        if (saved) {
            const parsed = JSON.parse(saved);
            return users.find(u => u.id === parsed.id) || null;
        }
        return null;
    });

    useEffect(() => {
        localStorage.setItem('@sushiflow:users', JSON.stringify(users));
        // If current user is removed or updated, update current user
        if (currentUser) {
            const updatedProfile = users.find(u => u.id === currentUser.id);
            if (!updatedProfile) {
                logout();
            } else {
                // To avoid infinite loops strictly check if anything changed
                // Object comparison is heavy, just replace if ref is different, handled nicely by objects
                setCurrentUser(updatedProfile);
            }
        }
    }, [users]);

    const login = (userId: string, pin: string): boolean => {
        const user = users.find(u => u.id === userId && u.pin === pin);
        if (user) {
            setCurrentUser(user);
            localStorage.setItem('@sushiflow:currentUser', JSON.stringify({ id: user.id }));
            return true;
        }
        return false;
    };

    const logout = () => {
        setCurrentUser(null);
        localStorage.removeItem('@sushiflow:currentUser');
    };

    const saveUser = (user: AppUser) => {
        setUsers(prev => {
            const exists = prev.find(u => u.id === user.id);
            if (exists) return prev.map(u => u.id === user.id ? user : u);
            return [...prev, user];
        });
    };

    const deleteUser = (userId: string) => {
        setUsers(prev => prev.filter(u => u.id !== userId));
    };

    return (
        <AuthContext.Provider value={{ currentUser, users, login, logout, getRoleLabel: (r) => ROLE_LABELS[r], saveUser, deleteUser }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { ROLE_LABELS };
