import React from 'react';

const CloudLockView: React.FC = () => {
  return (
    <div className="flex-1 h-full bg-[#0b1017] flex flex-col items-center justify-center p-6 text-center animate-in fade-in zoom-in duration-300">
      <div className="w-24 h-24 bg-rose-500/10 rounded-full flex items-center justify-center mb-6 border-2 border-rose-500/20 shadow-[0_0_50px_rgba(244,63,94,0.15)]">
        <span className="material-symbols-outlined text-5xl text-rose-500">cloud_off</span>
      </div>
      <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase mb-4">
        Modo Nuvem (Gestão)
      </h2>
      <p className="text-slate-400 font-bold max-w-md mx-auto text-sm leading-relaxed tracking-wider">
        Esta tela é exlclusiva para operação local no restaurante. Ela está bloqueada no acesso remoto via nuvem para garantir a integridade dos dados, como pedidos, PDV e caixa.
      </p>
      <p className="text-indigo-400 font-black uppercase tracking-widest text-[10px] mt-8 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20 inline-block">
        Volte para a Dashboard ou Logística
      </p>
    </div>
  );
};

export default CloudLockView;
