import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
import { io } from 'socket.io-client';
import { Reservation, WaitingEntry, ReservationStatus } from '../types';

const API_BASE = 'http://localhost:3000/api';
const socket = io('http://localhost:3000');

interface ReservationConfig {
    slots: { time: string; maxPeople: number }[];
    blockedDates: string[];
    active: boolean;
}

interface ReservationContextData {
    reservations: Reservation[];
    waitingList: WaitingEntry[];
    config: ReservationConfig;
    loading: boolean;
    addReservation: (reservation: Reservation) => Promise<void>;
    updateReservation: (id: string, updates: Partial<Reservation>) => Promise<void>;
    deleteReservation: (id: string) => Promise<void>;
    addWaitingEntry: (entry: WaitingEntry) => Promise<void>;
    updateWaitingEntry: (id: string, updates: Partial<WaitingEntry>) => Promise<void>;
    removeWaitingEntry: (id: string) => Promise<void>;
    saveConfig: (config: ReservationConfig) => Promise<void>;
}

const ReservationContext = createContext<ReservationContextData>({} as ReservationContextData);

export const ReservationProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [waitingList, setWaitingList] = useState<WaitingEntry[]>([]);
    const [config, setConfig] = useState<ReservationConfig>({ slots: [], blockedDates: [], active: true });
    const [loading, setLoading] = useState(true);

    const fetchData = async () => {
        try {
            const [resData, waitData, configData] = await Promise.all([
                axios.get(`${API_BASE}/reservations`),
                axios.get(`${API_BASE}/waiting-list`),
                axios.get(`${API_BASE}/reservation-config`)
            ]);
            setReservations(resData.data || []);
            setWaitingList(waitData.data || []);
            const defaultConfig = { slots: [], blockedDates: [], active: true };
            setConfig({ ...defaultConfig, ...configData.data });
        } catch (err) {
            console.error('Erro ao carregar reservas:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();

        socket.on('new_reservation', (newRes: Reservation & { isPublic?: boolean }) => {
            setReservations(prev => {
                if (prev.find(r => r.id === newRes.id)) return prev;
                return [newRes, ...prev];
            });

            // Se for reserva pública, dispara som se estiver no modo admin
            if (newRes.isPublic) {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.play().catch(e => console.warn('Erro ao tocar som:', e));
            }
        });

        socket.on('reservation_deleted', (id: string) => {
            setReservations(prev => prev.filter(r => r.id !== id));
        });

        socket.on('waiting_list_update', (list: WaitingEntry[]) => {
            setWaitingList(list);
        });

        socket.on('reservation_config_update', (newConfig: ReservationConfig) => {
            setConfig(newConfig);
        });

        return () => {
            socket.off('new_reservation');
            socket.off('reservation_deleted');
            socket.off('waiting_list_update');
            socket.off('reservation_config_update');
        };
    }, []);

    const addReservation = async (reservation: Reservation) => {
        await axios.post(`${API_BASE}/reservations`, reservation);
    };

    const updateReservation = async (id: string, updates: Partial<Reservation>) => {
        const res = reservations.find(r => r.id === id);
        if (res) {
            await axios.post(`${API_BASE}/reservations`, { ...res, ...updates });
        }
    };

    const deleteReservation = async (id: string) => {
        await axios.delete(`${API_BASE}/reservations/${id}`);
    };

    const addWaitingEntry = async (entry: WaitingEntry) => {
        await axios.post(`${API_BASE}/waiting-list`, entry);
    };

    const updateWaitingEntry = async (id: string, updates: Partial<WaitingEntry>) => {
        const item = waitingList.find(w => w.id === id);
        if (item) {
            await axios.post(`${API_BASE}/waiting-list`, { ...item, ...updates });
        }
    };

    const removeWaitingEntry = async (id: string) => {
        await axios.delete(`${API_BASE}/waiting-list/${id}`);
    };

    const saveConfig = async (newConfig: ReservationConfig) => {
        await axios.post(`${API_BASE}/reservation-config`, newConfig);
    };

    return (
        <ReservationContext.Provider value={{
            reservations,
            waitingList,
            config,
            loading,
            addReservation,
            updateReservation,
            deleteReservation,
            addWaitingEntry,
            updateWaitingEntry,
            removeWaitingEntry,
            saveConfig
        }}>
            {children}
        </ReservationContext.Provider>
    );
};

export const useReservations = () => useContext(ReservationContext);
