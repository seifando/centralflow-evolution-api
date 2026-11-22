// Optional CentralFlow extension. Runs inside Evolution 2.3.7 and reuses its authenticated socket.
// No new WhatsApp session, database, tokens or HTTP server.
export class ChannelError extends Error { constructor(public status:number,message:string){super(message);} }
export type ChannelSocket = {
 query?:(node:any,timeoutMs?:number)=>Promise<any>;
 generateMessageTag?:()=>string;
 newsletterMetadata:(type:'jid'|'invite',key:string)=>Promise<any>;
 newsletterCreate:(name:string,description?:string)=>Promise<any>;
 newsletterFollow:(jid:string)=>Promise<any>;
 newsletterUnfollow:(jid:string)=>Promise<any>;
 newsletterDelete:(jid:string)=>Promise<any>;
 newsletterUpdate:(jid:string,values:{name:string;description:string})=>Promise<any>;
 newsletterFetchMessages:(jid:string,count:number,since:number,after:number)=>Promise<any>;
 sendMessage:(jid:string,content:any)=>Promise<any>;
};
function text(v:unknown,min:number,max:number):string{if(typeof v!=='string'||v.trim().length<min||v.length>max)throw new ChannelError(400,'Campo inválido.');return v.trim();}
function jid(v:unknown):string{const s=text(v,10,100);if(!/^\d{5,40}@newsletter$/.test(s))throw new ChannelError(400,'Identificador de canal inválido.');return s;}
export function reference(v:unknown):{type:'jid'|'invite';key:string}{const value=text(v,5,200);if(/^\d{5,40}@newsletter$/.test(value))return {type:'jid',key:value};try{const url=new URL(value);if(url.protocol==='https:'&&url.hostname==='whatsapp.com'&&!url.username&&!url.password&&!url.search&&!url.hash&&/^\/channel\/[a-zA-Z0-9_-]{5,100}$/.test(url.pathname))return {type:'invite',key:url.pathname.split('/')[2]!};}catch{}throw new ChannelError(400,'Use o link https://whatsapp.com/channel/... ou o identificador @newsletter.');}
export function normalize(raw:any,created=false){if(!raw||!/^\d{5,40}@newsletter$/.test(raw.id??''))throw new ChannelError(502,'A conexão não retornou metadados válidos.');const t=raw.thread_metadata??{};const label=(value:any)=>typeof value==='string'?value:typeof value?.text==='string'?value.text:'';const subscribers=raw.subscribers??t.subscribers_count;return {jid:raw.id,name:label(raw.name)||label(t.name)||raw.id,description:label(raw.description)||label(t.description),invite:raw.invite??t.invite??null,role:created?'OWNER':raw.viewer_metadata?.role??raw.role??'UNKNOWN',subscribers:subscribers===undefined||subscribers===null||!Number.isFinite(Number(subscribers))||Number(subscribers)<0?null:Number(subscribers)};}
async function metadata(socket:ChannelSocket,id:string){return normalize(await socket.newsletterMetadata('jid',id));}
async function permission(socket:ChannelSocket,id:string,owner=false){const m=await metadata(socket,id);if(owner?m.role!=='OWNER':!['ADMIN','OWNER'].includes(m.role))throw new ChannelError(403,owner?'A remoção exige propriedade confirmada do canal.':'A operação exige função de proprietário ou administrador confirmada pelo WhatsApp.');return m;}
// Read-only subscribed-newsletter query used by WhatsMeow GetSubscribedNewsletters.
// Transport follows Baileys 7.0.0-rc.9 Socket/mex.ts. It never follows or creates a channel.
// Primary references: github.com/tulir/whatsmeow/blob/main/newsletter.go
// and github.com/WhiskeySockets/Baileys/blob/v7.0.0-rc.9/src/Socket/mex.ts
export async function listSubscribed(socket:ChannelSocket){
 if(typeof socket.query!=='function'||typeof socket.generateMessageTag!=='function')throw new ChannelError(409,'A conexão não oferece a consulta de canais. Atualize a extensão no servidor Evolution.');
 const result=await socket.query({tag:'iq',attrs:{id:socket.generateMessageTag(),type:'get',to:'s.whatsapp.net',xmlns:'w:mex'},content:[{tag:'query',attrs:{query_id:'6388546374527196'},content:Buffer.from(JSON.stringify({variables:{}}),'utf8')}]},20000);
 const node=Array.isArray(result?.content)?result.content.find((v:any)=>v?.tag==='result'):null;
 if(!(node?.content instanceof Uint8Array)||node.content.byteLength>8*1024*1024)throw new ChannelError(502,'O WhatsApp não retornou uma lista de canais válida. Tente novamente após conferir a conexão.');
 let data:any;try{data=JSON.parse(Buffer.from(node.content).toString('utf8'));}catch{throw new ChannelError(502,'A lista de canais retornada não pôde ser interpretada.');}
 if(Array.isArray(data?.errors)&&data.errors.length)throw new ChannelError(502,'O WhatsApp recusou a consulta de canais. A sessão e os canais cadastrados foram preservados.');
 const rows=data?.data?.xwa2_newsletter_subscribed;
 if(!Array.isArray(rows))throw new ChannelError(502,'A consulta não retornou o formato de canais esperado. Confira a compatibilidade da extensão.');
 const seen=new Set<string>();const channels:any[]=[];let ignored=0;
 for(const row of rows.slice(0,500)){try{const c=normalize(row);if(seen.has(c.jid))continue;seen.add(c.jid);channels.push(c);}catch{ignored++;}}
 return {channels,returned:rows.length,ignored,truncated:rows.length>500,source:'whatsapp_subscribed',extensionVersion:'0.6.1'};
}
export async function channelAction(socket:ChannelSocket,op:string,input:any,decode?:(bytes:Uint8Array)=>any):Promise<any>{
 if(!socket||typeof socket.newsletterMetadata!=='function')throw new ChannelError(409,'Esta conexão não oferece suporte a canais.');
 if(op==='capabilities')return {protocol:'centralflow-publishing/1',extensionVersion:'0.6.1',channels:true,status:true,discovery:'whatsapp_subscribed',operations:['sync','create','import','follow','refresh','edit','unfollow','delete','post','messages']};
 if(op==='sync')return listSubscribed(socket);
 if(op==='create'){const name=text(input.name,2,100);const description=text(input.description??'',0,2000);return normalize(await socket.newsletterCreate(name,description),true);}
 if(op==='import'||op==='follow'){const ref=reference(input.reference);const m=normalize(await socket.newsletterMetadata(ref.type,ref.key));if(op==='follow'){await socket.newsletterFollow(m.jid);return metadata(socket,m.jid);}return m;}
 const id=jid(input.jid);
 if(op==='refresh')return metadata(socket,id);
 if(op==='unfollow'){await socket.newsletterUnfollow(id);return {ok:true};}
 if(op==='delete'){await permission(socket,id,true);await socket.newsletterDelete(id);return {ok:true};}
 if(op==='edit'){await permission(socket,id);await socket.newsletterUpdate(id,{name:text(input.name,2,100),description:text(input.description??'',0,2000)});return metadata(socket,id);}
 if(op==='post'){
  await permission(socket,id);const body=text(input.text??'',input.kind==='text'?1:0,5000);let content:any;
  if(input.kind==='text')content={text:body};else {if(!['image','video'].includes(input.kind))throw new ChannelError(400,'Tipo inválido.');const mime=input.media?.mime;const allowed=input.kind==='image'?['image/jpeg','image/png','image/webp']:['video/mp4'];if(!allowed.includes(mime))throw new ChannelError(400,'Formato inválido.');const data=text(input.media?.base64,1,23000000);if(!/^[A-Za-z0-9+/]+={0,2}$/.test(data))throw new ChannelError(400,'Mídia inválida.');const bytes=Buffer.from(data,'base64');if(!bytes.length||bytes.length>16*1024*1024)throw new ChannelError(413,'Limite de mídia excedido.');content={[input.kind]:bytes,caption:body,mimetype:mime};}
  const result=await socket.sendMessage(id,content);if(typeof result?.key?.id!=='string')throw new ChannelError(502,'Envio sem identificador. Confira o canal antes de repetir.');return {key:{id:result.key.id}};
 }
 if(op==='messages'){
  const tree=await socket.newsletterFetchMessages(id,30,0,0);const messages:any[]=[];
  const visit=(node:any,depth=0)=>{if(!node||depth>10||messages.length>=30)return;if(node.tag==='message'){let body='[Conteúdo não textual]';if(Array.isArray(node.content)){const plain=node.content.find((c:any)=>c.tag==='plaintext');if(plain?.content instanceof Uint8Array&&decode){try{const m=decode(plain.content);body=m.conversation??m.extendedTextMessage?.text??m.imageMessage?.caption??m.videoMessage?.caption??body;}catch{}}}messages.push({id:node.attrs?.server_id??node.attrs?.id??'',timestamp:Number.isFinite(Number(node.attrs?.t))&&Number(node.attrs?.t)>0&&Number(node.attrs?.t)<100000000000?Number(node.attrs.t):null,body:String(body).slice(0,5000)});}else if(Array.isArray(node.content))for(const child of node.content)visit(child,depth+1);};visit(tree);return {messages};
 }
 throw new ChannelError(404,'Operação não encontrada.');
}
