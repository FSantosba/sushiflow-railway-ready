import React, { useState, useEffect } from 'react';
import { useReservations } from '../../context/ReservationContext';
import { Reservation, ReservationStatus } from '../../types';
import { io } from 'socket.io-client';

const API_BASE = 'http://localhost:3000/api';

const PublicReservationView: React.FC = () => {
    const { config, addReservation, loading } = useReservations();
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        customer: '',
        phone: '',
        people: 2,
        date: new Date().toISOString().split('T')[0],
        time: '',
        notes: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        const socket = io('http://localhost:3000');
        socket.on('reservation_config_update', () => {
            window.location.reload();
        });
        return () => { socket.disconnect(); };
    }, []);

    // Filter available slots
    const availableSlots = (config.slots || []).filter(slot => {
        return true; 
    });

    const handleNext = () => setStep(step + 1);
    const handleBack = () => setStep(step - 1);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            const newRes: Reservation = {
                id: `PUB-${Date.now()}`,
                customer: formData.customer,
                phone: formData.phone,
                people: formData.people,
                time: formData.time,
                date: formData.date,
                status: ReservationStatus.PENDING,
                notes: formData.notes
            };
            // @ts-ignore - passing isPublic flag to backend via context (which uses axios)
            await addReservation({ ...newRes, isPublic: true });
            setStep(3); // Success step
        } catch (err) {
            alert('Erro ao realizar reserva. Tente novamente.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!config.active && !loading) {
        return (
            <div className="min-h-screen bg-[#0a0e14] flex items-center justify-center p-6 text-center">
                <div className="max-w-md">
                    <span className="material-symbols-outlined text-6xl text-rose-500 mb-4">event_busy</span>
                    <h1 className="text-2xl font-black text-white mb-2">Reservas Indisponíveis</h1>
                    <p className="text-slate-400">Atualmente não estamos aceitando reservas online. Por favor, entre em contato por telefone.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#0a0e14] text-slate-100 font-sans selection:bg-primary selection:text-white">
            {/* Header / Brand */}
            <div className="p-6 flex justify-center">
                <div className="flex items-center gap-2">
                    <div className="size-10 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/20">
                        <span className="material-symbols-outlined text-white">restaurant</span>
                    </div>
                    <h1 className="text-xl font-black tracking-tighter uppercase whitespace-nowrap">Sushi<span className="text-primary">Flow</span></h1>
                </div>
            </div>

            <main className="max-w-xl mx-auto p-4 md:p-6 pb-20">
                {step === 1 && (
                    <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <div className="text-center mb-10">
                            <h2 className="text-4xl font-black mb-3">Reserve sua <span className="text-primary">Mesa</span></h2>
                            <p className="text-slate-500 font-medium">Escolha a data e o horário da sua experiência</p>
                        </div>

                        <div className="space-y-8">
                            {/* Date Picker */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">1. Selecione a Data</label>
                                <div className="grid grid-cols-1 gap-3">
                                    <input 
                                        type="date" 
                                        min={new Date().toISOString().split('T')[0]}
                                        value={formData.date}
                                        onChange={(e) => {
                                            if (config.blockedDates?.includes(e.target.value)) {
                                                alert('Data indisponível para reservas.');
                                                return;
                                            }
                                            setFormData({...formData, date: e.target.value});
                                        }}
                                        className="w-full bg-[#11161d] border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all shadow-xl"
                                    />
                                </div>
                            </div>

                            {/* Time Slots */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">2. Horário Disponível</label>
                                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 md:gap-3">
                                    {availableSlots.length > 0 ? availableSlots.map((slot) => (
                                        <button
                                            key={slot.time}
                                            onClick={() => setFormData({...formData, time: slot.time})}
                                            className={`py-3 md:py-4 rounded-xl md:rounded-2xl text-xs md:text-sm font-black transition-all border ${formData.time === slot.time ? 'bg-primary border-primary text-white shadow-lg shadow-primary/20' : 'bg-[#11161d] border-white/5 text-slate-400 hover:border-white/20'}`}
                                        >
                                            {slot.time}
                                        </button>
                                    )) : (
                                        <p className="col-span-full text-center text-slate-600 italic py-4">Nenhum horário disponível para esta data.</p>
                                    )}
                                </div>
                            </div>

                            {/* People Multiplier */}
                            <div>
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-3 block">3. Quantas Pessoas?</label>
                                <div className="flex items-center justify-between bg-[#11161d] p-2 rounded-2xl border border-white/5">
                                    <button 
                                        disabled={formData.people <= 1}
                                        onClick={() => setFormData({...formData, people: formData.people - 1})}
                                        className="size-12 rounded-xl flex items-center justify-center hover:bg-white/5 disabled:opacity-20"
                                    >
                                        <span className="material-symbols-outlined">remove</span>
                                    </button>
                                    <div className="text-center">
                                        <span className="text-3xl font-black">{formData.people}</span>
                                        <span className="block text-[8px] font-black text-slate-500 uppercase">Lugares</span>
                                    </div>
                                    <button 
                                        onClick={() => setFormData({...formData, people: formData.people + 1})}
                                        className="size-12 rounded-xl flex items-center justify-center hover:bg-white/5"
                                    >
                                        <span className="material-symbols-outlined">add</span>
                                    </button>
                                </div>
                            </div>

                            <button 
                                disabled={!formData.time}
                                onClick={handleNext}
                                className="w-full bg-primary py-5 rounded-2xl text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-30 disabled:hover:scale-100"
                            >
                                Continuar
                            </button>
                        </div>
                    </div>
                )}

                {step === 2 && (
                    <div className="animate-in slide-in-from-right-4 duration-500">
                        <button onClick={handleBack} className="flex items-center gap-2 text-slate-500 hover:text-white mb-8 transition-colors">
                            <span className="material-symbols-outlined text-sm">arrow_back</span>
                            <span className="text-[10px] font-black uppercase tracking-widest">Voltar</span>
                        </button>

                        <div className="mb-10">
                            <h2 className="text-3xl font-black mb-3">Seus <span className="text-primary">Dados</span></h2>
                            <p className="text-slate-500 font-medium">Como podemos te identificar?</p>
                        </div>

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Nome Completo</label>
                                <input 
                                    required
                                    value={formData.customer}
                                    onChange={e => setFormData({...formData, customer: e.target.value})}
                                    placeholder="Como devemos te chamar?" 
                                    className="w-full bg-[#11161d] border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">WhatsApp / Celular</label>
                                <input 
                                    required
                                    type="tel"
                                    value={formData.phone}
                                    onChange={e => setFormData({...formData, phone: e.target.value})}
                                    placeholder="(00) 00000-0000" 
                                    className="w-full bg-[#11161d] border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all" 
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-2 mb-1 block">Observações (Opcional)</label>
                                <textarea 
                                    value={formData.notes}
                                    onChange={e => setFormData({...formData, notes: e.target.value})}
                                    placeholder="Alguma alergia ou preferência?" 
                                    className="w-full bg-[#11161d] border border-white/5 rounded-2xl p-4 text-white focus:border-primary outline-none transition-all resize-none"
                                    rows={3}
                                />
                            </div>

                            <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl mb-4">
                               <div className="flex justify-between items-center text-xs font-bold text-slate-400">
                                  <span>Data: {new Date(formData.date).toLocaleDateString('pt-BR')}</span>
                                  <span className="text-primary">{formData.time}h</span>
                               </div>
                               <div className="mt-1 text-xs font-bold text-slate-400">
                                  <span>Grupos de {formData.people} pessoas</span>
                               </div>
                            </div>

                            <button 
                                type="submit"
                                disabled={isSubmitting}
                                className="w-full bg-primary py-5 rounded-2xl text-white font-black uppercase tracking-widest shadow-2xl shadow-primary/30 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-3"
                            >
                                {isSubmitting ? (
                                    <div className="size-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Confirmar Reserva</span>
                                        <span className="material-symbols-outlined">check_circle</span>
                                    </>
                                )}
                            </button>
                        </form>
                    </div>
                )}

                {step === 3 && (
                    <div className="min-h-[60vh] flex flex-col items-center justify-center text-center animate-in zoom-in duration-500">
                        <div className="size-24 bg-emerald-500 rounded-full flex items-center justify-center mb-8 shadow-2xl shadow-emerald-500/20">
                            <span className="material-symbols-outlined text-white text-5xl">done_all</span>
                        </div>
                        <h2 className="text-4xl font-black mb-4">Reserva <span className="text-emerald-500">Solicitada!</span></h2>
                        <p className="text-slate-400 max-w-xs mb-10 leading-relaxed font-medium">
                            Tudo pronto, {formData.customer.split(' ')[0]}! Sua mesa para <b>{formData.people} pessoas</b> no dia <b>{new Date(formData.date).toLocaleDateString('pt-BR')} às {formData.time}</b> foi enviada para nossa equipe.
                        </p>
                        
                        <div className="space-y-3 w-full">
                            <button 
                                onClick={() => window.open(`https://wa.me/?text=Olá! Acabei de fazer uma reserva no SushiFlow para o dia ${new Date(formData.date).toLocaleDateString('pt-BR')} às ${formData.time} para ${formData.people} pessoas.`)}
                                className="w-full bg-[#25D366] py-4 rounded-2xl text-white font-black uppercase tracking-widest flex items-center justify-center gap-2"
                            >
                                <span className="material-symbols-outlined">message</span>
                                Avisar no WhatsApp
                            </button>
                            <button 
                                onClick={() => setStep(1)}
                                className="w-full bg-white/5 py-4 rounded-2xl text-slate-400 font-black uppercase tracking-widest text-[10px]"
                            >
                                Fazer Outra Reserva
                            </button>
                        </div>
                    </div>
                )}
            </main>

            {/* Footer decoration */}
            <div className="fixed bottom-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-emerald-500 to-amber-500" />
        </div>
    );
};

export default PublicReservationView;
