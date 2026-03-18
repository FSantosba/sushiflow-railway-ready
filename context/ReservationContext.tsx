import React, { createContext, useContext, useState, useEffect } from 'react';
import { Reservation, WaitingEntry, ReservationStatus } from '../types';
import { mockReservations, mockWaitingList } from '../utils/mockData';

interface ReservationContextData {
    reservations: Reservation[];
    waitingList: WaitingEntry[];
    addReservation: (reservation: Reservation) => void;
    updateReservation: (id: string, updates: Partial<Reservation>) => void;
    addWaitingEntry: (entry: WaitingEntry) => void;
    updateWaitingEntry: (id: string, updates: Partial<WaitingEntry>) => void;
    removeWaitingEntry: (id: string) => void;
}

const ReservationContext = createContext<ReservationContextData>({} as ReservationContextData);

export const ReservationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [reservations, setReservations] = useState<Reservation[]>(() => {
        const saved = localStorage.getItem('@sushiflow:reservations');
        return saved ? JSON.parse(saved) : mockReservations;
    });

    const [waitingList, setWaitingList] = useState<WaitingEntry[]>(() => {
        const saved = localStorage.getItem('@sushiflow:waitingList');
        return saved ? JSON.parse(saved) : mockWaitingList;
    });

    useEffect(() => {
        localStorage.setItem('@sushiflow:reservations', JSON.stringify(reservations));
    }, [reservations]);

    useEffect(() => {
        localStorage.setItem('@sushiflow:waitingList', JSON.stringify(waitingList));
    }, [waitingList]);

    const addReservation = (reservation: Reservation) => {
        setReservations(prev => [reservation, ...prev]);
    };

    const updateReservation = (id: string, updates: Partial<Reservation>) => {
        setReservations(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    };

    const addWaitingEntry = (entry: WaitingEntry) => {
        setWaitingList(prev => [entry, ...prev]);
    };

    const updateWaitingEntry = (id: string, updates: Partial<WaitingEntry>) => {
        setWaitingList(prev => prev.map(w => w.id === id ? { ...w, ...updates } : w));
    };

    const removeWaitingEntry = (id: string) => {
        setWaitingList(prev => prev.filter(w => w.id !== id));
    };

    return (
        <ReservationContext.Provider value={{
            reservations,
            waitingList,
            addReservation,
            updateReservation,
            addWaitingEntry,
            updateWaitingEntry,
            removeWaitingEntry
        }}>
            {children}
        </ReservationContext.Provider>
    );
};

export const useReservations = () => useContext(ReservationContext);
