import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyValue, formatUsd } from '../../shared/calculations';
import type { CompanySettingsDTO, PaymentDTO, RentalDTO } from '../../shared/types';

function addCompanyHeader(
  doc: jsPDF,
  settings: Partial<CompanySettingsDTO> | null,
  title: string,
  subtitle?: string
): number {
  const companyName = settings?.companyName || 'MSh Company';
  const websiteName = settings?.websiteName || 'Jeeg iyo Kabaleeti';
  const phone = settings?.phone || '';
  const address = settings?.address || '';

  doc.setFillColor(23, 43, 66); // Deep Navy #172B42
  doc.rect(0, 0, 210, 32, 'F');

  let textX = 14;
  if (settings?.logoDataUrl && (settings.logoDataUrl.startsWith('data:image/png') || settings.logoDataUrl.startsWith('data:image/jpeg'))) {
    try {
      const fmt = settings.logoDataUrl.startsWith('data:image/png') ? 'PNG' : 'JPEG';
      doc.addImage(settings.logoDataUrl, fmt, 14, 5, 22, 22);
      textX = 40;
    } catch {
      textX = 14;
    }
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(15);
  doc.setFont('helvetica', 'bold');
  doc.text(`${companyName} — ${websiteName}`, textX, 14);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const contactLine = [phone, address, settings?.email].filter(Boolean).join('  ·  ');
  if (contactLine) {
    doc.text(contactLine, textX, 22);
  }

  doc.setTextColor(32, 43, 56);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text(title, 14, 44);

  if (subtitle) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, 14, 50);
    return 56;
  }

  return 50;
}

export function exportRentalReceiptPdf(
  rental: RentalDTO,
  settings: Partial<CompanySettingsDTO> | null,
  titleLabel: string
): void {
  const doc = new jsPDF();
  const startY = addCompanyHeader(
    doc,
    settings,
    `${titleLabel} (${rental.rentalId})`,
    `Date: ${rental.startDate}  ·  Recorded by: ${rental.createdByName}`
  );

  autoTable(doc, {
    startY,
    head: [['Field', 'Details']],
    body: [
      ['Rental ID', rental.rentalId],
      ['Customer Name', rental.customerName],
      ['Phone', rental.customerPhone],
      ['Site Location', rental.siteLocation],
      ['Transport Vehicle', `${rental.vehicleType}${rental.vehiclePlate ? ` (${rental.vehiclePlate})` : ''}`],
      ['Equipment', `${rental.productCategory} — ${rental.inventoryName} (${rental.inventoryProductId})`],
      ['Quantity Rented', `${rental.quantityRented} pcs`],
      ['Returned / Damaged / Lost', `${rental.quantityReturned} / ${rental.quantityDamaged} / ${rental.quantityLost}`],
      ['Remaining Outstanding', `${rental.quantityRemaining} pcs`],
      ['Start Date', rental.startDate],
      ['Expected Return Date', rental.expectedReturnDate || 'Open / Not Specified'],
      ['Pricing Method', rental.pricingMethod],
      ['Rate / Contract Price', formatCurrencyValue(rental.unitOrContractPrice, rental.currency)],
      ['Billing Days', String(rental.rentalDays)],
      ['Exchange Rate Snapshot', `1 USD = ${rental.exchangeRateSnapshot} SOS`],
      ['Original Total', formatCurrencyValue(rental.originalAmount, rental.currency)],
      ['Primary USD Total', formatUsd(rental.usdAmount)],
      ['Status', rental.status],
    ],
    theme: 'grid',
    headStyles: { fillColor: [36, 91, 145] },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`${rental.rentalId}_Receipt.pdf`);
}

export function exportPaymentReceiptPdf(
  payment: PaymentDTO,
  settings: Partial<CompanySettingsDTO> | null,
  titleLabel: string
): void {
  const doc = new jsPDF();
  const startY = addCompanyHeader(
    doc,
    settings,
    `${titleLabel} (${payment.paymentId})`,
    `Payment Date: ${payment.paymentDate}  ·  Recorded by: ${payment.createdByName}`
  );

  autoTable(doc, {
    startY,
    head: [['Field', 'Details']],
    body: [
      ['Payment ID', payment.paymentId],
      ['Customer', payment.customerName],
      ['Related Rental', payment.rentalCode || 'General Account Payment'],
      ['Amount Paid', formatCurrencyValue(payment.amount, payment.currency)],
      ['Exchange Rate Snapshot', `1 USD = ${payment.exchangeRateSnapshot} SOS`],
      ['USD Equivalent', formatUsd(payment.usdAmount)],
      ['Payment Method', payment.paymentMethod],
      ['Reference Number', payment.referenceNumber || '-'],
      ['Notes', payment.notes || '-'],
    ],
    theme: 'grid',
    headStyles: { fillColor: [35, 134, 83] },
    styles: { fontSize: 9, cellPadding: 3 },
  });

  doc.save(`${payment.paymentId}_Receipt.pdf`);
}

export function exportTableReportPdf(params: {
  title: string;
  subtitle: string;
  columns: string[];
  rows: (string | number)[][];
  settings: Partial<CompanySettingsDTO> | null;
  filename: string;
}): void {
  const doc = new jsPDF({ orientation: params.columns.length > 6 ? 'landscape' : 'portrait' });
  const startY = addCompanyHeader(doc, params.settings, params.title, params.subtitle);

  autoTable(doc, {
    startY,
    head: [params.columns],
    body: params.rows,
    theme: 'striped',
    headStyles: { fillColor: [23, 43, 66] },
    styles: { fontSize: 8.5, cellPadding: 2.5 },
  });

  doc.save(params.filename);
}
