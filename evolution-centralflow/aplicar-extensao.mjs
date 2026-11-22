import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.resolve(process.argv[2]??'');const here=path.dirname(fileURLToPath(import.meta.url));
const pkg=JSON.parse(fs.readFileSync(path.join(root,'package.json'),'utf8'));
if(pkg.name!=='evolution-api'||pkg.version!=='2.3.7'||pkg.dependencies?.baileys!=='7.0.0-rc.9')throw Error('Use o código-fonte Evolution 2.3.7 com Baileys 7.0.0-rc.9. Nenhum arquivo foi alterado.');
const route=path.join(root,'src/api/routes/index.router.ts');const original=fs.readFileSync(route,'utf8');
if(original.includes("new CentralFlowRouter")){
 for(const name of ['centralflow.router.ts','centralflow.channels.ts']){
  const target=path.join(root,'src/api/routes',name);
  if(!fs.existsSync(target)||fs.readFileSync(target,'utf8')!==fs.readFileSync(path.join(here,name),'utf8'))throw Error('Existe outra versão da extensão neste fonte. Use uma cópia limpa da Evolution 2.3.7 ou o Dockerfile atualizado; nenhum arquivo foi sobrescrito.');
 }
 console.log('Extensão atual já aplicada.');process.exit(0);
}
const expected=JSON.parse(fs.readFileSync(path.join(here,'upstream.json'),'utf8'));
if(crypto.createHash('sha256').update(original).digest('hex')!==expected.indexSha256)throw Error('O arquivo de rotas difere da versão examinada. Revise manualmente; nenhum arquivo foi alterado.');
const anchor=".use('/group', new GroupRouter(...guards).router)";
if(!original.includes(anchor))throw Error('Ponto de montagem não encontrado.');
const updated="import { CentralFlowRouter } from './centralflow.router';\n"+original.replace(anchor,anchor+"\n    .use('/centralflow', new CentralFlowRouter(...guards).router)");
fs.writeFileSync(route+'.centralflow-backup',original,{flag:'wx'});
for(const name of ['centralflow.router.ts','centralflow.channels.ts'])fs.copyFileSync(path.join(here,name),path.join(root,'src/api/routes',name),fs.constants.COPYFILE_EXCL);
fs.writeFileSync(route,updated);console.log('Extensão aplicada ao código-fonte. Execute o build normal da Evolution e implante preservando banco, configuração e volumes da instância.');
