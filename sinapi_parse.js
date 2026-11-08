/* ===================== Leitor dos relatórios SINAPI (PDF da CAIXA) =====================
   Funciona no navegador e no Node. Entrada: páginas já extraídas pelo pdf.js, cada uma como
   lista de itens {s, x, y, w} (texto, posição esquerda, linha de base, largura), em pontos.
   Relatórios suportados:
     - "RELATÓRIO DE CUSTOS DE COMPOSIÇÕES" (por UF)
     - "RELATÓRIO DE PREÇOS DE INSUMOS" (por UF)
     - "RELATÓRIO ANALÍTICO DE COMPOSIÇÕES" (nacional)
   ======================================================================================= */
(function(root){
const num=s=>{if(s==null)return null;s=String(s).trim();if(!s||s==='-')return null;const v=parseFloat(s.replace(/\./g,'').replace(',','.'));return isFinite(v)?v:null;};
const pct=s=>{s=String(s||'').trim();if(!s||s==='-')return null;const v=parseFloat(s.replace('%','').replace(',','.'));return isFinite(v)?v:0;};
/* agrupa itens em linhas (mesma linha de base ± tol), de cima para baixo, e ordena por x */
function linhas(items,tol=1.6){const it=items.filter(i=>i.s&&i.s.trim()).slice().sort((a,b)=>b.y-a.y||a.x-b.x);const out=[];
 for(const i of it){const L=out[out.length-1];if(L&&Math.abs(L.y-i.y)<=tol){L.it.push(i);}else out.push({y:i.y,it:[i]});}
 out.forEach(L=>L.it.sort((a,b)=>a.x-b.x));return out;}
const txt=L=>L.it.map(i=>i.s).join(' ').replace(/\s+/g,' ').trim();
function tipoRelatorio(page){const t=page.map(i=>i.s).join(' ');if(/RELATÓRIO ANALÍTICO DE COMPOSIÇÕES/.test(t))return 'analitico';if(/RELATÓRIO DE CUSTOS DE COMPOSIÇÕES/.test(t))return 'composicoes';if(/RELATÓRIO DE PREÇOS DE INSUMOS/.test(t))return 'insumos';return null;}
function meta(page){const t=page.map(i=>i.s).join(' ').replace(/\s+/g,' ');const g=re=>{const m=t.match(re);return m?m[1].trim():null;};
 const loc=g(/Localidade:\s*(.+?)\s*\|/);const uf=loc&&(loc.match(/-\s*([A-Z]{2})\s*$/)||[])[1]||null;
 return{tipo:tipoRelatorio(page),mes:g(/Mês de Referência:\s*(\d{2}\/\d{4})/),emissao:g(/Data de emissão:\s*(\d{2}\/\d{2}\/\d{4})/),localidade:loc,uf,
  encargos:{semH:pct(g(/SEM desoneração:\s*Horista:\s*([\d,]+%)/)),semM:pct(g(/SEM desoneração:\s*Horista:\s*[\d,]+%\s*Mensalista:\s*([\d,]+%)/)),
   comH:pct(g(/COM desoneração:\s*Horista:\s*([\d,]+%)/)),comM:pct(g(/COM desoneração:\s*Horista:\s*[\d,]+%\s*Mensalista:\s*([\d,]+%)/))}};}
/* âncoras de coluna a partir do cabeçalho da página */
function ancoras(page,nomes){const a={};for(const [k,re] of Object.entries(nomes)){const hs=page.filter(i=>re.test(i.s.trim()));if(hs.length)a[k]=hs.sort((p,q)=>p.x-q.x).map(h=>h.x);}return a;}
const ehCab=(L)=>L.y>=495||/Página:\s*\d+\s*\/\s*\d+|^SINAPI - Sistema|RELATÓRIO D|Localidade:|^Código\b|Família|Custo Total|Preços \(R\$\)|SEM desoneração|COM desoneração|Descrição d[ao] (Composição|Insumo)/.test(txt(L));

/* páginas de introdução (texto corrido antes da 1ª tabela) não entram */
const semIntro=pages=>{const k=pages.findIndex(p=>p.some(i=>/^Código$/.test(i.s.trim())));return k>0?pages.map((p,i)=>i<k?[]:p):pages;};
/* ---------- CUSTOS DE COMPOSIÇÕES ---------- */
function parseComposicoes(pages,log){const out=[];let cur=null,grupo='',falhas=[];pages=semIntro(pages);
 const A0={un:537,as1:667,com:697,as2:789};
 pages.forEach((page,pi)=>{const a=ancoras(page,{un:/^Unid\.$/,as:/^%AS$/,com:/^COM desoneração$/});
  const un=(a.un||[A0.un])[0],as1=(a.as||[A0.as1])[0],com=(a.com||[A0.com])[0],as2=(a.as||[0,A0.as2])[1]||A0.as2;
  for(const L of linhas(page)){if(ehCab(L))continue;const t=txt(L);
   if(/^Grupo /.test(t)){grupo=t.replace(/^Grupo /,'').replace(/\s*\(clique.*$/,'').replace(/\s*-\s*continuação$/,'').trim();cur=null;continue;}
   const f=L.it[0];
   if(f.x<75&&/^\d{3,7}$/.test(f.s.trim())){
    const r={cod:f.s.trim(),desc:'',un:'',sem:null,asSem:null,com:null,asCom:null,grupo};
    for(const i of L.it.slice(1)){const s=i.s.trim();
     if(i.x<un-12)r.desc+=(r.desc?' ':'')+s;
     else if(i.x<un+40&&!r.un&&!/\d,\d/.test(s))r.un=s;
     else if(i.x<as1-2)r.sem=num(s);
     else if(i.x<com-2)r.asSem=pct(s);
     else if(i.x<as2-3)r.com=num(s);
     else r.asCom=pct(s);}
    if(!r.un){falhas.push({pag:pi+1,linha:t});}
    out.push(r);cur=r;continue;}
   /* continuação da descrição; o "%" do %AS = 100 às vezes quebra para a linha de baixo */
   const desc=L.it.filter(i=>!(i.s.trim()==='%'&&i.x>=as1-3));
   if(cur&&desc.length&&desc[0].x>=75&&desc.every(i=>i.x<un-12)){cur.desc+=' '+desc.map(i=>i.s).join(' ');continue;}
   if(cur&&!desc.length)continue;
   if(t)falhas.push({pag:pi+1,linha:t});}});
 out.forEach(r=>r.desc=r.desc.replace(/\s+/g,' ').trim());
 return{itens:out,falhas};}

/* ---------- PREÇOS DE INSUMOS ---------- */
function parseInsumos(pages){const out=[];let cur=null,falhas=[];pages=semIntro(pages);
 pages.forEach((page,pi)=>{const a=ancoras(page,{un:/^Unid\.$/,orig:/^Origem$/,sem:/^SEM desoneração$/,com:/^COM desoneração$/,desc:/^Descrição do Insumo$/});
  const un=(a.un||[537])[0],orig=(a.orig||[581])[0],com=(a.com||[725])[0],dx=(a.desc||[198])[0];
  for(const L of linhas(page)){if(ehCab(L))continue;const t=txt(L);const f=L.it[0];
   if(f.x<75&&/^\d{3,7}$/.test(f.s.trim())&&L.it.length>=4){
    const r={fam:sz(f.s.trim()),coef:null,cod:'',desc:'',un:'',origem:'',sem:null,com:null};
    for(const i of L.it.slice(1)){const s=i.s.trim();
     if(i.x<dx-45&&!r.coef&&/\d,\d/.test(s)&&!r.cod)r.coef=num(s);
     else if(i.x<dx-3&&/^\d{3,7}$/.test(s))r.cod=sz(s);
     else if(i.x<un-12)r.desc+=(r.desc?' ':'')+s;
     else if(i.x<orig-15&&!r.un)r.un=s;
     else if(i.x<orig+45&&!r.origem&&/^[A-Z]{1,3}$/.test(s))r.origem=s;
     else if(i.x<com-5)r.sem=num(s);
     else r.com=num(s);}
    if(!r.cod||!r.un)falhas.push({pag:pi+1,linha:t});
    out.push(r);cur=r;continue;}
   if(cur&&f.x>=dx-5&&L.it.every(i=>i.x<un-12)){cur.desc+=' '+t;continue;}
   if(t)falhas.push({pag:pi+1,linha:t});}});
 out.forEach(r=>r.desc=r.desc.replace(/\s+/g,' ').trim());
 return{itens:out,falhas};}

/* ---------- ANALÍTICO DE COMPOSIÇÕES ---------- */
/* códigos: o relatório de insumos usa zeros à esquerda (000001), os demais não */
function sz(s){return String(s).replace(/^0+(?=\d)/,'');}
function parseAnalitico(pages){const comps=[],porCod={};let cur=null,last=null,grupo='',falhas=[];pages=semIntro(pages);
 pages.forEach((page,pi)=>{const a=ancoras(page,{un:/^Unid\.$/,coef:/^Coeficiente$/,sit:/^Situação$/});
  const un=(a.un||[610])[0],coef=(a.coef||[660])[0],sit=(a.sit||[751])[0];
  for(const L of linhas(page)){if(ehCab(L))continue;const t=txt(L);const f=L.it[0];
   if(/^Grupo /.test(t)){grupo=t.replace(/^Grupo /,'').replace(/\s*\(clique.*$/,'').replace(/\s*-\s*continuação$/,'').trim();continue;}
   /* item: "C"/"I" + código (às vezes juntos: "C 104658") */
   let tipo=null,cod=null,rest=L.it.slice(1);
   const m1=f.s.trim().match(/^([CI])\s+(\d{1,7})$/);
   if(m1){tipo=m1[1];cod=m1[2];}
   else if(/^[CI]$/.test(f.s.trim())&&L.it[1]&&/^\d{1,7}$/.test(L.it[1].s.trim())&&L.it[1].x<75){tipo=f.s.trim();cod=L.it[1].s.trim();rest=L.it.slice(2);}
   if(tipo&&cur){const r={t:tipo,cod,desc:'',un:'',coef:null,sit:''};
    for(const i of rest){const s=i.s.trim();if(i.x<un-12)r.desc+=(r.desc?' ':'')+s;else if(i.x<coef-8&&!r.un)r.un=s;else if(i.x<sit-20)r.coef=num(s);else r.sit+=(r.sit?' ':'')+s;}
    if(!cur.itens.some(x=>x.t===r.t&&x.cod===r.cod))cur.itens.push(r);last=r;continue;}
   /* cabeçalho de composição: código sozinho à esquerda */
   if(f.x<75&&/^\d{3,7}$/.test(f.s.trim())){const r={cod:f.s.trim(),desc:'',un:'',sit:'',grupo,itens:[]};
    for(const i of L.it.slice(1)){const s=i.s.trim();if(i.x<un-12)r.desc+=(r.desc?' ':'')+s;else if(i.x<coef-8&&!r.un)r.un=s;else r.sit+=(r.sit?' ':'')+s;}
    /* o relatório repete o cabeçalho da composição em blocos separados: junta os itens */
    if(porCod[r.cod]){cur=porCod[r.cod];last={desc:""};continue;}
    porCod[r.cod]=r;comps.push(r);cur=r;last=r;continue;}
   if(last&&f.x>=75&&L.it.every(i=>i.x<un-12)){last.desc+=' '+t;continue;}
   if(t)falhas.push({pag:pi+1,linha:t});}});
 comps.forEach(c=>{c.desc=c.desc.replace(/\s+/g,' ').trim();c.itens.forEach(i=>i.desc=i.desc.replace(/\s+/g,' ').trim());});
 return{itens:comps,falhas};}

/* ---------- extração com pdf.js ---------- */
async function lerPaginas(pdfjs,data,onProg){const doc=await pdfjs.getDocument({data,verbosity:0,isEvalSupported:false}).promise;const pages=[];
 for(let p=1;p<=doc.numPages;p++){const pg=await doc.getPage(p);const tc=await pg.getTextContent();
  pages.push(tc.items.filter(i=>i.str&&i.str.trim()).map(i=>({s:i.str,x:Math.round(i.transform[4]*10)/10,y:Math.round(i.transform[5]*10)/10,w:Math.round(i.width*10)/10})));
  pg.cleanup();if(onProg&&(p%10===0||p===doc.numPages))onProg(p,doc.numPages);}
 await doc.destroy();return pages;}
async function lerRelatorio(pdfjs,data,onProg){const pages=await lerPaginas(pdfjs,data,onProg);const m=meta(pages[0].length>5?pages[0]:pages[1]);const m2=meta(pages[1]||pages[0]);
 const M=Object.assign({},m,Object.fromEntries(Object.entries(m2).filter(([k,v])=>v&&(typeof v!=='object'||Object.values(v).some(Boolean)))));
 const r=M.tipo==='composicoes'?parseComposicoes(pages):M.tipo==='insumos'?parseInsumos(pages):M.tipo==='analitico'?parseAnalitico(pages):{itens:[],falhas:[{pag:1,linha:'tipo de relatório não reconhecido'}]};
 return Object.assign({meta:M,paginas:pages.length},r);}

const API={linhas,meta,parseComposicoes,parseInsumos,parseAnalitico,lerPaginas,lerRelatorio,num,pct};
if(typeof module!=='undefined'&&module.exports)module.exports=API;else root.SINAPI_PARSE=API;
})(typeof window!=='undefined'?window:globalThis);
