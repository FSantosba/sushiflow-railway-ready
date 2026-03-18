import React, { useState, useEffect } from 'react';
import { Reservation, ReservationStatus, WaitingEntry } from '../../types';
import { useReservations } from '../../context/ReservationContext';

const ReservationView: React.FC = () => {
  const { reservations, waitingList, addReservation, updateReservation, addWaitingEntry, removeWaitingEntry, updateWaitingEntry } = useReservations();
  const [now, setNow] = useState(Date.now());
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [showResModal, setShowResModal] = useState(false);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);

  // Form States
  const [customerName, setCustomerName] = useState('');
  const [peopleCount, setPeopleCount] = useState('2');
  const [phone, setPhone] = useState('');
  const [resDate, setResDate] = useState('Hoje');
  const [resTime, setResTime] = useState('19:00');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatWaitTime = (startTime: number) => {
    const diff = Math.floor((now - startTime) / 1000);
    const mins = Math.floor(diff / 60);
    const secs = diff % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleAddWaiting = (e: React.FormEvent) => {
    e.preventDefault();
    const newEntry: WaitingEntry = {
      id: Math.random().toString(36).substr(2, 9),
      customer: customerName,
      phone,
      people: parseInt(peopleCount),
      startTime: Date.now(),
      needsHighChair: false,
      notified: false
    };
    addWaitingEntry(newEntry);
    setShowWaitModal(false);
    resetForm();
  };

  const handleSaveReservation = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingRes) {
      updateReservation(editingRes.id, {
        customer: customerName,
        phone,
        people: parseInt(peopleCount),
        time: resTime,
        date: resDate,
        notes
      });
    } else {
      const newRes: Reservation = {
        id: Math.random().toString(36).substr(2, 9),
        customer: customerName,
        phone,
        people: parseInt(peopleCount),
        time: resTime,
        date: resDate,
        status: ReservationStatus.PENDING,
        notes
      };
      addReservation(newRes);
    }
    setShowResModal(false);
    setEditingRes(null);
    resetForm();
  };

  const startEdit = (res: Reservation) => {
    setCustomerName(res.customer);
    setPhone(res.phone);
    setPeopleCount(res.people.toString());
    setResTime(res.time);
    setResDate(res.date);
    setNotes(res.notes || '');
    setEditingRes(res);
    setShowResModal(true);
  };

  const resetForm = () => {
    setCustomerName('');
    setPhone('');
    setPeopleCount('2');
    setResTime('19:00');
    setResDate('Hoje');
    setNotes('');
  };

  const getReservationStatusColor = (status: ReservationStatus) => {
    switch (status) {
      case ReservationStatus.CONFIRMED: return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case ReservationStatus.PENDING: return 'bg-warning/10 text-warning border-warning/20';
      case ReservationStatus.ARRIVED: return 'bg-primary/10 text-primary border-primary/20';
      case ReservationStatus.CANCELED: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#0a0e14] overflow-hidden relative">
      {/* Upper Stats Dashboard */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-4 gap-6 shrink-0 border-b border-white/5 bg-[#11161d]">
        <div className="bg-black/20 p-5 rounded-3xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Na Fila Agora</p>
          <div className="flex items-center justify-between">
            <h4 className="text-3xl font-black">{waitingList.length} Grupos</h4>
            <span className="material-symbols-outlined text-primary text-3xl">groups</span>
          </div>
        </div>
        <div className="bg-black/20 p-5 rounded-3xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Espera Média</p>
          <div className="flex items-center justify-between">
            <h4 className="text-3xl font-black text-warning">18 min</h4>
            <span className="material-symbols-outlined text-warning text-3xl">schedule</span>
          </div>
        </div>
        <div className="bg-black/20 p-5 rounded-3xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Reservas Hoje</p>
          <div className="flex items-center justify-between">
            <h4 className="text-3xl font-black text-emerald-500">{reservations.filter(r => r.date === 'Hoje').length} Agendas</h4>
            <span className="material-symbols-outlined text-emerald-500 text-3xl">event_available</span>
          </div>
        </div>
        <div className="bg-black/20 p-5 rounded-3xl border border-white/5 shadow-xl">
          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Taxa de No-Show</p>
          <div className="flex items-center justify-between">
            <h4 className="text-3xl font-black text-rose-500">4.2%</h4>
            <span className="material-symbols-outlined text-rose-500 text-3xl">person_remove</span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row gap-6 p-6">
        {/* Fila de Espera Section */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-primary">hourglass_empty</span>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Fila de Espera Live</h3>
            </div>
            <button
              onClick={() => { resetForm(); setShowWaitModal(true); }}
              className="bg-primary/10 text-primary px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary hover:text-white transition-all"
            >
              Novo Cliente
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {waitingList.map((entry) => (
              <div key={entry.id} className="bg-[#161b22] border border-white/5 rounded-3xl p-6 shadow-2xl flex items-center justify-between group hover:border-primary/30 transition-all animate-in slide-in-from-left-4">
                <div className="flex items-center gap-6 flex-1">
                  <div className="size-16 rounded-2xl bg-black/40 flex flex-col items-center justify-center border border-white/5">
                    <span className="text-2xl font-black text-white">{entry.people}</span>
                    <span className="text-[8px] font-black text-slate-500 uppercase leading-none">Pessoas</span>
                  </div>
                  <div className="min-w-0">
                    <h4 className="text-xl font-black text-white truncate group-hover:text-primary transition-colors">{entry.customer}</h4>
                    <div className="flex items-center gap-4 mt-1">
                      <span className="text-[10px] font-black text-slate-500 uppercase flex items-center gap-1">
                        <span className="material-symbols-outlined text-xs">call</span> {entry.phone}
                      </span>
                      {entry.needsHighChair && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase border border-rose-500/20">Cadeirão</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-8">
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Tempo Total</p>
                    <p className={`text-2xl font-black tabular-nums ${Math.floor((now - entry.startTime) / 1000 / 60) > 20 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                      {formatWaitTime(entry.startTime)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => updateWaitingEntry(entry.id, { notified: !entry.notified })}
                      className={`size-12 rounded-2xl flex items-center justify-center transition-all border ${entry.notified ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-slate-500 border-white/5 hover:border-primary'}`}
                      title="Notificar via WhatsApp"
                    >
                      <span className="material-symbols-outlined text-xl">{entry.notified ? 'done_all' : 'sms'}</span>
                    </button>
                    <button
                      onClick={() => removeWaitingEntry(entry.id)}
                      className="h-12 px-6 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.05] transition-all flex items-center gap-2"
                    >
                      <span className="material-symbols-outlined text-lg">chair_alt</span>
                      Sentar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reservas Section */}
        <div className="w-full lg:w-[450px] flex flex-col gap-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-3">
              <span className="material-symbols-outlined text-emerald-500">calendar_month</span>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Agenda de Reservas</h3>
            </div>
            <div className="flex gap-2">
              <button className="bg-white/5 text-slate-400 p-2 rounded-xl hover:text-white transition-all"><span className="material-symbols-outlined text-lg">filter_list</span></button>
              <button
                onClick={() => { resetForm(); setShowResModal(true); }}
                className="bg-emerald-500/10 text-emerald-500 px-4 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all"
              >
                Novo Agendamento
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-4">
            {reservations.map((res) => (
              <div key={res.id} className="bg-[#1c2229] border border-white/5 rounded-[2rem] p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all">
                <div className={`absolute top-0 right-0 w-16 h-16 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity`}>
                  <span className="material-symbols-outlined text-6xl">event</span>
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase border ${getReservationStatusColor(res.status)}`}>
                      {res.status}
                    </span>
                    <h4 className="text-xl font-black text-white mt-3">{res.customer}</h4>
                  </div>
                  <div className="text-right">
                    <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Horário</p>
                    <p className="text-xl font-black text-primary italic">{res.time}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase">Pessoas</p>
                    <p className="text-sm font-black text-white">{res.people} Convidados</p>
                  </div>
                  <div className="bg-black/20 p-3 rounded-xl border border-white/5">
                    <p className="text-[8px] font-black text-slate-500 uppercase">Preferência</p>
                    <p className="text-sm font-black text-emerald-500 truncate">{res.tablePreference || 'Sem preferência'}</p>
                  </div>
                </div>

                {res.notes && (
                  <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-6">
                    <p className="text-[9px] font-bold text-slate-400 italic">"{res.notes}"</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(res)}
                    className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5"
                  >
                    Editar
                  </button>
                  {res.status !== ReservationStatus.CONFIRMED && (
                    <button
                      onClick={() => updateReservation(res.id, { status: ReservationStatus.CONFIRMED })}
                      className="flex-1 py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-emerald-500/20"
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal Nova Reserva/Edição */}
      {showResModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12161b] w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-6 uppercase tracking-wider">{editingRes ? 'Editar Reserva' : 'Nova Reserva'}</h2>
            <form onSubmit={handleSaveReservation} className="space-y-4">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do Cliente" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" required />
              <div className="flex gap-4">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone" className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" />
                <input type="number" value={peopleCount} onChange={e => setPeopleCount(e.target.value)} placeholder="Qtd. Pessoas" className="w-24 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" required />
              </div>
              <div className="flex gap-4">
                <input type="time" value={resTime} onChange={e => setResTime(e.target.value)} className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" required />
                <input type="text" value={resDate} onChange={e => setResDate(e.target.value)} placeholder="Data (ex: Hoje)" className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" required />
              </div>
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observações" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" rows={2} />

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowResModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors">Salvar</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fila de Espera */}
      {showWaitModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12161b] w-full max-w-md rounded-3xl border border-white/10 p-6 shadow-2xl">
            <h2 className="text-xl font-black text-white mb-6 uppercase tracking-wider">Novo na Fila</h2>
            <form onSubmit={handleAddWaiting} className="space-y-4">
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Nome do Cliente" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" required />
              <div className="flex gap-4">
                <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Telefone" className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" />
                <input type="number" value={peopleCount} onChange={e => setPeopleCount(e.target.value)} placeholder="Qtd. Pessoas" className="w-24 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" required />
              </div>

              <div className="flex gap-3 pt-4">
                <button type="button" onClick={() => setShowWaitModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors">Adicionar à Fila</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationView;
