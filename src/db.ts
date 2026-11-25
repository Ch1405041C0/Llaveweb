import{supabase}from'./supabase';
import type{Business,Product}from'./ProductEditor';

export type RequestStatus='Nueva'|'Contactado'|'Finalizada';

export type RequestItem={
  id:number;
  productId:number;
  quantity:number;
  unitPrice:number;
};

export type DbRequest={
  id:number;
  client:string;
  phone:string;
  businessId:number;
  createdAt:string;
  status:RequestStatus;
  items:RequestItem[];
};

const businessFromRow=(r:any):Business=>({
  id:Number(r.id),
  name:r.name,
  description:r.description||'',
  image:r.image_url||'',
  active:r.active
});

const productFromRow=(r:any):Product=>({
  id:Number(r.id),
  businessId:Number(r.business_id),
  name:r.name,
  description:r.description||'',
  price:Number(r.price),
  image:r.image_url||'',
  active:r.active
});

const requestItemFromRow=(r:any):RequestItem=>({
  id:Number(r.id),
  productId:Number(r.product_id),
  quantity:Number(r.quantity),
  unitPrice:Number(r.unit_price)
});

export async function loadBusinesses(){
  const{data,error}=await supabase
    .from('businesses')
    .select('*')
    .order('id');

  if(error)throw error;

  return(data||[]).map(businessFromRow);
}

export async function loadProducts(){
  const{data,error}=await supabase
    .from('products')
    .select('*')
    .order('id');

  if(error)throw error;

  return(data||[]).map(productFromRow);
}

export async function loadRequests(){
  const{data,error}=await supabase
    .from('requests')
    .select(`
      id,
      client_name,
      phone,
      business_id,
      status,
      created_at,
      request_items (
        id,
        product_id,
        quantity,
        unit_price
      )
    `)
    .order('created_at',{ascending:false});

  if(error)throw error;

  return(data||[]).map((r:any):DbRequest=>({
    id:Number(r.id),
    client:r.client_name||'',
    phone:r.phone||'',
    businessId:Number(r.business_id),
    createdAt:new Date(r.created_at).toLocaleString('es-AR'),
    status:r.status as RequestStatus,
    items:(r.request_items||[]).map(requestItemFromRow)
  }));
}

export async function updateRequestStatus(
  id:number,
  status:RequestStatus
){
  const{error}=await supabase
    .from('requests')
    .update({status})
    .eq('id',id);

  if(error)throw error;
}

async function dataUrlToFile(
  dataUrl:string,
  prefix:string
){
  const res=await fetch(dataUrl);
  const blob=await res.blob();

  const ext=
    blob.type==='image/png'
      ?'png'
      :blob.type==='image/webp'
        ?'webp'
        :'jpg';

  return new File(
    [blob],
    `${prefix}-${Date.now()}.${ext}`,
    {type:blob.type}
  );
}

async function uploadImage(
  bucket:string,
  image:string,
  prefix:string
){
  if(!image.startsWith('data:'))return image;

  const file=await dataUrlToFile(image,prefix);

  const path=
    `${Date.now()}-${Math.random().toString(36).slice(2)}-${file.name}`;

  const{error}=await supabase.storage
    .from(bucket)
    .upload(
      path,
      file,
      {
        contentType:file.type,
        upsert:false
      }
    );

  if(error)throw error;

  return supabase.storage
    .from(bucket)
    .getPublicUrl(path)
    .data
    .publicUrl;
}

export async function saveBusinessDb(b:Business){
  const image=await uploadImage(
    'business-images',
    b.image,
    'business'
  );

  const row={
    name:b.name,
    description:b.description,
    image_url:image,
    active:b.active,
    updated_at:new Date().toISOString()
  };

  if(b.id>1000000000000){
    const{data,error}=await supabase
      .from('businesses')
      .insert(row)
      .select()
      .single();

    if(error)throw error;

    return businessFromRow(data);
  }

  const{data,error}=await supabase
    .from('businesses')
    .update(row)
    .eq('id',b.id)
    .select()
    .single();

  if(error)throw error;

  return businessFromRow(data);
}

export async function saveProductDb(p:Product){
  const image=await uploadImage(
    'product-images',
    p.image,
    'product'
  );

  const row={
    business_id:p.businessId,
    name:p.name,
    description:p.description,
    price:p.price,
    image_url:image,
    active:p.active,
    updated_at:new Date().toISOString()
  };

  if(p.id>1000000000000){
    const{data,error}=await supabase
      .from('products')
      .insert(row)
      .select()
      .single();

    if(error)throw error;

    return productFromRow(data);
  }

  const{data,error}=await supabase
    .from('products')
    .update(row)
    .eq('id',p.id)
    .select()
    .single();

  if(error)throw error;

  return productFromRow(data);
}

export async function deleteProductDb(id:number){
  const{data:linkedItems,error:referenceError}=await supabase
    .from('request_items')
    .select('id')
    .eq('product_id',id)
    .limit(1);

  if(referenceError)throw referenceError;

  if(linkedItems?.length){
    throw new Error(
      'No se puede eliminar este producto porque aparece en solicitudes. Desactivalo para ocultarlo y conservar el historial.'
    );
  }

  const{error}=await supabase
    .from('products')
    .delete()
    .eq('id',id);

  if(error)throw error;
}

export async function deleteBusinessDb(id:number){
  const[productsResult,requestsResult]=await Promise.all([
    supabase
      .from('products')
      .select('id')
      .eq('business_id',id)
      .limit(1),
    supabase
      .from('requests')
      .select('id')
      .eq('business_id',id)
      .limit(1)
  ]);

  if(productsResult.error)throw productsResult.error;
  if(requestsResult.error)throw requestsResult.error;

  if(productsResult.data?.length){
    throw new Error(
      'No se puede eliminar este negocio porque tiene productos asociados. Eliminá primero sus productos.'
    );
  }

  if(requestsResult.data?.length){
    throw new Error(
      'No se puede eliminar este negocio porque tiene solicitudes asociadas. Desactivalo para conservar el historial.'
    );
  }

  const{error}=await supabase
    .from('businesses')
    .delete()
    .eq('id',id);

  if(error)throw error;
}
