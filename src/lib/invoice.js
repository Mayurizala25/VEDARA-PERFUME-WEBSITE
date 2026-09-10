import { jsPDF } from 'jspdf';
import { formatDate, formatPrice } from './format';

export const ORDER_STATUSES = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];

export function statusLabel(status = '') {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export function orderItems(order) {
  return order?.order_items || order?.items || [];
}

export function orderAddress(order) {
  return order?.shipping_address || {};
}

export function orderImage(item) {
  const images = item?.product?.product_images || [];
  return images.find((image) => image.is_primary)?.url || images[0]?.url || '';
}

export function addressLines(order) {
  const address = orderAddress(order);
  return [
    address.address,
    [address.city, address.state, address.pincode].filter(Boolean).join(', '),
    address.country,
  ].filter(Boolean);
}

// jsPDF's built-in fonts do not contain the rupee glyph. Use an explicit
// currency code in generated PDFs so amounts never render as broken symbols.
function pdfPrice(value) {
  return `INR ${(Number(value) || 0).toLocaleString('en-IN')}`;
}

function imageData(url) {
  if (!url) return Promise.resolve(null);
  return fetch(url)
    .then((response) => response.blob())
    .then((blob) => new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve({ data: reader.result, type: blob.type.includes('png') ? 'PNG' : 'JPEG' });
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    }))
    .catch(() => null);
}

export async function makeInvoicePdf(order) {
  if (!order) throw new Error('Invoice data is unavailable.');
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' });
  const margin = 16;
  const pageWidth = 210;
  const items = orderItems(order);
  const address = addressLines(order);
  let y = 18;

  pdf.setTextColor(66, 18, 31);
  pdf.setFont('times', 'bold');
  pdf.setFontSize(25);
  pdf.text('VEDARA', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(105, 98, 88);
  pdf.text('WEAR YOUR ESSENCE.', margin, y + 6);
  pdf.setFontSize(18);
  pdf.setTextColor(66, 18, 31);
  pdf.text('INVOICE', pageWidth - margin, y + 1, { align: 'right' });

  y += 22;
  pdf.setDrawColor(185, 133, 124);
  pdf.line(margin, y, pageWidth - margin, y);
  y += 9;
  pdf.setFontSize(8);
  pdf.setTextColor(105, 98, 88);
  pdf.text(`Invoice date  ${formatDate(order.created_at)}`, pageWidth - margin, y, { align: 'right' });
  pdf.text(`Order  ${order.order_number || order.id}`, pageWidth - margin, y + 5, { align: 'right' });

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(43, 38, 32);
  pdf.text('BILLED TO', margin, y);
  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(105, 98, 88);
  y += 5;
  for (const line of [order.customer_name, order.email, order.phone, ...address].filter(Boolean)) {
    pdf.text(String(line), margin, y);
    y += 4;
  }

  y += 7;
  const columns = { image: margin, product: margin + 14, size: 103, quantity: 128, unit: 150, line: 193 };
  pdf.setFillColor(239, 225, 206);
  pdf.rect(margin, y - 5, pageWidth - margin * 2, 8, 'F');
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(66, 18, 31);
  pdf.text('ITEM', columns.product, y);
  pdf.text('SIZE', columns.size, y);
  pdf.text('QTY', columns.quantity, y);
  pdf.text('UNIT', columns.unit, y, { align: 'right' });
  pdf.text('AMOUNT', columns.line, y, { align: 'right' });
  y += 9;

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(43, 38, 32);
  for (const item of items) {
    if (y > 260) { pdf.addPage(); y = 20; }
    const image = await imageData(orderImage(item));
    if (image) pdf.addImage(image.data, image.type, columns.image, y - 5, 9, 11);
    pdf.text(String(item.name || item.product?.name || 'VEDARA fragrance'), columns.product, y);
    pdf.setTextColor(105, 98, 88);
    pdf.text(String(item.size || '-'), columns.size, y);
    pdf.text(String(item.quantity || 0), columns.quantity, y);
    pdf.text(pdfPrice(Number(item.unit_price) || 0), columns.unit, y, { align: 'right' });
    pdf.setTextColor(43, 38, 32);
    pdf.text(pdfPrice((Number(item.unit_price) || 0) * (Number(item.quantity) || 0)), columns.line, y, { align: 'right' });
    pdf.setDrawColor(229, 219, 205);
    pdf.line(margin, y + 5, pageWidth - margin, y + 5);
    y += 16;
  }

  y += 4;
  const totals = [
    ['Subtotal', pdfPrice(order.subtotal)],
    ['Discount', order.discount ? `- ${pdfPrice(order.discount)}` : pdfPrice(0)],
    ['Shipping', order.shipping ? pdfPrice(order.shipping) : 'Complimentary'],
  ];
  pdf.setFontSize(9);
  for (const [label, value] of totals) {
    pdf.setTextColor(105, 98, 88);
    pdf.text(label, 135, y);
    pdf.setTextColor(43, 38, 32);
    pdf.text(value, pageWidth - margin, y, { align: 'right' });
    y += 6;
  }
  pdf.setDrawColor(66, 18, 31);
  pdf.line(135, y - 2, pageWidth - margin, y - 2);
  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(66, 18, 31);
  pdf.text('GRAND TOTAL', 135, y + 5);
  pdf.text(pdfPrice(order.total), pageWidth - margin, y + 5, { align: 'right' });

  y += 22;
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(8);
  pdf.setTextColor(105, 98, 88);
  pdf.text(`Payment status: Recorded (${statusLabel(order.status)})`, margin, y);
  if (order.notes) pdf.text(`Order notes: ${String(order.notes).slice(0, 100)}`, margin, y + 5);
  pdf.setFont('times', 'italic');
  pdf.setFontSize(12);
  pdf.setTextColor(66, 18, 31);
  pdf.text('Thank you for choosing VEDARA.', margin, 278);
  return pdf;
}

export function invoiceHtml(order) {
  const address = orderAddress(order);
  const items = orderItems(order);
  const rows = items.map((item) => `<tr>
      <td><span class="product"><span class="thumb"><img src="${orderImage(item) || '/images/product.jpg'}" alt="" /></span><span>${String(item.name || item.product?.name || 'VEDARA fragrance')}</span></span></td>
      <td>${item.size || '—'}</td>
      <td>${item.quantity || 0}</td>
      <td>${formatPrice(Number(item.unit_price) || 0)}</td>
      <td>${formatPrice((Number(item.unit_price) || 0) * (Number(item.quantity) || 0))}</td>
    </tr>`).join('');
  const shipping = order.shipping ? formatPrice(order.shipping) : 'Complimentary';
  const addressLine = [address.address, [address.city, address.state, address.pincode].filter(Boolean).join(', '), address.country].filter(Boolean).join(', ');
  return `<html><head><title>VEDARA Invoice</title><style>
    :root { --color-primary:#1C0B1; --color-cherry:#721D35; --color-accent:#B9857C; --color-muted:#756b62; --color-line:#E5DCCD; --color-secondary:#F8F4EE; --font-heading:'Cormorant Garamond','Times New Roman',serif; --font-body:'Manrope','Helvetica Neue',Arial,sans-serif; }
    body { margin:0; padding:24px; color:var(--color-primary); background:#fffaf7; font-family:var(--font-body); }
    .invoice { max-width:760px; margin:0 auto; background:#fffdfb; border:1px solid var(--color-line); padding:32px; }
    .invoiceHead { display:flex; justify-content:space-between; align-items:flex-end; border-bottom:1px solid var(--color-accent); padding-bottom:18px; }
    .invoiceBrand strong { display:block; color:var(--color-cherry); font-family:var(--font-heading); font-size:2rem; letter-spacing:.12em; }
    .invoiceBrand span { color:var(--color-muted); font-size:.72rem; text-transform:uppercase; }
    .invoiceTitle { text-align:right; color:var(--color-cherry); font-family:var(--font-heading); font-size:1.8rem; }
    .invoiceMeta { display:flex; justify-content:space-between; gap:24px; margin-top:22px; }
    .invoiceMeta b { font-size:.72rem; letter-spacing:.12em; text-transform:uppercase; color:var(--color-muted); }
    .invoiceMeta p { margin:6px 0 0; color:var(--color-muted); line-height:1.5; }
    .invoiceAddress { margin-top:12px; padding-bottom:14px; border-bottom:1px solid var(--color-line); color:var(--color-muted); line-height:1.4; }
    table { width:100%; border-collapse:collapse; margin-top:14px; font-size:.82rem; }
    th { padding:.65rem .35rem; color:var(--color-muted); font-size:.72rem; text-transform:uppercase; letter-spacing:.12em; text-align:left; border-bottom:1px solid var(--color-line); }
    td { padding:.75rem .35rem; border-top:1px solid var(--color-line); }
    th:not(:first-child), td:not(:first-child) { text-align:right; }
    .product { display:flex; align-items:center; gap:.6rem; }
    .product img { width:2rem; height:2.5rem; object-fit:cover; }
    .totals { max-width:260px; margin:16px 0 0 auto; width:100%; display:grid; grid-template-columns: 1fr auto; gap:.55rem .9rem; font-size:.82rem; }
    .totals dt { color:var(--color-muted); }
    .totals dd { text-align:right; }
    .grand { border-top:1px solid var(--color-line); font-weight:700; color:var(--color-primary); }
    .invoiceFoot { margin-top:20px; padding-top:12px; border-top:1px solid var(--color-line); display:flex; justify-content:space-between; gap:22px; color:var(--color-muted); font-size:.72rem; }
    @media print { body { background:#fff; } .invoice { border:0; box-shadow:none; } }
  </style></head><body><article class="invoice" id="invoice"><header class="invoiceHead"><div class="invoiceBrand"><strong>VEDARA</strong><span>Wear Your Essence.</span></div><div class="invoiceTitle"><span>Invoice</span><small>${order.order_number || order.id}</small></div></header><section class="invoiceMeta"><div><b>Bill to</b><p>${order.customer_name || address.fullName || 'VEDARA customer'}<br />${order.email}<br />${order.phone || address.phone || ''}</p></div><div><b>Invoice date</b><p>${formatDate(order.created_at)}<br />Order ${order.order_number || order.id}</p></div></section><section class="invoiceAddress"><b>Shipping address</b><p>${addressLine || 'Address not stored'}</p></section><table><thead><tr><th>Product</th><th>Size</th><th>Qty</th><th>Unit price</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table><dl class="totals"><dt>Subtotal</dt><dd>${formatPrice(order.subtotal || 0)}</dd><dt>Discount</dt><dd>${order.discount ? `-${formatPrice(order.discount)}` : formatPrice(0)}</dd><dt>Shipping</dt><dd>${shipping}</dd><dt class="grand">Grand total</dt><dd class="grand">${formatPrice(order.total || 0)}</dd></dl><footer class="invoiceFoot"><span>Payment status: Recorded</span><span>Order status: ${statusLabel(order.status)}</span><span>Thank you for choosing VEDARA.</span></footer></article></body></html>`;
}

export async function downloadInvoice(order) {
  if (!order) throw new Error('Invoice data is unavailable.');
  const pdf = await makeInvoicePdf(order);
  pdf.save(`VEDARA-${order.order_number || order.id}.pdf`);
}

export function printInvoice(order) {
  if (!order) throw new Error('Invoice data is unavailable.');
  const html = invoiceHtml(order);
  const win = window.open('', '_blank', 'width=900,height=780');
  if (!win) throw new Error('Unable to open the invoice printer window.');
  win.document.open();
  win.document.write(html);
  win.document.close();
  win.focus();
  win.setTimeout(() => win.print(), 250);
}
