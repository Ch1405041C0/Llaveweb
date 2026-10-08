import React,{useEffect,useMemo,useState}from'react';
import{createRoot}from'react-dom/client';
import{jsPDF}from'jspdf';
import{LayoutDashboard,Inbox,Store,Package,ReceiptText,Settings,Plus,Search,Pencil,FileDown,CheckCircle2,Clock3,XCircle,LogOut}from'lucide-react';
import{ProductEditor,type Product,type Business}from'./ProductEditor';
import{BusinessEditor}from'./BusinessEditor';
import{Login}from'./Login';
import{supabase}from'./supabase';
import{loadBusinesses,loadProducts,loadRequests,updateRequestStatus,saveBusinessDb,saveProductDb}from'./db';
import'./styles.css';

type Status='Nueva'|'Contactado'|'Finalizada';

type Request={
  id:number;
  client:string;
  phone:string;
  productId:number;
  createdAt:string;
  status:Status
};

type Operation={
  id:number;
  requestId:number;
  total:number;
  createdAt:string;
  type:'Orden'|'Presupuesto'|'Recibo'|'Factura'
};

const money=(n:number)=>
  new Intl.NumberFormat(
    'es-AR',
    {
      style:'currency',
      currency:'ARS',
      maximumFractionDigits:0
    }
  ).format(n);

function App(){

  const[session,setSession]=useState<any>(null);
  const[authReady,setAuthReady]=useState(false);
  const[section,setSection]=useState('Dashboard');
  const[businesses,setBusinesses]=useState<Business[]>([]);
  const[products,setProducts]=useState<Product[]>([]);
  const[requests,setRequests]=useState<Request[]>([]);
  const[operations,setOperations]=useState<Operation[]>([]);
  const[query,setQuery]=useState('');
  const[filter,setFilter]=useState(0);
  const[editing,setEditing]=useState<Product|null>(null);
  const[editingBusiness,setEditingBusiness]=useState<Business|null>(null);
  const[loading,setLoading]=useState(false);
  const[dbError,setDbError]=useState('');

  const total=useMemo(
    ()=>operations.reduce((a,b)=>a+b.total,0),
    [operations]
  );

  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>{
      setSession(data.session);
      setAuthReady(true);
    });

    const{data}=supabase.auth.onAuthStateChange((_e,s)=>{
      setSession(s);
      setAuthReady(true);
    });

    return()=>data.subscription.unsubscribe();
  },[]);

  useEffect(()=>{
    if(!session)return;

    setLoading(true);
    setDbError('');

    Promise.all([
      loadBusinesses(),
      loadProducts(),
      loadRequests()
    ])
      .then(([b,p,r])=>{
        setBusinesses(b);
        setProducts(p);
        setRequests(r);
      })
      .catch(e=>
        setDbError(
          e.message||
          'No se pudieron cargar los datos.'
        )
      )
      .finally(()=>setLoading(false));

  },[session]);

  if(!authReady)
    return <p className="empty">Cargando Llave 360…</p>;

  if(!session)
    return <Login/>;

  const saveBusiness=async(b:Business)=>{
    try{
      setDbError('');

      const saved=await saveBusinessDb(b);

      setBusinesses(v=>
        v.some(x=>x.id===saved.id)
          ?v.map(x=>x.id===saved.id?saved:x)
          :[...v,saved]
      );

      setEditingBusiness(null);

    }catch(e:any){
      setDbError(
        e.message||
        'No se pudo guardar el negocio.'
      );
    }
  };

  const saveProduct=async(p:Product)=>{
    try{
      setDbError('');

      const saved=await saveProductDb(p);

      setProducts(v=>
        v.some(x=>x.id===saved.id)
          ?v.map(x=>x.id===saved.id?saved:x)
          :[...v,saved]
      );

      setEditing(null);

    }catch(e:any){
      setDbError(
        e.message||
        'No se pudo guardar el producto.'
      );
    }
  };

  const updateRequest=async(
    id:number,
    status:Status
  )=>{
    try{
      setDbError('');

      await updateRequestStatus(id,status);

      setRequests(v=>
        v.map(r=>
          r.id===id
            ?{...r,status}
            :r
        )
      );

    }catch(e:any){
      setDbError(
        e.message||
        'No se pudo actualizar la solicitud.'
      );
    }
  };

  const downloadPdf=(
    op:Operation,
    r:Request,
    p:Product
  )=>{
    const business=
      businesses.find(
        b=>b.id===p.businessId
      );

    const doc=new jsPDF();

    doc.setFontSize(20);
    doc.text('LLAVE 360',20,20);

    doc.setFontSize(12);
    doc.text(
      `${op.type} #LL-${String(op.id).slice(-6)}`,
      20,
      32
    );

    doc.text(
      `Fecha: ${op.createdAt}`,
      20,
      40
    );

    doc.text(
      `Cliente: ${r.client}`,
      20,
      52
    );

    doc.text(
      `Telefono: ${r.phone}`,
      20,
      60
    );

    doc.text(
      `Negocio: ${business?.name||'-'}`,
      20,
      72
    );

    doc.text(
      `Producto: ${p.name}`,
      20,
      80
    );

    doc.text(
      `Total: ${money(op.total)}`,
      20,
      92
    );

    doc.text(
      'Comprobante interno de Llave 360. No constituye factura fiscal.',
      20,
      112
    );

    doc.save(
      `llave360-${op.id}.pdf`
    );
  };

  const generateOperation=(r:Request)=>{
    const product=
      products.find(
        p=>p.id===r.productId
      );

    if(!product)return;

    const existing=
      operations.find(
        o=>o.requestId===r.id
      );

    if(existing)
      return downloadPdf(
        existing,
        r,
        product
      );

    const op:Operation={
      id:Date.now(),
      requestId:r.id,
      total:product.price,
      createdAt:new Date().toLocaleString('es-AR'),
      type:'Orden'
    };

    setOperations(v=>[...v,op]);

    downloadPdf(
      op,
      r,
      product
    );
  };

  const menu=[
    ['Dashboard',LayoutDashboard],
    ['Solicitudes',Inbox],
    ['Negocios',Store],
    ['Productos',Package],
    ['Facturación',ReceiptText],
    ['Configuración',Settings]
  ]as const;

  const filteredProducts=
    products.filter(
      p=>
        (!filter||p.businessId===filter)&&
        (
          p.name
            .toLowerCase()
            .includes(query.toLowerCase())
          ||
          businesses
            .find(b=>b.id===p.businessId)
            ?.name
            .toLowerCase()
            .includes(query.toLowerCase())
        )
    );

  return(
    <div className="app">

      <aside>

        <div className="brand">
          <div className="logo">360</div>

          <div>
            <strong>LLAVE 360</strong>
            <span>Administración</span>
          </div>
        </div>

        <nav>
          {menu.map(([label,Icon])=>
            <button
              key={label}
              className={
                section===label
                  ?'active'
                  :''
              }
              onClick={()=>setSection(label)}
            >
              <Icon size={18}/>
              {label}
            </button>
          )}
        </nav>

        <div className="admin-card">
          <span>Usuario</span>
          <strong>Administrador</strong>
          <small>{session.user.email}</small>

          <button
            onClick={()=>
              supabase.auth.signOut()
            }
          >
            <LogOut size={15}/>
            {' '}Salir
          </button>
        </div>

      </aside>

      <main>

        <header>
          <h1>{section}</h1>
          <p>
            Panel central de gestión de Llave 360
          </p>
        </header>

        {dbError&&
          <div className="login-error">
            {dbError}
          </div>
        }

        {loading&&
          <p className="muted">
            Cargando datos de Supabase…
          </p>
        }

        {section==='Dashboard'&&
          <>
            <section className="stats">

              <Stat
                title="Solicitudes nuevas"
                value={String(
                  requests.filter(
                    r=>r.status==='Nueva'
                  ).length
                )}
                icon={<Inbox/>}
              />

              <Stat
                title="Negocios activos"
                value={String(
                  businesses.filter(
                    b=>b.active
                  ).length
                )}
                icon={<Store/>}
              />

              <Stat
                title="Productos"
                value={String(
                  products.filter(
                    p=>p.active
                  ).length
                )}
                icon={<Package/>}
              />

              <Stat
                title="Operaciones"
                value={money(total)}
                icon={<ReceiptText/>}
              />

            </section>

            <section className="panel">
              <h2>Actividad reciente</h2>

              {requests.length===0
                ?<p className="empty">
                  Todavía no hay solicitudes.
                </p>
                :requests.slice(0,5).map(r=>
                  <RequestRow
                    key={r.id}
                    r={r}
                    products={products}
                    onStatus={updateRequest}
                    onPdf={generateOperation}
                  />
                )
              }
            </section>
          </>
        }

        {section==='Solicitudes'&&
          <section className="panel">

            <h2>Solicitudes recibidas</h2>

            {requests.length
              ?requests.map(r=>
                <RequestRow
                  key={r.id}
                  r={r}
                  products={products}
                  onStatus={updateRequest}
                  onPdf={generateOperation}
                />
              )
              :<p className="empty">
                Las solicitudes realizadas desde la app aparecerán acá.
              </p>
            }

          </section>
        }

        {section==='Negocios'&&
          <section className="panel">

            <div className="panel-head">

              <h2>Negocios</h2>

              <button
                className="primary"
                onClick={()=>
                  setEditingBusiness({
                    id:Date.now(),
                    name:'',
                    description:'',
                    image:'',
                    active:true
                  })
                }
              >
                <Plus size={16}/>
                Agregar negocio
              </button>

            </div>

            <div className="grid">

              {businesses.map(b=>
                <article
                  className="card"
                  key={b.id}
                >

                  {b.image
                    ?<img
                      src={b.image}
                      style={{
                        width:'100%',
                        height:150,
                        objectFit:'cover',
                        borderRadius:8
                      }}
                    />
                    :<div className="image-empty">
                      <Store size={28}/>
                      <span>Sin imagen</span>
                    </div>
                  }

                  <h3>{b.name}</h3>

                  <p>{b.description}</p>

                  <span
                    className={`status ${
                      b.active
                        ?'ok'
                        :'finalizada'
                    }`}
                  >
                    {b.active
                      ?'Activo'
                      :'Oculto'
                    }
                  </span>

                  <button
                    onClick={()=>
                      setEditingBusiness({...b})
                    }
                  >
                    <Pencil size={16}/>
                    {' '}Editar
                  </button>

                </article>
              )}

            </div>

          </section>
        }

        {section==='Productos'&&
          <section className="panel">

            <div className="panel-head">

              <h2>Productos</h2>

              <div className="actions">

                <div className="search">
                  <Search size={16}/>

                  <input
                    value={query}
                    onChange={
                      e=>setQuery(e.target.value)
                    }
                    placeholder="Buscar producto o negocio"
                  />
                </div>

                <button
                  className="primary"
                  disabled={!businesses.length}
                  onClick={()=>
                    setEditing({
                      id:Date.now(),
                      businessId:
                        businesses[0]?.id||0,
                      name:'',
                      price:0,
                      description:'',
                      image:'',
                      active:true
                    })
                  }
                >
                  <Plus size={16}/>
                  Agregar producto
                </button>

              </div>

            </div>

            <div className="filters">

              <button
                className={
                  !filter
                    ?'selected'
                    :''
                }
                onClick={()=>setFilter(0)}
              >
                Todos
              </button>

              {businesses.map(b=>
                <button
                  key={b.id}
                  className={
                    filter===b.id
                      ?'selected'
                      :''
                  }
                  onClick={()=>setFilter(b.id)}
                >
                  {b.name}
                </button>
              )}

            </div>

            <div className="products">

              {filteredProducts.map(p=>
                <article
                  className="product"
                  key={p.id}
                >

                  {p.image
                    ?<img src={p.image}/>
                    :<div className="image-empty">
                      <Package size={28}/>
                      <span>
                        Sin imagen de producto
                      </span>
                    </div>
                  }

                  <div>

                    <small>
                      {
                        businesses.find(
                          b=>b.id===p.businessId
                        )?.name
                      }
                    </small>

                    <h3>{p.name}</h3>

                    <p>{p.description}</p>

                    <strong>
                      {money(p.price)}
                    </strong>

                  </div>

                  <button
                    onClick={()=>
                      setEditing({...p})
                    }
                  >
                    <Pencil size={16}/>
                    Editar
                  </button>

                </article>
              )}

            </div>

          </section>
        }

        {section==='Facturación'&&
          <section className="panel">

            <h2>
              Operaciones y comprobantes
            </h2>

            {operations.length===0
              ?<p className="empty">
                Todavía no hay operaciones. Generá una desde una solicitud.
              </p>
              :operations.map(o=>{

                const r=
                  requests.find(
                    r=>r.id===o.requestId
                  );

                if(!r)return null;

                const p=
                  products.find(
                    p=>p.id===r.productId
                  );

                if(!p)return null;

                return(
                  <div
                    className="invoice"
                    key={o.id}
                  >

                    <strong>
                      LL-{String(o.id).slice(-6)}
                    </strong>

                    <div>{r.client}</div>

                    <div>{p.name}</div>

                    <strong>
                      {money(o.total)}
                    </strong>

                    <button
                      onClick={()=>
                        downloadPdf(o,r,p)
                      }
                    >
                      <FileDown size={16}/>
                      PDF
                    </button>

                  </div>
                );
              })
            }

            <p className="muted">
              Los PDF actuales son comprobantes internos. Integración fiscal ARCA: etapa posterior.
            </p>

          </section>
        }

        {section==='Configuración'&&
          <section className="panel">

            <h2>Configuración</h2>

            <div className="settings">

              <label>
                Nombre comercial
                <input defaultValue="Llave 360"/>
              </label>

              <label>
                Usuario administrador
                <input defaultValue="Administrador"/>
              </label>

              <label>
                Prefijo de comprobantes
                <input defaultValue="LL"/>
              </label>

            </div>

          </section>
        }

      </main>

      {editing&&
        <ProductEditor
          product={editing}
          businesses={businesses}
          onSave={saveProduct}
          onClose={()=>setEditing(null)}
        />
      }

      {editingBusiness&&
        <BusinessEditor
          business={editingBusiness}
          onSave={saveBusiness}
          onClose={()=>setEditingBusiness(null)}
        />
      }

    </div>
  );
}

function Stat({
  title,
  value,
  icon
}:{
  title:string;
  value:string;
  icon:React.ReactNode
}){
  return(
    <article className="stat">
      <div>{icon}</div>
      <span>{title}</span>
      <strong>{value}</strong>
    </article>
  );
}

function RequestRow({
  r,
  products,
  onStatus,
  onPdf
}:{
  r:Request;
  products:Product[];
  onStatus:(id:number,s:Status)=>void;
  onPdf:(r:Request)=>void
}){
  const p=
    products.find(
      p=>p.id===r.productId
    );

  return(
    <div className="request">

      <div>
        <strong>{r.client}</strong>
        <span>{r.phone}</span>
      </div>

      <div>
        <strong>
          {p?.name||'Producto'}
        </strong>
        <span>{r.createdAt}</span>
      </div>

      <StatusBadge status={r.status}/>

      <select
        value={r.status}
        onChange={
          e=>
            onStatus(
              r.id,
              e.target.value as Status
            )
        }
      >
        <option>Nueva</option>
        <option>Contactado</option>
        <option>Finalizada</option>
      </select>

      <button onClick={()=>onPdf(r)}>
        <FileDown size={16}/>
        Comprobante
      </button>

    </div>
  );
}

function StatusBadge({
  status
}:{
  status:Status
}){
  const Icon=
    status==='Nueva'
      ?Clock3
      :status==='Contactado'
        ?CheckCircle2
        :XCircle;

  return(
    <span
      className={`status ${status.toLowerCase()}`}
    >
      <Icon size={14}/>
      {status}
    </span>
  );
}

createRoot(
  document.getElementById('root')!
).render(
  <React.StrictMode>
    <App/>
  </React.StrictMode>
);