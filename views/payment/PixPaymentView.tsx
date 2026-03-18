import React, { useState, useEffect } from 'react';
import axios from 'axios';

interface PixPaymentViewProps {
    pedidoId: string;
    pixCode: string;
    qrCodeBase64: string;
    total: number;
    onPaymentConfirmed: () => void;
    onCancel: () => void;
}

const PixPaymentView: React.FC<PixPaymentViewProps> = ({ 
    pedidoId, 
    pixCode, 
    qrCodeBase64, 
    total, 
    onPaymentConfirmed, 
    onCancel 
}) => {
    const [copied, setCopied] = useState(false);
    const [isChecking, setIsChecking] = useState(false);

    // Polling para verificar se o pagamento foi confirmado via webhook (na vida real via API do banco)
    useEffect(() => {
        const interval = setInterval(async () => {
            try {
                // Aqui consultamos o status do pedido no backend
                // No nosso caso, o webhook vai atualizar o status no DB, então verificamos o status do pedido.
                const response = await axios.get(`http://localhost:3001/api/pedidos/${pedidoId}`);
                if (response.data && response.data.status === 'pago') {
                    onPaymentConfirmed();
                    clearInterval(interval);
                }
            } catch (error) {
                console.error("Erro ao verificar status do pagamento:", error);
            }
        }, 5000); // Verifica a cada 5 segundos

        return () => clearInterval(interval);
    }, [pedidoId, onPaymentConfirmed]);

    const copyToClipboard = () => {
        navigator.clipboard.writeText(pixCode);
        setCopied(true);
        setTimeout(() => setCopied(false), 3000);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center p-6 text-white text-center">
            <div className="w-full max-w-sm space-y-8 animate-in zoom-in-95 duration-300">
                
                {/* Header */}
                <div className="space-y-2">
                    <div className="size-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-primary/30">
                        <span className="material-symbols-outlined text-primary text-4xl">qr_code_2</span>
                    </div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter">Pagamento Pix</h2>
                    <p className="text-slate-400 text-sm">Escaneie o QR Code ou cole o código abaixo para finalizar seu pedido.</p>
                </div>

                {/* QR Code Card */}
                <div className="bg-white p-6 rounded-[2.5rem] shadow-2xl relative group overflow-hidden">
                    <img src={qrCodeBase64} alt="Pix QR Code" className="w-full aspect-square object-contain" />
                    <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center pointer-events-none">
                        <div className="size-12 rounded-full bg-primary/20 animate-ping"></div>
                    </div>
                </div>

                {/* Total */}
                <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex justify-between items-center">
                    <span className="text-xs font-black uppercase tracking-widest text-slate-500">Valor a Pagar:</span>
                    <span className="text-xl font-black italic">R$ {total.toFixed(2)}</span>
                </div>

                {/* Copia e Cola */}
                <div className="space-y-3">
                    <button 
                        onClick={copyToClipboard}
                        className={`w-full py-4 rounded-2xl font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${
                            copied ? 'bg-emerald-500 text-white' : 'bg-white text-black hover:bg-primary hover:text-white'
                        }`}
                    >
                        <span className="material-symbols-outlined text-sm">{copied ? 'check' : 'content_copy'}</span>
                        {copied ? 'Código Copiado!' : 'Copiar Código Pix'}
                    </button>
                    
                    {/* Botão para simular o pagamento (apenas para o usuário ver) */}
                    <p className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">
                        Aguardando confirmação automática...
                    </p>
                </div>

                {/* Footer / Cancel */}
                <button 
                    onClick={onCancel}
                    className="text-xs font-black uppercase tracking-widest text-slate-500 hover:text-rose-400 transition-colors"
                >
                    Cancelar e voltar ao carrinho
                </button>

            </div>
            
            {/* Notificação de Background (Push Simulation) */}
            <div className="fixed top-8 left-1/2 -translate-x-1/2 w-[90%] max-w-xs pointer-events-none">
                <div className="bg-indigo-600 rounded-2xl p-4 shadow-2xl border border-white/20 animate-bounce">
                    <div className="flex items-center gap-3">
                        <div className="size-10 bg-white/20 rounded-full flex items-center justify-center">
                            <span className="material-symbols-outlined text-white">notifications_active</span>
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase text-white/60">Simulação Webhook</p>
                            <p className="text-xs font-bold text-white leading-tight">Envie um POST para /api/webhook/pix com o status 'concluido' para testar!</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default PixPaymentView;
