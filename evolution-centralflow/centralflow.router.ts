import { waMonitor } from '@api/server.module';
import { proto } from 'baileys';
import { RequestHandler, Router } from 'express';
import { channelAction, ChannelError, ChannelSocket } from './centralflow.channels';

export class CentralFlowRouter {
 readonly router=Router();
 constructor(...guards:RequestHandler[]){
  if(guards.length<3)throw new Error('CentralFlow exige os guards de instância e autenticação da Evolution.');
  const strict:RequestHandler=(req,res,next)=>{if(!/^[a-zA-Z0-9_-]{1,80}$/.test(req.params.instanceName??'')||Object.keys(req.query).length){res.status(400).json({error:'Parâmetros de rota inválidos.'});return;}next();};
  const operations=['sync','create','import','follow','refresh','edit','unfollow','delete','post','messages'];
  const handler=(op:string):RequestHandler=>async(req,res)=>{
   try{
    const service=waMonitor.waInstances[req.params.instanceName];
    if(!service?.client)throw new ChannelError(409,'Instância sem conexão Baileys ativa.');
    const result=await channelAction(service.client as unknown as ChannelSocket,op,req.body??{},(bytes)=>proto.Message.decode(bytes));
    res.json(result);
   }catch(error){
    // Never reflect provider errors containing keys, bodies or media in the response.
    const own=error instanceof ChannelError;res.status(own?error.status:502).json({error:own?error.message:'O WhatsApp não confirmou a operação. Confira o canal antes de repetir.'});
   }
  };
  this.router.get('/capabilities/:instanceName',strict,...guards,handler('capabilities'));
  for(const op of operations)this.router.post('/channels/'+op+'/:instanceName',strict,...guards,handler(op));
 }
}
