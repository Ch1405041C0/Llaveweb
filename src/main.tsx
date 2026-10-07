import React, { useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { jsPDF } from 'jspdf';
import {
  LayoutDashboard,
  Inbox,
  Tags,
  Store,
  Package,
  ReceiptText,
  Settings,
  Plus,
  Search,
  Pencil,
  Image as ImageIcon,
  FileDown,
  CheckCircle2,
  Clock3,
  XCircle,
} from 'lucide-react';
import './styles.css';

type Status = 'Nueva' | 'Contactado' | 'Finalizada';
type Business = { id:number; name:string; category:string; phone:string; active:boolean };
type Product = { id:number; businessId:number; name:string; price:number; image:string; active:boolean };
type Request = { id:number; client:string; phone:string; productId:number; createdAt:string; status:Status };
type Operation = { id:number; requestId:number; total:number; createdAt:string; type:'Orden'|'Presupuesto'|'Recibo'|'Factura'; };

const initialBusinesses: Business[] = [
  { id: 1, name: 'Mueblería Demo', category: 'Hogar', phone: '11 5555-1111', active: true },
  { id: 2, name: 'Local de Ropa Demo', category: 'Indumentaria', phone: '11 5555-2222', active: true },
];

const initialProducts: Product[] = [
  { id: 1, businessId: 1, name: 'Sillón Nórdico', price: 320000, image: 'https://images.unsplash.com/photo-1555041469-a586c61ea9bc?auto=format&fit=crop&w=800&q=80', active: true },
  { id: 2, businessId: 2, name: 'Remera Oversize', price: 28000, image: 'https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?auto=format&fit=crop&w=800&q=80', active: true },
];

const initialRequests: Request[] = [
  { id: 1, client: 'Cliente de prueba', phone: '11 4444-9999', productId: 2, createdAt: '07/10/2026 13:10', status: 'Nueva' },
];

const money = (n:number) => new Intl.NumberFormat('es-AR', { style:'currency', currency:'ARS', maximumFractionDigits:0 }).format(n);

function App(){
  const [section,setSection]=useState('Dashboard');
  const [businesses,setBusinesses]=useState(initialBusinesses);
  const [products,setProducts]=useState(initialProducts);
  const [requests,setRequests]=useState(initialRequests);
  const [operations,setOperations]=useState<Operation[]>([]);
  const [query,setQuery]=useState('');

  const total = useMemo(()=>operations.reduce((a,b)=>a+b.total,0),[operations]);

  const addBusiness=()=>{
    const name=prompt('Nombre del negocio');
    if(!name) return;
    const category=prompt('Categoría','Indumentaria') || 'General';
    const phone=prompt('Teléfono / WhatsApp','') || '';
    setBusinesses(v=>[...v,{id:Date.now(),name,category,phone,active:true}]);
  };

  const addProduct=()=>{
    if(!businesses.length) return alert('Primero creá un negocio.');
    const businessName=prompt('Negocio',businesses[0].name);
    const business=businesses.find(b=>b.name.toLowerCase()===businessName?.toLowerCase()) || businesses[0];
    const name=prompt('Nombre del producto');
    if(!name) return;
    const price=Number(prompt('Precio','0')||0);
    const image=prompt('URL de imagen','') || 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?auto=format&fit=crop&w=800&q=80';
    setProducts(v=>[...v,{id:Date.now(),businessId:business.id,name,price,image,active:true}]);
  };

  const editProduct=(p:Product)=>{
    const name=prompt('Nombre',p.name) || p.name;
    const price=Number(prompt('Precio',String(p.price))||p.price);
    const image=prompt('URL de imagen',p.image) || p.image;
    setProducts(v=>v.map(x=>x.id===p.id?{...x,name,price,image}:x));
  };

  const updateRequest=(id:number,status:Status)=>setRequests(v=>v.map(r=>r.id===id?{...r,status}:r));

  const generateOperation=(r:Request)=>{
    const product=products.find(p=>p.id===r.productId);
    if(!product) return;
    const existing=operations.find(o=>o.requestId===r.id);
    if(existing) return downloadPdf(existing,r,product);
    const op:Operation={id:Date.now(),requestId:r.id,total:product.price,createdAt:new Date().toLocaleString('es-AR'),type:'Orden'};
    setOperations(v=>[...v,op]);
    downloadPdf(op,r,product);
  };

  const downloadPdf=(op:Operation,r:Request,p:Product)=>{
    const business=businesses.find(b=>b.id===p.businessId);
    const doc=new jsPDF();
    doc.setFontSize(20); doc.text('LLAVE 360',20,20);
    doc.setFontSize(12); doc.text(`${op.type} #LL-${String(op.id).slice(-6)}`,20,32);
    doc.text(`Fecha: ${op.createdAt}`,20,40);
    doc.text(`Cliente: ${r.client}`,20,52);
    doc.text(`Teléfono: ${r.phone}`,20,60);
    doc.text(`Negocio: ${business?.name || '-'}`,20,72);
    doc.text(`Producto: ${p.name}`,20,80);
    doc.text(`Total: ${money(op.total)}`,20,92);
    doc.text('Comprobante interno de Llave 360. No constituye factura fiscal.',20,112);
    doc.save(`llave360-${op.id}.pdf`);
  };

  const menu=[
    ['Dashboard',LayoutDashboard],['Solicitudes',Inbox],['Categorías',Tags],['Negocios',Store],['Productos',Package],['Facturación',ReceiptText],['Configuración',Settings]
  ] as const;

  const filteredProducts=products.filter(p=>p.name.toLowerCase().includes(query.toLowerCase()));

  return <div className="app">
    <aside>
      <div className="brand"><div className="logo">L360</div><div><strong>Llave 360</strong><span>Administración</span></div></div>
      <nav>{menu.map(([label,Icon])=><button key={label} className={section===label?'active':''} onClick={()=>setSection(label)}><Icon size={18}/>{label}</button>)}</nav>
      <div className="admin-card"><span>Usuario</span><strong>Administrador</strong><small>Sesión única</small></div>
    </aside>
    <main>
      <header><div><h1>{section}</h1><p>Panel central de gestión de Llave 360</p></div></header>

      {section==='Dashboard' && <>
        <section className="stats">
          <Stat title="Solicitudes nuevas" value={String(requests.filter(r=>r.status==='Nueva').length)} icon={<Inbox/>}/>
          <Stat title="Negocios activos" value={String(businesses.filter(b=>b.active).length)} icon={<Store/>}/>
          <Stat title="Productos" value={String(products.filter(p=>p.active).length)} icon={<Package/>}/>
          <Stat title="Operaciones" value={money(total)} icon={<ReceiptText/>}/>
        </section>
        <section className="panel"><h2>Actividad reciente</h2>{requests.map(r=><RequestRow key={r.id} r={r} products={products} onStatus={updateRequest} onPdf={generateOperation}/>)}</section>
      </>}

      {section==='Solicitudes' && <section className="panel"><div className="panel-head"><h2>Solicitudes recibidas</h2></div>{requests.map(r=><RequestRow key={r.id} r={r} products={products} onStatus={updateRequest} onPdf={generateOperation}/>)}</section>}

      {section==='Categorías' && <section className="panel"><h2>Categorías</h2><div className="chips">{[...new Set(businesses.map(b=>b.category))].map(c=><span key={c}>{c}</span>)}</div><p className="muted">Las categorías se generan dinámicamente desde los negocios. En la siguiente etapa podrán administrarse por separado.</p></section>}

      {section==='Negocios' && <section className="panel"><div className="panel-head"><h2>Negocios / proveedores</h2><button className="primary" onClick={addBusiness}><Plus size={16}/>Agregar negocio</button></div><div className="grid">{businesses.map(b=><article className="card" key={b.id}><Store/><h3>{b.name}</h3><p>{b.category}</p><small>{b.phone}</small><span className="status ok">Activo</span></article>)}</div></section>}

      {section==='Productos' && <section className="panel"><div className="panel-head"><h2>Productos</h2><div className="actions"><div className="search"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Buscar producto"/></div><button className="primary" onClick={addProduct}><Plus size={16}/>Agregar producto</button></div></div><div className="products">{filteredProducts.map(p=><article className="product" key={p.id}><img src={p.image}/><div><small>{businesses.find(b=>b.id===p.businessId)?.name}</small><h3>{p.name}</h3><strong>{money(p.price)}</strong></div><button onClick={()=>editProduct(p)}><Pencil size={16}/>Editar</button></article>)}</div></section>}

      {section==='Facturación' && <section className="panel"><div className="panel-head"><h2>Operaciones y comprobantes</h2></div>{operations.length===0?<p className="empty">Todavía no hay operaciones. Generá una desde una solicitud.</p>:operations.map(o=>{const r=requests.find(r=>r.id===o.requestId)!;const p=products.find(p=>p.id===r.productId)!;return <div className="invoice" key={o.id}><div><strong>LL-{String(o.id).slice(-6)}</strong><span>{o.type}</span></div><div>{r.client}</div><div>{p.name}</div><strong>{money(o.total)}</strong><button onClick={()=>downloadPdf(o,r,p)}><FileDown size={16}/>PDF</button></div>})}<p className="muted">La integración fiscal ARCA queda prevista para una etapa posterior. Los PDF actuales son comprobantes internos.</p></section>}

      {section==='Configuración' && <section className="panel"><h2>Configuración</h2><div className="settings"><label>Nombre comercial<input defaultValue="Llave 360"/></label><label>Usuario administrador<input defaultValue="Administrador"/></label><label>Prefijo de comprobantes<input defaultValue="LL"/></label></div></section>}
    </main>
  </div>
}

function Stat({title,value,icon}:{title:string,value:string,icon:React.ReactNode}){return <article className="stat"><div>{icon}</div><span>{title}</span><strong>{value}</strong></article>}

function RequestRow({r,products,onStatus,onPdf}:{r:Request,products:Product[],onStatus:(id:number,s:Status)=>void,onPdf:(r:Request)=>void}){
  const p=products.find(p=>p.id===r.productId);
  return <div className="request"><div><strong>{r.client}</strong><span>{r.phone}</span></div><div><strong>{p?.name}</strong><span>{r.createdAt}</span></div><StatusBadge status={r.status}/><select value={r.status} onChange={e=>onStatus(r.id,e.target.value as Status)}><option>Nueva</option><option>Contactado</option><option>Finalizada</option></select><button onClick={()=>onPdf(r)}><FileDown size={16}/>Comprobante</button></div>
}

function StatusBadge({status}:{status:Status}){const Icon=status==='Nueva'?Clock3:status==='Contactado'?CheckCircle2:XCircle;return <span className={`status ${status.toLowerCase()}`}><Icon size={14}/>{status}</span>}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
