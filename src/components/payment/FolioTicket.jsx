import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer, X } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const folioTypeLabel = {
  level_advance: 'Avance de Nivel',
  time_unlock: 'Desbloqueo por Tiempo',
  extraordinary_test: 'Prueba Extraordinaria',
};

export default function FolioTicket({ payment, open, onClose }) {
  const ticketRef = useRef(null);

  const handlePrint = () => {
    const content = ticketRef.current?.innerHTML;
    const win = window.open('', '_blank', 'width=400,height=600');
    win.document.write(`
      <html>
        <head>
          <title>PREPARATORIA MONTES DE OCA</title>
          <style>
            body { font-family: 'Courier New', monospace; padding: 24px; color: #111; }
            .ticket { max-width: 340px; margin: 0 auto; border: 2px dashed #999; padding: 20px; }
            .title { text-align: center; font-size: 18px; font-weight: bold; margin-bottom: 4px; }
            .subtitle { text-align: center; font-size: 12px; color: #555; margin-bottom: 16px; }
            .divider { border-top: 1px dashed #999; margin: 12px 0; }
            .row { display: flex; justify-content: space-between; margin: 6px 0; font-size: 13px; }
            .label { color: #555; }
            .value { font-weight: bold; }
            .folio-box { text-align: center; background: #f3f4f6; border: 1px solid #d1d5db; border-radius: 6px; padding: 10px; margin: 12px 0; font-size: 20px; letter-spacing: 2px; font-weight: bold; }
            .footer { text-align: center; font-size: 11px; color: #888; margin-top: 16px; }
          </style>
        </head>
        <body>
          ${content}
        </body>
      </html>
    `);
    win.document.close();
    win.focus();
    win.print();
    win.close();
  };

  if (!payment) return null;

  const fecha = payment.created_date
    ? format(new Date(payment.created_date), "d 'de' MMMM yyyy", { locale: es })
    : '—';

  const nivel = payment.folio_type === 'extraordinary_test'
    ? 'General (todos los niveles)'
    : `Nivel ${payment.level}`;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Ticket de Folio</DialogTitle>
        </DialogHeader>

        {/* Ticket visual */}
        <div
          ref={ticketRef}
          className="border-2 border-dashed border-gray-300 rounded-lg p-5 font-mono text-sm space-y-1 bg-white"
        >
          <div className="title text-center text-base font-bold">PREPARATORIA MONTES DE OCA</div>
          <div className="subtitle text-center text-xs text-gray-500 mb-2">Comprobante de Folio de Pago</div>
          <div className="divider border-t border-dashed border-gray-300 my-2" />

          <div className="folio-box text-center bg-gray-100 border border-gray-300 rounded p-2 text-xl font-bold tracking-widest my-2">
            {payment.folio}
          </div>

          <div className="divider border-t border-dashed border-gray-300 my-2" />

          <div className="flex justify-between">
            <span className="text-gray-500">Alumno:</span>
            <span className="font-semibold text-right max-w-[180px] truncate">{payment.student_name || '—'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Tipo:</span>
            <span className="font-semibold">{folioTypeLabel[payment.folio_type] || payment.folio_type}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Nivel:</span>
            <span className="font-semibold">{nivel}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Fecha:</span>
            <span className="font-semibold">{fecha}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-500">Estado:</span>
            <span className="font-semibold">{payment.status === 'available' ? 'Disponible' : payment.status === 'used' ? 'Usado' : 'Expirado'}</span>
          </div>

          <div className="divider border-t border-dashed border-gray-300 my-2" />
          <div className="footer text-center text-xs text-gray-400 mt-2">
            Este folio es válido únicamente para el alumno asignado.
          </div>
        </div>

        <div className="flex gap-2 mt-2">
          <Button variant="outline" className="flex-1" onClick={onClose}>
            <X className="w-4 h-4 mr-2" /> Cerrar
          </Button>
          <Button className="flex-1" onClick={handlePrint}>
            <Printer className="w-4 h-4 mr-2" /> Imprimir
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}