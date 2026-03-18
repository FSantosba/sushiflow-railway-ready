import React, { createContext, useContext, useState } from 'react';

export type UserRole = 'manager' | 'waiter' | 'kitchen' | 'cashier';

export interface AppUser {
    id: string;
    name: string;
    role: UserRole;
    pin: string;
    avatar: string;
    color: string;
}

const USERS: AppUser[] = [
    { id: 'u1', name: 'Kenji Sato', role: 'manager', pin: '1234', avatar: '\uD83C\uDF63', color: 'from-primary to-orange-700' },
    { id: 'u2', name: 'Carla Oliveira', role: 'waiter', pin: '2222', avatar: '\uD83C\uDF74', color: 'from-cyan-500 to-blue-700' },
    { id: 'u3', name: 'Takashi Mitsui', role: 'kitchen', pin: '3333', avatar: '\uD83D\uDC68\u200D\uD83C\uDF73', color: 'from-emerald-500 to-green-700' },
    { id: 'u4', name: 'Bruno Lima', role: 'cashier', pin: '4444', avatar: '\uD83D\uDCB0', color: 'from-purple-500 to-violet-700' },
];

const ROLE_LABELS: Record<UserRole, string> = {
    manager: 'Gerente',
    waiter: 'Gar\u00e7om',
    kitchen: 'Cozinha',
    cashier: 'Caixa',
};

interface AuthContextData {
    currentUser: AppUser | null;
    users: AppUser[];
    login: (userId: string, pin: string) => boolean;
    logout: () => void;
    getRoleLabel: (role: UserRole) => string;
}

const AuthContext = createContext<AuthContextData>({} as AuthContextData);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [currentUser, setCurrentUser] = useState<AppUser | null>(() => {
        const saved = localStorage.getItem('@sushiflow:currentUser');
        if (saved) {
            const parsed = JSON.parse(saved);
            return USERS.find(u => u.id === parsed.id) || null;
        }
        return null;
    });

    const login = (userId: string, pin: string): boolean => {
        const user = USERS.find(u => u.id === userId && u.pin === pin);
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

    return (
        <AuthContext.Provider value={{ currentUser, users: USERS, login, logout, getRoleLabel: (r) => ROLE_LABELS[r] }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { USERS, ROLE_LABELS };
