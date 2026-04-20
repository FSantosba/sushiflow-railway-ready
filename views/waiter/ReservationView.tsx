import React, { useState, useEffect } from 'react';
import { Reservation, ReservationStatus, WaitingEntry } from '../../types';
import { useReservations } from '../../context/ReservationContext';

const ReservationView: React.FC = () => {
  const { 
    reservations, 
    waitingList, 
    config, 
    addReservation, 
    updateReservation, 
    addWaitingEntry, 
    removeWaitingEntry, 
    updateWaitingEntry,
    saveConfig 
  } = useReservations();
  const [now, setNow] = useState(Date.now());
  const [showWaitModal, setShowWaitModal] = useState(false);
  const [showResModal, setShowResModal] = useState(false);
  const [showSlotModal, setShowSlotModal] = useState(false);
  const [showBlockModal, setShowBlockModal] = useState(false);

  console.log('Slots atuais:', config.slots);
  const [editingRes, setEditingRes] = useState<Reservation | null>(null);
  const [activeTab, setActiveTab] = useState<'fila' | 'agenda' | 'config'>('fila');
  const [newSlotTime, setNewSlotTime] = useState('19:00');
  const [newSlotMax, setNewSlotMax] = useState('20');
  const [newBlockDate, setNewBlockDate] = useState('');

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
      <div className="p-3 md:p-6 grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-6 shrink-0 border-b border-white/5 bg-[#11161d]">
        <div className="bg-black/20 p-3 md:p-5 rounded-xl md:rounded-3xl border border-white/5 shadow-xl min-w-0">
          <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Na Fila</p>
          <div className="flex items-center justify-between">
            <h4 className="text-lg md:text-3xl font-black">{waitingList.length} <span className="hidden md:inline">Grupos</span><span className="md:hidden">Gr.</span></h4>
            <span className="material-symbols-outlined text-primary text-xl md:text-3xl">groups</span>
          </div>
        </div>
        <div className="bg-black/20 p-3 md:p-5 rounded-xl md:rounded-3xl border border-white/5 shadow-xl min-w-0">
          <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Média</p>
          <div className="flex items-center justify-between">
            <h4 className="text-lg md:text-3xl font-black text-warning">18m</h4>
            <span className="material-symbols-outlined text-warning text-xl md:text-3xl">schedule</span>
          </div>
        </div>
        <div className="bg-black/20 p-3 md:p-5 rounded-xl md:rounded-3xl border border-white/5 shadow-xl min-w-0">
          <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Hoje</p>
          <div className="flex items-center justify-between">
            <h4 className="text-lg md:text-3xl font-black text-emerald-500">{reservations.filter(r => r.date === 'Hoje').length} <span className="hidden md:inline">Agendas</span><span className="md:hidden">Ag.</span></h4>
            <span className="material-symbols-outlined text-emerald-500 text-xl md:text-3xl">event_available</span>
          </div>
        </div>
        <div className="bg-black/20 p-3 md:p-5 rounded-xl md:rounded-3xl border border-white/5 shadow-xl min-w-0">
          <p className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">No-Show</p>
          <div className="flex items-center justify-between">
            <h4 className="text-lg md:text-3xl font-black text-rose-500">4.2%</h4>
            <span className="material-symbols-outlined text-rose-500 text-xl md:text-3xl">person_remove</span>
          </div>
        </div>
      </div>

      {/* Mobile Tabs */}
      <div className="flex lg:hidden p-3 pb-0 gap-2 border-b border-white/5 shrink-0">
        <button
          onClick={() => setActiveTab('fila')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'fila' 
              ? 'border-primary text-white' 
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Fila de Espera
        </button>
        <button
          onClick={() => setActiveTab('agenda')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'agenda' 
              ? 'border-emerald-500 text-white' 
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Agenda
        </button>
        <button
          onClick={() => setActiveTab('config')}
          className={`flex-1 py-3 text-xs font-bold uppercase tracking-widest border-b-2 transition-all ${
            activeTab === 'config' 
              ? 'border-amber-500 text-white' 
              : 'border-transparent text-slate-500 hover:text-slate-300'
          }`}
        >
          Config
        </button>
      </div>

      <div className="flex-1 overflow-y-auto lg:overflow-hidden flex flex-col lg:flex-row gap-4 lg:gap-6 p-3 md:p-6 pb-24 md:pb-6">
        {/* Fila de Espera Section */}
        <div className={`flex-1 flex-col gap-4 min-w-0 ${activeTab === 'fila' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="material-symbols-outlined text-primary text-xl md:text-2xl">hourglass_empty</span>
              <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-white">Fila de Espera</h3>
            </div>
            <button
              onClick={() => { resetForm(); setShowWaitModal(true); }}
              className="bg-primary/10 text-primary px-3 md:px-4 py-1.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-primary/20 hover:bg-primary hover:text-white transition-all flex items-center gap-1"
            >
              <span className="material-symbols-outlined text-sm hidden sm:inline">add</span>
              Novo
            </button>
          </div>

          <div className="lg:flex-1 lg:overflow-y-auto custom-scrollbar lg:pr-2 space-y-4">
            {waitingList.map((entry) => (
              <div key={entry.id} className="bg-[#161b22] border border-white/5 mx-1 rounded-2xl md:rounded-3xl p-4 md:p-6 shadow-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between group hover:border-primary/30 transition-all">
                <div className="flex items-center gap-4 md:gap-6 w-full sm:flex-1 mb-4 sm:mb-0">
                  <div className="size-12 md:size-16 shrink-0 rounded-xl md:rounded-2xl bg-black/40 flex flex-col items-center justify-center border border-white/5">
                    <span className="text-xl md:text-2xl font-black text-white">{entry.people}</span>
                    <span className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase leading-none mt-0.5">Pessoas</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <h4 className="text-lg md:text-xl font-black text-white truncate group-hover:text-primary transition-colors">{entry.customer}</h4>
                    <div className="flex items-center flex-wrap gap-2 md:gap-4 mt-1">
                      <span className="text-[9px] md:text-[10px] font-black text-slate-500 uppercase flex items-center gap-1 border border-white/5 rounded px-1.5 py-0.5 whitespace-nowrap">
                        <span className="material-symbols-outlined text-[10px] md:text-xs">call</span> {entry.phone}
                      </span>
                      {entry.needsHighChair && (
                        <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-500 text-[8px] font-black uppercase border border-rose-500/20 whitespace-nowrap">Cadeirão</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between sm:justify-end gap-4 md:gap-8 w-full sm:w-auto border-t sm:border-0 border-white/5 pt-4 sm:pt-0 mt-2 sm:mt-0">
                  <div className="text-left sm:text-right">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">Tempo Total</p>
                    <p className={`text-xl md:text-2xl font-black tabular-nums ${Math.floor((now - entry.startTime) / 1000 / 60) > 20 ? 'text-rose-500 animate-pulse' : 'text-white'}`}>
                      {formatWaitTime(entry.startTime)}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => updateWaitingEntry(entry.id, { notified: !entry.notified })}
                      className={`size-10 md:size-12 rounded-xl md:rounded-2xl flex items-center justify-center transition-all border ${entry.notified ? 'bg-emerald-500 text-white border-emerald-500' : 'bg-white/5 text-slate-400 border-white/5 hover:border-primary hover:text-white'}`}
                      title="Notificar via WhatsApp"
                    >
                      <span className="material-symbols-outlined text-lg md:text-xl">{entry.notified ? 'done_all' : 'sms'}</span>
                    </button>
                    <button
                      onClick={() => removeWaitingEntry(entry.id)}
                      className="h-10 md:h-12 px-4 md:px-6 bg-primary text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl md:rounded-2xl shadow-xl shadow-primary/20 hover:scale-[1.05] active:scale-95 transition-all flex items-center gap-1 md:gap-2 shrink-0"
                    >
                      <span className="material-symbols-outlined text-base md:text-lg">chair_alt</span>
                      Sentar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Reservas Section */}
        <div className={`w-full lg:w-[450px] flex-col gap-4 ${activeTab === 'agenda' ? 'flex' : 'hidden lg:flex'}`}>
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 md:gap-3">
              <span className="material-symbols-outlined text-emerald-500 text-xl md:text-2xl">calendar_month</span>
              <h3 className="text-[10px] md:text-[11px] font-black uppercase tracking-[0.2em] md:tracking-[0.3em] text-white">Agenda</h3>
            </div>
            <div className="flex gap-2">
              <button className="bg-white/5 text-slate-400 p-1.5 md:p-2 rounded-xl hover:text-white transition-all"><span className="material-symbols-outlined text-base md:text-lg">filter_list</span></button>
              <button
                onClick={() => { resetForm(); setShowResModal(true); }}
                className="bg-emerald-500/10 text-emerald-500 px-3 md:px-4 py-1.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-widest border border-emerald-500/20 hover:bg-emerald-500 hover:text-white transition-all flex items-center gap-1"
              >
                <span className="material-symbols-outlined text-sm hidden sm:inline">add</span>
                Novo
              </button>
            </div>
          </div>

          <div className="lg:flex-1 lg:overflow-y-auto custom-scrollbar lg:pr-2 space-y-4">
            {reservations.map((res) => (
               <div key={res.id} className="bg-[#1c2229] border border-white/5 rounded-2xl md:rounded-[2rem] p-4 md:p-6 shadow-xl relative overflow-hidden group hover:border-emerald-500/30 transition-all mx-1">
                <div className={`absolute top-0 right-0 w-16 h-16 flex items-center justify-center opacity-5 group-hover:opacity-10 transition-opacity`}>
                  <span className="material-symbols-outlined text-6xl">event</span>
                </div>

                <div className="flex justify-between items-start mb-4">
                  <div>
                    <span className={`px-2 py-1 rounded-lg text-[8px] md:text-[9px] font-black uppercase border ${getReservationStatusColor(res.status)}`}>
                      {res.status}
                    </span>
                    <h4 className="text-lg md:text-xl font-black text-white mt-2 md:mt-3 line-clamp-1">{res.customer}</h4>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-[8px] md:text-[9px] font-black text-slate-500 uppercase tracking-widest">Horário</p>
                    <p className="text-lg md:text-xl font-black text-primary italic">{res.time}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 md:gap-4 mb-5 md:mb-6">
                  <div className="bg-black/20 p-2.5 md:p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                     <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase mb-0.5">Pessoas</p>
                     <p className="text-xs md:text-sm font-black text-white">{res.people} Convidados</p>
                  </div>
                  <div className="bg-black/20 p-2.5 md:p-3 rounded-xl border border-white/5 flex flex-col justify-center">
                     <p className="text-[7px] md:text-[8px] font-black text-slate-500 uppercase mb-0.5">Preferência</p>
                     <p className="text-xs md:text-sm font-black text-emerald-500 truncate">{res.tablePreference || 'Sem preferência'}</p>
                  </div>
                </div>

                {res.notes && (
                  <div className="p-2.5 md:p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl mb-5 md:mb-6">
                    <p className="text-[9px] md:text-[10px] font-medium text-amber-500/80 italic leading-snug">"{res.notes}"</p>
                  </div>
                )}

                <div className="flex gap-2">
                  <button
                    onClick={() => startEdit(res)}
                    className="flex-1 py-2.5 md:py-3 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-white/5 active:scale-[0.98]"
                  >
                    Editar
                  </button>
                  {res.status !== ReservationStatus.CONFIRMED && (
                    <button
                      onClick={() => updateReservation(res.id, { status: ReservationStatus.CONFIRMED })}
                      className="flex-1 py-2.5 md:py-3 bg-emerald-500/10 hover:bg-emerald-500 text-emerald-500 hover:text-white text-[9px] md:text-[10px] font-black uppercase tracking-widest rounded-xl transition-all border border-emerald-500/20 active:scale-[0.98]"
                    >
                      Confirmar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Configurações Section */}
        <div className={`flex-1 flex-col gap-4 min-w-0 ${activeTab === 'config' ? 'flex' : 'hidden lg:flex'}`}>
           <div className="flex items-center gap-2 px-2">
              <span className="material-symbols-outlined text-amber-500 text-2xl">settings</span>
              <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-white">Configurações de Reserva Pública</h3>
           </div>

           <div className="bg-[#161b22] border border-white/5 rounded-3xl p-6 space-y-8 overflow-y-auto custom-scrollbar">
              {/* Status Global */}
              <div className="flex items-center justify-between p-4 bg-black/20 rounded-2xl border border-white/5">
                <div>
                  <h4 className="font-black text-white">Status das Reservas Online</h4>
                  <p className="text-xs text-slate-500">Permitir que clientes façam reservas pelo link público.</p>
                </div>
                <button 
                  onClick={() => saveConfig({ ...config, active: !config.active })}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.active ? 'bg-emerald-500' : 'bg-slate-700'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${config.active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
              </div>

              {/* Horários e Vagas */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Horários Disponíveis (Slots)</h4>
                  <button 
                    onClick={() => { setNewSlotTime('19:00'); setNewSlotMax('20'); setShowSlotModal(true); }}
                    className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline"
                  >
                    + Adicionar
                  </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                  {(config.slots || []).map((slot, idx) => (
                    <div key={idx} className="bg-black/30 p-3 rounded-xl border border-white/5 flex justify-between items-center group">
                      <div>
                        <p className="text-lg font-black text-white">{slot.time}</p>
                        <p className="text-[10px] text-slate-500 uppercase font-bold">Máx: {slot.maxPeople} pess.</p>
                      </div>
                      <button 
                        onClick={() => saveConfig({ ...config, slots: config.slots.filter((_, i) => i !== idx) })}
                        className="text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <span className="material-symbols-outlined text-sm">delete</span>
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Datas Bloqueadas */}
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Datas de Bloqueio (Feriados/Eventos)</h4>
                  <button 
                    onClick={() => { setNewBlockDate(new Date().toISOString().split('T')[0]); setShowBlockModal(true); }}
                    className="text-primary text-[10px] font-black uppercase tracking-widest hover:underline"
                  >
                    + Bloquear Data
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {(config.blockedDates || []).map((date, idx) => (
                    <div key={idx} className="bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-lg flex items-center gap-2">
                       <span className="text-xs font-black text-rose-500">{date}</span>
                       <button onClick={() => saveConfig({ ...config, blockedDates: config.blockedDates.filter((_, i) => i !== idx) })}>
                          <span className="material-symbols-outlined text-[10px] text-rose-500">close</span>
                       </button>
                    </div>
                  ))}
                  {(!config.blockedDates || config.blockedDates.length === 0) && <p className="text-xs text-slate-600 italic">Nenhuma data bloqueada.</p>}
                </div>
              </div>

              {/* Link Público */}
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl">
                 <h4 className="text-[10px] font-black text-primary uppercase tracking-widest mb-1">Seu Link Público</h4>
                 <div className="flex gap-2">
                    <input readOnly value={`${window.location.origin}/reservar`} className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-xs text-slate-300 font-mono" />
                    <button 
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/reservar`);
                        alert('Link copiado!');
                      }}
                      className="bg-primary px-3 rounded-lg text-white"
                    >
                      <span className="material-symbols-outlined text-sm">content_copy</span>
                    </button>
                 </div>
              </div>
           </div>
        </div>
      </div>

      {/* Modal Nova Reserva/Edição */}
      {showResModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12161b] w-full max-w-md rounded-3xl border border-white/10 p-5 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg md:text-xl font-black text-white mb-5 md:mb-6 uppercase tracking-wider">{editingRes ? 'Editar Reserva' : 'Nova Reserva'}</h2>
            <form onSubmit={handleSaveReservation} className="space-y-3 md:space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Nome do Cliente</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ex: João Silva" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-600" required />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Telefone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 90000-0000" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-600" />
                </div>
                <div className="sm:w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Pessoas</label>
                  <input type="number" min="1" value={peopleCount} onChange={e => setPeopleCount(e.target.value)} placeholder="Qtd" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-600" required />
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Horário</label>
                  <input type="time" value={resTime} onChange={e => setResTime(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors" required />
                </div>
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Data</label>
                  <input type="text" value={resDate} onChange={e => setResDate(e.target.value)} placeholder="Ex: Hoje" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-600" required />
                </div>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Observações (Opcional)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Alergias, preferência de mesa, etc" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-emerald-500 outline-none transition-colors placeholder:text-slate-600" rows={2} />
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 md:gap-3 pt-4">
                <button type="button" onClick={() => setShowResModal(false)} className="flex-1 py-3.5 sm:py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3.5 sm:py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-emerald-500/20">Salvar Reserva</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Fila de Espera */}
      {showWaitModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12161b] w-full max-w-md rounded-3xl border border-white/10 p-5 md:p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg md:text-xl font-black text-white mb-5 md:mb-6 uppercase tracking-wider">Novo na Fila</h2>
            <form onSubmit={handleAddWaiting} className="space-y-3 md:space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Nome do Cliente</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Ex: Maria" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors placeholder:text-slate-600" required />
              </div>
              <div className="flex flex-col sm:flex-row gap-3 md:gap-4">
                <div className="flex-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Telefone</label>
                  <input value={phone} onChange={e => setPhone(e.target.value)} placeholder="(11) 90000-0000" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors placeholder:text-slate-600" />
                </div>
                <div className="sm:w-32">
                  <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Pessoas</label>
                  <input type="number" min="1" value={peopleCount} onChange={e => setPeopleCount(e.target.value)} placeholder="Qtd" className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors placeholder:text-slate-600" required />
                </div>
              </div>
              <div className="flex flex-col-reverse sm:flex-row gap-2 md:gap-3 pt-4">
                <button type="button" onClick={() => setShowWaitModal(false)} className="flex-1 py-3.5 sm:py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors">Cancelar</button>
                <button type="submit" className="flex-1 py-3.5 sm:py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors shadow-lg shadow-primary/20">Adicionar à Fila</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Adicionar Slot */}
      {showSlotModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12161b] w-full max-w-sm rounded-3xl border border-white/10 p-5 md:p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white mb-5 uppercase tracking-wider">Novo Horário</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Horário</label>
                <input type="time" value={newSlotTime} onChange={e => setNewSlotTime(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Capacidade (Pessoas)</label>
                <input type="number" min="1" value={newSlotMax} onChange={e => setNewSlotMax(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-primary outline-none transition-colors" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowSlotModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors">Cancelar</button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (newSlotTime && newSlotMax) {
                      saveConfig({ ...config, slots: [...(config.slots || []), { time: newSlotTime, maxPeople: parseInt(newSlotMax) }] });
                      setShowSlotModal(false);
                    }
                  }} 
                  className="flex-1 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Bloquear Data */}
      {showBlockModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#12161b] w-full max-w-sm rounded-3xl border border-white/10 p-5 md:p-6 shadow-2xl">
            <h2 className="text-lg font-black text-white mb-5 uppercase tracking-wider">Bloquear Data</h2>
            <div className="space-y-4">
              <div>
                <label className="text-[10px] font-bold text-slate-500 uppercase ml-1 mb-1 block">Data</label>
                <input type="date" value={newBlockDate} onChange={e => setNewBlockDate(e.target.value)} className="w-full bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white focus:border-rose-500 outline-none transition-colors" />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowBlockModal(false)} className="flex-1 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-sm font-bold transition-colors">Cancelar</button>
                <button 
                  type="button" 
                  onClick={() => {
                    if (newBlockDate) {
                      saveConfig({ ...config, blockedDates: [...(config.blockedDates || []), newBlockDate] });
                      setShowBlockModal(false);
                    }
                  }} 
                  className="flex-1 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl text-sm font-bold transition-colors"
                >
                  Bloquear
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReservationView;

