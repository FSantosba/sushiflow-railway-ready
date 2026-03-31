/**
 * ServerConfig — Painel de Configuração do Servidor e Impressoras
 * Acessível pelo Admin em: Admin → Impressoras
 */
import React, { useState, useEffect } from 'react';
import { useServer } from '../../context/ServerContext';

type PrinterKey = 'KITCHEN' | 'BAR';

const BRANDS = ['EPSON', 'BEMATECH', 'ELGIN', 'DARUMA', 'STAR', 'GENERIC'];
const WIDTHS  = [{ label: '80mm (48 colunas)', value: '48' }, { label: '58mm (32 colunas)', value: '32' }];

const ServerConfig: React.FC = () => {
  const { serverUrl, setServerUrl, isOnline, serverConfig, updateServerConfig, printTest, pingServer } = useServer();

  const [localUrl, setLocalUrl]       = useState(serverUrl);
  const [restaurantName, setRestaurantName] = useState('');
  const [printWidth, setPrintWidth]   = useState('48');
  const [pinging, setPinging]         = useState(false);
  const [feedback, setFeedback]       = useState<{ msg: string; ok: boolean } | null>(null);
  const [printing, setPrinting]       = useState<PrinterKey | null>(null);
  const [saving, setSaving]           = useState(false);

  // Printers state
  const [kitchenType, setKitchenType]       = useState('EPSON');
  const [kitchenMode, setKitchenMode]       = useState<'usb' | 'network'>('usb');
  const [kitchenInterface, setKitchenInterface] = useState('auto');
  const [barType, setBarType]               = useState('EPSON');
  const [barMode, setBarMode]               = useState<'usb' | 'network'>('network');
  const [barInterface, setBarInterface]     = useState('192.168.1.100:9100');

  // Sincronizar com config recebida do servidor
  useEffect(() => {
    if (!serverConfig || Object.keys(serverConfig).length === 0) return;
    setRestaurantName(serverConfig.RESTAURANT_NAME || '');
    setPrintWidth(serverConfig.PRINT_WIDTH || '48');
    setKitchenType(serverConfig.PRINTER_KITCHEN_TYPE || 'EPSON');
    setKitchenMode((serverConfig.PRINTER_KITCHEN_MODE as 'usb' | 'network') || 'usb');
    setKitchenInterface(serverConfig.PRINTER_KITCHEN_INTERFACE || 'auto');
    setBarType(serverConfig.PRINTER_BAR_TYPE || 'EPSON');
    setBarMode((serverConfig.PRINTER_BAR_MODE as 'usb' | 'network') || 'network');
    setBarInterface(serverConfig.PRINTER_BAR_INTERFACE || '192.168.1.100:9100');
  }, [serverConfig]);

  const showFeedback = (msg: string, ok: boolean) => {
    setFeedback({ msg, ok });
    setTimeout(() => setFeedback(null), 4000);
  };

  const handlePing = async () => {
    setPinging(true);
    setServerUrl(localUrl);
    const ok = await pingServer();
    setPinging(false);
    showFeedback(ok ? '✅ Servidor online e respondendo!' : '❌ Servidor não respondeu. Verifique o IP e porta.', ok);
  };

  const handleSave = async () => {
    setSaving(true);
    const ok = await updateServerConfig({
      RESTAURANT_NAME: restaurantName,
      PRINT_WIDTH: printWidth,
      PRINTER_KITCHEN_TYPE: kitchenType,
      PRINTER_KITCHEN_MODE: kitchenMode,
      PRINTER_KITCHEN_INTERFACE: kitchenInterface,
      PRINTER_BAR_TYPE: barType,
      PRINTER_BAR_MODE: barMode,
      PRINTER_BAR_INTERFACE: barInterface,
    });
    setSaving(false);
    showFeedback(ok ? '✅ Configurações salvas no servidor!' : '❌ Falha ao salvar. Servidor offline?', ok);
  };

  const handlePrintTest = async (key: PrinterKey) => {
    setPrinting(key);
    const result = await printTest(key);
    setPrinting(null);
    showFeedback(result.ok ? `✅ Página de teste impressa em ${key}!` : `❌ Erro ao imprimir: ${result.error}`, result.ok);
  };

  const interfacePlaceholder = (mode: 'usb' | 'network') =>
    mode === 'network' ? '192.168.1.50:9100' : 'auto  (ou ex: //localhost/NomeImpressora)';

  return (
    <div className="h-full overflow-y-auto bg-[#0b1017] p-6 space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-black italic text-white tracking-tighter">CONFIGURAÇÃO DO SERVIDOR</h1>
        <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Servidor local, banco de dados e impressoras térmicas</p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`p-4 rounded-2xl font-bold text-sm border-2 ${feedback.ok ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-rose-500/10 border-rose-500/30 text-rose-400'}`}>
          {feedback.msg}
        </div>
      )}

      {/* Status do Servidor */}
      <section className="bg-[#11161d] border border-white/5 rounded-3xl p-6 space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-white uppercase tracking-wider">Servidor Local</h2>
          <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-black uppercase ${isOnline ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'}`}>
            <span className={`size-2 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {isOnline ? 'Online' : 'Offline'}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">IP do Servidor (PC do Caixa)</label>
          <div className="flex gap-3">
            <input
              type="text"
              value={localUrl}
              onChange={e => setLocalUrl(e.target.value)}
              placeholder="http://192.168.1.10:3001"
              className="flex-1 px-4 py-3 bg-black/50 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all font-mono text-sm"
            />
            <button
              onClick={handlePing}
              disabled={pinging}
              className="px-6 py-3 bg-indigo-600 text-white rounded-2xl text-sm font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              {pinging ? <div className="size-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <span className="material-symbols-outlined text-lg">wifi_tethering</span>}
              Testar
            </button>
          </div>
          <p className="text-xs text-slate-600">
            Inicie o servidor no PC do caixa com <code className="text-indigo-400">server/start.bat</code>, depois insira o IP local aqui.
          </p>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Nome do Restaurante (aparece na comanda)</label>
          <input
            type="text"
            value={restaurantName}
            onChange={e => setRestaurantName(e.target.value)}
            placeholder="Ex: Sushi Yamamoto"
            className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all font-bold text-sm"
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Largura da Bobina</label>
          <div className="flex gap-3">
            {WIDTHS.map(w => (
              <button
                key={w.value}
                onClick={() => setPrintWidth(w.value)}
                className={`flex-1 py-3 rounded-2xl text-sm font-black uppercase transition-all border-2 ${printWidth === w.value ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Impressoras */}
      {([
        { key: 'KITCHEN' as PrinterKey, label: '🍳 Impressora da Cozinha (Produção)',
          type: kitchenType, setType: setKitchenType,
          mode: kitchenMode, setMode: setKitchenMode,
          iface: kitchenInterface, setIface: setKitchenInterface,
        },
        { key: 'BAR' as PrinterKey, label: '🍹 Impressora do Bar',
          type: barType, setType: setBarType,
          mode: barMode, setMode: setBarMode,
          iface: barInterface, setIface: setBarInterface,
        },
      ] as const).map(printer => (
        <section key={printer.key} className="bg-[#11161d] border border-white/5 rounded-3xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-black text-white">{printer.label}</h2>
            <button
              onClick={() => handlePrintTest(printer.key)}
              disabled={!isOnline || printing === printer.key}
              className="px-4 py-2 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-xl text-xs font-black uppercase tracking-widest active:scale-95 transition-all flex items-center gap-2 disabled:opacity-40"
            >
              {printing === printer.key
                ? <div className="size-4 border-2 border-amber-400/30 border-t-amber-400 rounded-full animate-spin" />
                : <span className="material-symbols-outlined text-sm">print</span>
              }
              Imprimir Teste
            </button>
          </div>

          {/* Marca */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Marca / Protocolo</label>
            <div className="flex flex-wrap gap-2">
              {BRANDS.map(b => (
                <button
                  key={b}
                  onClick={() => printer.setType(b)}
                  className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest border-2 transition-all ${printer.type === b ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}
                >
                  {b}
                </button>
              ))}
            </div>
          </div>

          {/* Modo */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">Modo de Conexão</label>
            <div className="flex gap-3">
              {(['usb', 'network'] as const).map(m => (
                <button
                  key={m}
                  onClick={() => {
                    printer.setMode(m);
                    printer.setIface(m === 'usb' ? 'auto' : '192.168.1.100:9100');
                  }}
                  className={`flex-1 py-3 rounded-2xl text-sm font-black uppercase tracking-widest border-2 transition-all flex items-center justify-center gap-2 ${printer.mode === m ? 'bg-indigo-600 border-indigo-500 text-white' : 'bg-white/5 border-white/5 text-slate-400'}`}
                >
                  <span className="material-symbols-outlined text-lg">{m === 'usb' ? 'usb' : 'wifi'}</span>
                  {m === 'usb' ? 'USB' : 'Rede (IP)'}
                </button>
              ))}
            </div>
          </div>

          {/* Interface */}
          <div className="space-y-2">
            <label className="text-xs font-black text-slate-400 uppercase tracking-widest">
              {printer.mode === 'usb' ? 'Nome do Driver Windows' : 'IP:Porta da Impressora'}
            </label>
            <input
              type="text"
              value={printer.iface}
              onChange={e => printer.setIface(e.target.value)}
              placeholder={interfacePlaceholder(printer.mode)}
              className="w-full px-4 py-3 bg-black/50 border border-white/10 rounded-2xl text-white outline-none focus:border-indigo-500 transition-all font-mono text-sm"
            />
            <p className="text-xs text-slate-600">
              {printer.mode === 'usb'
                ? 'Use "auto" para detecção automática (Epson TM-T20 USB no Windows). Ou informe o nome exato da impressora no Painel de Controle.'
                : 'Formato: 192.168.1.50:9100 — A porta padrão ESC/POS é 9100.'}
            </p>
          </div>
        </section>
      ))}

      {/* Botão Salvar */}
      <button
        onClick={handleSave}
        disabled={!isOnline || saving}
        className="w-full h-16 bg-indigo-600 text-white rounded-[1.5rem] text-base font-black uppercase tracking-widest active:scale-[0.98] transition-all shadow-xl shadow-indigo-600/20 flex items-center justify-center gap-3 disabled:opacity-50"
      >
        {saving
          ? <div className="size-6 border-4 border-white/30 border-t-white rounded-full animate-spin" />
          : <><span className="material-symbols-outlined text-2xl">save</span> Salvar Configurações no Servidor</>
        }
      </button>

      <p className="text-center text-xs text-slate-700 pb-6">
        As configurações são salvas no banco de dados local do servidor e persistem mesmo após reinicialização.
      </p>
    </div>
  );
};

export default ServerConfig;
