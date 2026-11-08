/* PlantaCalc — painel de administração (só o e-mail do administrador; a função "admin" confere no servidor) */
import * as pdfjs from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.min.mjs';
pdfjs.GlobalWorkerOptions.workerSrc='https://cdn.jsdelivr.net/npm/pdfjs-dist@4.10.38/build/pdf.worker.min.mjs';
const C=window.PC_CFG||{},P=window.SINAPI_PARSE,box=document.getElementById('box');
const ADMINS=(C.admins||[C.contato]).map(e=>String(e).toLowerCase());
const BUCKET='sinapi';
const UFS=['AC','AL','AM','AP','BA','CE','DF','ES','GO','MA','MG','MS','MT','PA','PB','PE','PI','PR','RJ','RN','RO','RR','RS','SC','SE','SP','TO'];
const sb=window.supabase.createClient(C.supabaseUrl,C.supabaseKey);
const $=s=>document.querySelector(s),$$=s=>[...document.querySelectorAll(s)];
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const fmt=(n,d=0)=>n==null||!isFinite(n)?'—':Number(n).toLocaleString('pt-BR',{minimumFractionDigits:d,maximumFractionDigits:d});
const brl=n=>'R$ '+fmt(n,2);
const pct=(a,b)=>b?fmt(a/b*100,1)+'%':'—';
const dt=s=>s?new Date(s).toLocaleDateString('pt-BR'):'—';
const dth=s=>s?new Date(s).toLocaleString('pt-BR',{day:'2-digit',month:'2-digit',year:'2-digit',hour:'2-digit',minute:'2-digit'}):'—';
const hm=seg=>{seg=Math.round(seg||0);const h=Math.floor(seg/3600),m=Math.round(seg%3600/60);return h?`${h}h ${String(m).padStart(2,'0')}min`:`${m} min`;};
const DIA=864e5;
const mesChave=m=>{const x=String(m||'').match(/(\d{2})\/(\d{4})/);return x?x[2]+'-'+x[1]:null;};
const mesNome=k=>{const [a,m]=String(k).split('-');return ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez'][+m-1]+'/'+a;};
const norm=s=>String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toUpperCase();
const pubURL=p=>sb.storage.from(BUCKET).getPublicUrl(p).data.publicUrl;
let user=null,TAB='dash',DADOS=null,PER=30,PAG=null,ERR=null,OBS=null;

async function api(acao,extra){const {data,error}=await sb.functions.invoke('admin',{body:Object.assign({acao},extra||{})});
 if(error){let m=error.message;try{const j=await error.context.json();if(j&&j.erro)m=j.erro;}catch(e){}throw new Error(m);}if(data&&data.erro)throw new Error(data.erro);return data;}
async function indice(){try{const r=await fetch(pubURL('index.json')+'?t='+Date.now(),{cache:'no-store'});if(r.ok)return await r.json();}catch(e){}return {atual:null,meses:{}};}
async function enviar(caminho,obj,cache){const blob=new Blob([JSON.stringify(obj)],{type:'application/json'});
 const {error}=await sb.storage.from(BUCKET).upload(caminho,blob,{upsert:true,contentType:'application/json',cacheControl:cache||'3600'});if(error)throw new Error(caminho+': '+error.message);}

/* ---------- tooltip dos gráficos ---------- */
const tip=$('#tip');document.addEventListener('mousemove',e=>{const t=e.target.closest&&e.target.closest('[data-tip]');if(!t){tip.style.display='none';return;}tip.textContent=t.dataset.tip;tip.style.display='block';
 const w=tip.offsetWidth;tip.style.left=Math.min(window.innerWidth-w-8,e.clientX+12)+'px';tip.style.top=(e.clientY-34)+'px';});
function barras(vals,rot,fmtv,titulo){const mx=Math.max(1,...vals.map(v=>v.v));
 return `<div class="vb" role="img" aria-label="${esc(titulo||'')}">${vals.map(v=>`<div style="height:${v.v/mx*100}%" data-tip="${esc(v.k)}: ${esc(fmtv(v.v))}"></div>`).join('')}</div><div class="vbx"><span>${esc(rot[0]||'')}</span><span>${esc(rot[1]||'')}</span></div>`;}
function hbar(lista,fmtv,max=10){const L=lista.slice(0,max);const mx=Math.max(1,...L.map(x=>x[1]));if(!L.length)return '<div class="vazio">Sem dados no período.</div>';
 return `<div class="hb">${L.map(([k,v])=>`<div class="t" title="${esc(k)}">${esc(k)}</div><div><div class="r" style="width:${v/mx*100}%" data-tip="${esc(k)}: ${esc(fmtv(v))}"></div></div><div class="v">${esc(fmtv(v))}</div>`).join('')}</div>`;}
const conta=(arr,f,peso)=>{const o={};for(const x of arr){const k=f(x);if(k==null||k==='')continue;o[k]=(o[k]||0)+(peso?peso(x):1);}return Object.entries(o).sort((a,b)=>b[1]-a[1]);};

/* ---------- entrada ---------- */
async function inicio(){const {data}=await sb.auth.getSession();user=data.session&&data.session.user;
 if(!user){box.innerHTML='<div class="det"><h1>Administração</h1><p class="m">Entre com a sua conta de administrador para continuar.</p><a class="btn pri" href="conta.html?volta=admin">Entrar</a></div>';return;}
 if(!ADMINS.includes(String(user.email).toLowerCase())){box.innerHTML='<div class="det"><h1>Administração</h1><p class="m">Esta área é restrita ao administrador do PlantaCalc. Você entrou como <b>'+esc(user.email)+'</b>.</p><a class="btn sec" href="app.html">Voltar ao PlantaCalc</a></div>';return;}
 const h=(location.hash||'').slice(1);if(['dash','usu','aten','vinc','base'].includes(h))TAB=h;render();}
function render(){const nAt=atencaoN();
 box.innerHTML=`<h1>Administração do PlantaCalc</h1><div class="m" style="font-size:13.5px">Entrou como ${esc(user.email)}${DADOS?' · dados de '+dth(DADOS.agora):''} <button class="btn xs ln" id="bRec" style="margin-left:6px">Atualizar dados</button></div>
 <div class="tabs">${[['dash','Dashboard'],['usu','Usuários'],['aten','Atenção'+(nAt?`<span class="n">${nAt}</span>`:'')],['vinc','Vínculos SINAPI'],['base','Base SINAPI']].map(([k,n])=>`<button data-tab="${k}" class="${k===TAB?'on':''}">${n}</button>`).join('')}</div><div id="corpo"></div>`;
 $$('[data-tab]').forEach(b=>b.onclick=()=>{TAB=b.dataset.tab;history.replaceState(null,'','#'+TAB);render();});
 $('#bRec').onclick=()=>{DADOS=null;PAG=null;ERR=null;OBS=null;VIN.carregado=false;render();};
 ({dash:telaDash,usu:telaUsu,aten:telaAten,vinc:telaVinc,base:telaBase})[TAB]();}
function carregando(t){$('#corpo').innerHTML=`<p class="m">${esc(t||'Carregando…')}</p>`;}
function falha(e){$('#corpo').innerHTML=`<div class="box er">Não foi possível carregar: ${esc(e.message||e)}.<br>Se as funções do servidor ainda não foram publicadas, publique “admin” e “uso” no Supabase.</div>`;}
async function dados(){if(DADOS)return DADOS;DADOS=await api('dados');prepara(DADOS);return DADOS;}

/* ---------- modelo: um registro por usuário ---------- */
function prepara(D){const pf=Object.fromEntries(D.perfis.map(p=>[p.id,p])),cad=Object.fromEntries(D.cadastros.map(c=>[c.id,c]));
 const pj={};for(const p of D.projetos){(pj[p.user_id]=pj[p.user_id]||[]).push(p);}
 const ss={};for(const s of D.sessoes){(ss[s.user_id]=ss[s.user_id]||[]).push(s);}
 const agora=new Date(D.agora),mesIA=D.agora.slice(0,7);
 D.U=D.usuarios.map(u=>{const p=pf[u.id]||{},c=cad[u.id]||{},S=ss[u.id]||[];const val=p.validade?new Date(p.validade):null;const pro=p.plano==='pro'&&val&&val>agora;
  /* pagante = assinatura autorizada ou Pix pago; Pro sem pagamento registrado (cortesia ou liberação manual) conta como cortesia */
  const pago=pro&&['authorized','pix'].includes(String(p.mp_status));const cort=pro&&!pago;
  const plano=u.banido||p.bloqueado?'bloqueado':pago?'pro':cort?'cortesia':'gratis';
  const ult=S.length?S[0].fim:u.ultimo_login;const seg=S.reduce((a,s)=>a+(s.segundos||0),0);
  const cid=conta(S.filter(s=>s.cidade),s=>s.cidade+(s.uf?' – '+s.uf:''),s=>Math.max(1,s.segundos||0))[0];
  return {id:u.id,email:u.email,nome:c.nome||'',prof:c.profissao||'',emp:c.empresa||'',cidCad:c.cidade?(c.cidade+(c.uf?' – '+c.uf:'')):'',ufCad:c.uf||'',tel:c.telefone||'',novid:!!c.novidades,cadOk:!!(c.nome&&c.profissao),
   criado:u.criado,ultLogin:u.ultimo_login,ult,confirmado:u.confirmado,banido:u.banido,p,pro,pago,cort,plano,ciclo:p.ciclo,validade:p.validade,mp:p.mp_status,
   sess:S,nSess:S.length,seg,cidUso:cid?cid[0]:'',nProj:(pj[u.id]||[]).length,proj:pj[u.id]||[],ia:u.ia&&u.ia.mes===mesIA?(u.ia.n||0):0};});
 D.byId=Object.fromEntries(D.U.map(u=>[u.id,u]));}

/* ---------- DASHBOARD ---------- */
async function telaDash(){carregando('Carregando indicadores…');let D;try{D=await dados();}catch(e){return falha(e);}
 const agora=new Date(D.agora).getTime(),ini=agora-PER*DIA,iniAnt=agora-2*PER*DIA;const U=D.U;
 const S=D.sessoes.filter(s=>new Date(s.inicio).getTime()>=ini),Sant=D.sessoes.filter(s=>{const t=new Date(s.inicio).getTime();return t>=iniAnt&&t<ini;});
 const ativos=new Set(S.map(s=>s.user_id)),ativosAnt=new Set(Sant.map(s=>s.user_id));
 const novos=U.filter(u=>new Date(u.criado).getTime()>=ini),novosAnt=U.filter(u=>{const t=new Date(u.criado).getTime();return t>=iniAnt&&t<ini;});
 const pagantes=U.filter(u=>u.plano==='pro'),cort=U.filter(u=>u.plano==='cortesia'),gratis=U.filter(u=>u.plano==='gratis'),bloq=U.filter(u=>u.plano==='bloqueado');
 const preco=C.preco||{mensal:29.9,anual:299};const mrr=pagantes.reduce((a,u)=>a+(u.ciclo==='anual'?preco.anual/12:preco.mensal),0);
 const canc=U.filter(u=>['cancelled','paused'].includes(String(u.mp))&&u.p.atualizado&&new Date(u.p.atualizado).getTime()>=ini);
 const segT=S.reduce((a,s)=>a+(s.segundos||0),0),segAnt=Sant.reduce((a,s)=>a+(s.segundos||0),0);
 const retidos=[...ativosAnt].filter(id=>ativos.has(id)).length;
 const dia=t=>new Date(t).toISOString().slice(0,10);const dias=[];for(let t=agora-(Math.min(PER,90)-1)*DIA;t<=agora;t+=DIA)dias.push(dia(t));
 const porDia={};S.forEach(s=>{const k=dia(s.inicio);(porDia[k]=porDia[k]||new Set()).add(s.user_id);});const dau=dias.map(k=>({k:new Date(k+'T12:00').toLocaleDateString('pt-BR'),v:porDia[k]?porDia[k].size:0}));
 const horasDia={};S.forEach(s=>{const k=dia(s.inicio);horasDia[k]=(horasDia[k]||0)+(s.segundos||0)/3600;});const hd=dias.map(k=>({k:new Date(k+'T12:00').toLocaleDateString('pt-BR'),v:horasDia[k]||0}));
 const sem=[];for(let w=11;w>=0;w--){const a=agora-(w+1)*7*DIA,b=agora-w*7*DIA;sem.push({k:'semana até '+new Date(b).toLocaleDateString('pt-BR'),v:U.filter(u=>{const t=new Date(u.criado).getTime();return t>=a&&t<b;}).length});}
 const wau=new Set(D.sessoes.filter(s=>new Date(s.inicio).getTime()>=agora-7*DIA).map(s=>s.user_id)).size,mau=new Set(D.sessoes.filter(s=>new Date(s.inicio).getTime()>=agora-30*DIA).map(s=>s.user_id)).size;
 const dauHoje=new Set(D.sessoes.filter(s=>new Date(s.inicio).getTime()>=agora-DIA).map(s=>s.user_id)).size;
 const ev={};S.forEach(s=>Object.entries(s.eventos||{}).forEach(([k,v])=>{ev[k]=(ev[k]||0)+(+v||0);}));
 const NOME_EV=k=>({tela_croqui:'Tela: croqui',tela_quant:'Tela: quantitativo',tela_folhas:'Tela: pranchas',tela_perfil:'Tela: perfil',aba_orc:'Aba: orçamento SINAPI',aba_custo:'Aba: custo P50/P80',aba_plan:'Aba: planejamento',aba_revs:'Aba: revisões',aba_cen:'Aba: cenários',aba_quant:'Aba: quantitativo',ia_abrir:'IA: abriu o assistente',ia_gerar:'IA: pediu geração',ia_falhou:'IA: geração recusada',orc_gerar:'Orçamento SINAPI gerado',orc_atualizar_mes:'Orçamento atualizado de mês',projeto_novo:'Projeto novo',erro:'Erros do programa'}[k]||(k.startsWith('exportar_')?'Exportou '+k.slice(9).toUpperCase():k));
 const hora=Array.from({length:24},(_,h)=>({k:h+'h',v:0}));S.forEach(s=>{hora[new Date(s.inicio).getHours()].v++;});
 const semDado=!D.sessoes.length;const dlt=(a,b,inv)=>{if(!b)return '';const d=(a-b)/b*100;return `<i>${d>=0?'▲':'▼'} ${fmt(Math.abs(d),0)}% vs. ${PER} dias anteriores</i>`;};
 const kp=(t,v,sub,cls)=>`<div class="kp ${cls||''}"><small>${t}</small><b>${v}</b>${sub||''}</div>`;
 const iaMes=U.reduce((a,u)=>a+u.ia,0);const semProj=U.filter(u=>!u.nProj).length;const umaVez=U.filter(u=>u.nSess===1).length;
 $('#corpo').innerHTML=`<div class="bar"><div><label>Período</label><select id="per">${[7,30,90,180].map(d=>`<option value="${d}"${d===PER?' selected':''}>Últimos ${d} dias</option>`).join('')}</select></div></div>
 ${semDado?'<div class="box av">Ainda não há sessões registradas. O registro de uso começa quando a nova versão do programa estiver no ar e as tabelas/funções do servidor forem publicadas.</div>':''}
 <h2>Usuários e receita</h2><div class="kpis">
  ${kp('Usuários cadastrados',fmt(U.length),`<i>${fmt(U.filter(u=>!u.cadOk).length)} com cadastro incompleto</i>`)}
  ${kp('Novos no período',fmt(novos.length),dlt(novos.length,novosAnt.length),novos.length>=novosAnt.length?'up':'dn')}
  ${kp('Pro pagantes',fmt(pagantes.length),`<i>${pct(pagantes.length,U.length)} dos usuários</i>`)}
  ${kp('Pro cortesia / sem pagamento',fmt(cort.length))}
  ${kp('Gratuitos',fmt(gratis.length))}
  ${kp('Bloqueados',fmt(bloq.length))}
  ${kp('Receita mensal recorrente (MRR)',brl(mrr),`<i>anual equivalente ${brl(mrr*12)}</i>`)}
  ${kp('Cancelamentos no período',fmt(canc.length),`<i>${pct(canc.length,pagantes.length+canc.length)} dos pagantes</i>`,canc.length?'dn':'')}
  ${kp('Conversão Free → Pro',pct(pagantes.length,U.length-cort.length-bloq.length))}
 </div>
 <h2>Uso</h2><div class="kpis">
  ${kp('Ativos no período',fmt(ativos.size),dlt(ativos.size,ativosAnt.size),ativos.size>=ativosAnt.size?'up':'dn')}
  ${kp('Ativos hoje / 7 dias / 30 dias',`${fmt(dauHoje)} / ${fmt(wau)} / ${fmt(mau)}`,`<i>aderência diária ${pct(dauHoje,mau)}</i>`)}
  ${kp('Sessões no período',fmt(S.length))}
  ${kp('Tempo ativo total',hm(segT),dlt(segT,segAnt),segT>=segAnt?'up':'dn')}
  ${kp('Tempo médio por sessão',hm(S.length?segT/S.length:0))}
  ${kp('Tempo médio por usuário ativo',hm(ativos.size?segT/ativos.size:0))}
  ${kp('Retenção',pct(retidos,ativosAnt.size),`<i>ativos do período anterior que voltaram</i>`)}
  ${kp('Usaram só uma vez',fmt(umaVez),`<i>${pct(umaVez,U.length)} dos usuários</i>`)}
  ${kp('Projetos na nuvem',fmt(D.projetos.length),`<i>${fmt(D.projetos.length/(U.length||1),1)} por usuário · ${fmt(semProj)} sem projeto</i>`)}
  ${kp('Gerações de IA no mês',fmt(iaMes))}
 </div>
 <div class="grid2" style="margin-top:14px">
  <div class="pn"><h3>Usuários ativos por dia</h3>${barras(dau,[dau[0]&&dau[0].k,dau.length&&dau[dau.length-1].k],v=>fmt(v)+' usuário(s)','Usuários ativos por dia')}</div>
  <div class="pn"><h3>Horas de uso por dia</h3>${barras(hd,[hd[0]&&hd[0].k,hd.length&&hd[hd.length-1].k],v=>fmt(v,1)+' h','Horas de uso por dia')}</div>
  <div class="pn"><h3>Novos usuários por semana (12 semanas)</h3>${barras(sem,['há 12 semanas','esta semana'],v=>fmt(v)+' novo(s)','Novos usuários por semana')}</div>
  <div class="pn"><h3>Horário de início das sessões</h3>${barras(hora,['0h','23h'],v=>fmt(v)+' sessão(ões)','Horário de uso')}</div>
  <div class="pn"><h3>Cidades onde mais usam (tempo ativo)</h3>${hbar(conta(S.filter(s=>s.cidade),s=>s.cidade+(s.uf?' – '+s.uf:''),s=>s.segundos||0),hm)}</div>
  <div class="pn"><h3>Estados (tempo ativo)</h3>${hbar(conta(S.filter(s=>s.uf),s=>s.pais&&s.pais!=='BR'?s.uf+' ('+s.pais+')':s.uf,s=>s.segundos||0),hm,27)}</div>
  <div class="pn"><h3>Recursos mais usados</h3>${hbar(Object.entries(ev).filter(([k])=>k!=='erro').sort((a,b)=>b[1]-a[1]).map(([k,v])=>[NOME_EV(k),v]),v=>fmt(v)+'×',14)}</div>
  <div class="pn"><h3>Dispositivo · sistema · navegador (sessões)</h3>${hbar(conta(S,s=>s.dispositivo),v=>fmt(v),5)}<div style="height:10px"></div>${hbar(conta(S,s=>s.sistema),v=>fmt(v),6)}<div style="height:10px"></div>${hbar(conta(S,s=>s.navegador),v=>fmt(v),6)}</div>
  <div class="pn"><h3>Profissões (cadastro)</h3>${hbar(conta(U,u=>u.prof||'(não informou)'),v=>fmt(v),10)}</div>
  <div class="pn"><h3>Estados do cadastro</h3>${hbar(conta(U,u=>u.ufCad||'(não informou)'),v=>fmt(v),27)}</div>
 </div>
 <h2>Usuários mais ativos no período</h2>${tabelaUsu(U.filter(u=>ativos.has(u.id)).map(u=>Object.assign({},u,{segP:S.filter(s=>s.user_id===u.id).reduce((a,s)=>a+(s.segundos||0),0)})).sort((a,b)=>b.segP-a.segP).slice(0,15),true)}`;
 $('#per').onchange=e=>{PER=+e.target.value;telaDash();};ligaLinhas();}

/* ---------- USUÁRIOS ---------- */
let FU={q:'',pl:'todos',ord:'ult',dir:-1,sel:null};
function linhaPlano(u){return u.plano==='bloqueado'?'<span class="bdg b-blo">bloqueado</span>':u.plano==='pro'?`<span class="bdg b-pro">Pro ${u.ciclo||''}</span>`:u.plano==='cortesia'?`<span class="bdg b-cor">${u.p.cortesia_ate?'Pro cortesia':'Pro sem pagamento'}</span>`:'<span class="bdg b-fre">Gratuito</span>';}
function tabelaUsu(L,curta){if(!L.length)return '<div class="tw"><div class="vazio">Nenhum usuário.</div></div>';
 const th=(k,n,cl)=>`<th class="${cl||''}" data-ord="${k}">${n}${FU.ord===k&&!curta?(FU.dir>0?' ▲':' ▼'):''}</th>`;
 return `<div class="tw"><table class="t"><thead><tr>${th('nome','Usuário')}${th('prof','Profissão')}${th('plano','Plano')}${th('criado','Cadastro')}${th('ult','Último uso')}${th('nSess','Sessões','n')}${th(curta?'segP':'seg',curta?'Tempo no período':'Tempo total','n')}${th('cidUso','Onde mais usa')}${th('nProj','Projetos','n')}${th('ia','IA no mês','n')}</tr></thead><tbody>
 ${L.map(u=>`<tr class="cl${FU.sel===u.id?' sel':''}" data-u="${u.id}"><td><b>${esc(u.nome||'(sem nome)')}</b><br><span class="m" style="font-size:12.5px">${esc(u.email)}</span></td><td>${esc(u.prof)}</td><td>${linhaPlano(u)}${u.validade&&u.plano!=='gratis'?`<br><span class="m" style="font-size:12px">até ${dt(u.validade)}</span>`:''}</td><td>${dt(u.criado)}</td><td>${dth(u.ult)}</td><td class="n">${fmt(u.nSess)}</td><td class="n">${hm(curta?u.segP:u.seg)}</td><td>${esc(u.cidUso||u.cidCad||'—')}${!u.cidUso&&u.cidCad?' <span class="m" style="font-size:11px">(cadastro)</span>':''}</td><td class="n">${fmt(u.nProj)}</td><td class="n">${fmt(u.ia)}</td></tr>`).join('')}</tbody></table></div>`;}
function ligaLinhas(){$$('tr[data-u]').forEach(tr=>tr.onclick=()=>{FU.sel=tr.dataset.u;TAB='usu';history.replaceState(null,'','#usu');render();});}
async function telaUsu(){carregando('Carregando usuários…');let D;try{D=await dados();}catch(e){return falha(e);}
 const q=norm(FU.q);let L=D.U.filter(u=>(!q||norm(u.nome+' '+u.email+' '+u.prof+' '+u.emp+' '+u.cidCad+' '+u.cidUso).includes(q))&&(FU.pl==='todos'||u.plano===FU.pl||(FU.pl==='semcad'&&!u.cadOk)||(FU.pl==='inativo'&&(!u.ult||Date.now()-new Date(u.ult)>30*DIA))));
 const k=FU.ord;L.sort((a,b)=>{const x=a[k],y=b[k];return (x==null||x==='')?1:(y==null||y==='')?-1:(x>y?1:x<y?-1:0)*FU.dir;});
 $('#corpo').innerHTML=`<div class="bar"><div style="flex:1;min-width:220px"><label>Buscar (nome, e-mail, profissão, empresa, cidade)</label><input class="i" id="uq" style="width:100%" value="${esc(FU.q)}"></div>
 <div><label>Filtro</label><select id="upl">${[['todos','Todos'],['pro','Pro pagantes'],['cortesia','Pro cortesia'],['gratis','Gratuitos'],['bloqueado','Bloqueados'],['inativo','Sem uso há 30 dias'],['semcad','Cadastro incompleto']].map(([v,n])=>`<option value="${v}"${FU.pl===v?' selected':''}>${n}</option>`).join('')}</select></div>
 <div><label>&nbsp;</label><button class="btn xs ln" id="ucsv">Baixar lista (CSV)</button></div></div>
 <div class="m" style="font-size:13px;margin-bottom:6px">${fmt(L.length)} usuário(s). Clique numa linha para ver o detalhe e as ações.</div><div id="udet"></div>${tabelaUsu(L)}`;
 const uq=$('#uq');let tm;uq.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{FU.q=uq.value;telaUsu().then(()=>{const e=$('#uq');e.focus();e.setSelectionRange(e.value.length,e.value.length);});},300);};
 $('#upl').onchange=e=>{FU.pl=e.target.value;telaUsu();};
 $$('th[data-ord]').forEach(th=>th.onclick=()=>{const k=th.dataset.ord;if(FU.ord===k)FU.dir*=-1;else{FU.ord=k;FU.dir=['nome','prof','cidUso','plano'].includes(k)?1:-1;}telaUsu();});
 $$('tr[data-u]').forEach(tr=>tr.onclick=()=>{FU.sel=FU.sel===tr.dataset.u?null:tr.dataset.u;telaUsu();});
 $('#ucsv').onclick=()=>{const cols=['nome','email','prof','emp','tel','cidCad','plano','validade','criado','ult','nSess','seg','cidUso','nProj','ia','novid'];
  const csv=[['Nome','E-mail','Profissão','Empresa','Telefone','Cidade (cadastro)','Plano','Validade','Cadastro','Último uso','Sessões (180 dias)','Segundos ativos (180 dias)','Onde mais usa','Projetos','IA no mês','Aceita novidades'].join(';')].concat(L.map(u=>cols.map(c=>'"'+String(u[c]==null?'':u[c]).replace(/"/g,'""')+'"').join(';'))).join('\r\n');
  const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['﻿'+csv],{type:'text/csv'}));a.download='usuarios-plantacalc.csv';a.click();};
 if(FU.sel&&D.byId[FU.sel])detalhe(D.byId[FU.sel]);}
async function detalhe(u){const el=$('#udet');const hoje=new Date();const mais=d=>new Date(Math.max(hoje,u.validade?new Date(u.validade):0)+d*DIA).toISOString().slice(0,10);
 el.innerHTML=`<div class="det"><div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap"><div><h2 style="margin:0">${esc(u.nome||'(sem nome)')} ${linhaPlano(u)}</h2><div class="m">${esc(u.email)}${u.confirmado?'':' · <b>e-mail não confirmado</b>'}</div></div><button class="btn xs ln" id="dX">Fechar</button></div>
 <div class="grid2" style="margin-top:10px"><div class="kv"><span>Profissão</span><div>${esc(u.prof||'—')}</div><span>Empresa</span><div>${esc(u.emp||'—')}</div><span>Telefone</span><div>${esc(u.tel||'—')}</div><span>Cidade (cadastro)</span><div>${esc(u.cidCad||'—')}</div><span>Aceita novidades</span><div>${u.novid?'sim':'não'}</div><span>Cadastro em</span><div>${dth(u.criado)}</div><span>Último login</span><div>${dth(u.ultLogin)}</div></div>
 <div class="kv"><span>Plano</span><div>${linhaPlano(u)} ${u.ciclo?esc(u.ciclo):''}</div><span>Validade</span><div>${dt(u.validade)}</div><span>Mercado Pago</span><div>${esc(u.mp||'—')}</div><span>Cortesia</span><div>${u.p.cortesia_ate?'até '+dt(u.p.cortesia_ate)+(u.p.cortesia_obs?' — '+esc(u.p.cortesia_obs):''):'—'}</div><span>Uso (180 dias)</span><div>${fmt(u.nSess)} sessões · ${hm(u.seg)}</div><span>Onde mais usa</span><div>${esc(u.cidUso||'—')}</div><span>IA no mês</span><div>${fmt(u.ia)}</div></div></div>
 <h3>Ações</h3><div class="bar"><div><label>Dar / estender Pro de cortesia até</label><input class="i" type="date" id="dAte" value="${mais(30)}" min="${hoje.toISOString().slice(0,10)}"></div>
  <div><label>&nbsp;</label><div style="display:flex;gap:4px">${[30,90,365].map(d=>`<button class="btn xs ln" data-mais="${d}">+${d} dias</button>`).join('')}</div></div>
  <div style="flex:1;min-width:180px"><label>Motivo (opcional)</label><input class="i" id="dObs" style="width:100%" placeholder="ex.: parceria, teste, cortesia" value="${esc(u.p.cortesia_obs||'')}"></div>
  <div><label>&nbsp;</label><button class="btn xs pri" id="dPro">Dar Pro</button></div>
  ${u.p.cortesia_ate?'<div><label>&nbsp;</label><button class="btn xs rd" id="dTira">Remover cortesia</button></div>':''}</div>
 <div class="bar"><a class="btn xs ln" href="mailto:${encodeURIComponent(u.email)}?subject=${encodeURIComponent('PlantaCalc')}">Enviar e-mail</a>${u.id===user.id?'':`<button class="btn xs ${u.plano==='bloqueado'?'ln':'rd'}" id="dBlo">${u.plano==='bloqueado'?'Desbloquear acesso':'Bloquear acesso'}</button>`}</div>
 <div id="dMsg"></div><h3>Sessões e projetos</h3><div id="dSes" class="m">Carregando…</div></div>`;
 $('#dX').onclick=()=>{FU.sel=null;telaUsu();};
 $$('[data-mais]').forEach(b=>b.onclick=()=>{$('#dAte').value=mais(+b.dataset.mais);});
 const msg=(t,ok)=>{$('#dMsg').innerHTML=`<div class="box ${ok?'ok':'er'}">${esc(t)}</div>`;};
 const acao=async(fn,ok)=>{try{await fn();msg(ok,true);DADOS=null;await dados();setTimeout(telaUsu,900);}catch(e){msg('Não foi possível: '+(e.message||e));}};
 $('#dPro').onclick=()=>{const v=$('#dAte').value;if(!v)return;if(!confirm(`Dar Pro de cortesia a ${u.email} até ${new Date(v+'T23:59').toLocaleDateString('pt-BR')}?`))return;acao(()=>api('pro',{id:u.id,ate:v+'T23:59:59-03:00',obs:$('#dObs').value}),'Pro liberado.');};
 if($('#dTira'))$('#dTira').onclick=()=>{if(!confirm('Remover a cortesia? Se a pessoa não tiver assinatura paga, volta para o plano gratuito.'))return;acao(()=>api('pro',{id:u.id,ate:null}),'Cortesia removida.');};
 if($('#dBlo'))$('#dBlo').onclick=()=>{const on=u.plano!=='bloqueado';if(!confirm(on?`Bloquear o acesso de ${u.email}? A pessoa não consegue entrar até ser desbloqueada; os dados ficam guardados.`:`Desbloquear ${u.email}?`))return;acao(()=>api('bloquear',{id:u.id,on}),on?'Acesso bloqueado.':'Acesso liberado.');};
 try{const r=await api('sessoes',{id:u.id});const ev=s=>Object.entries(s.eventos||{}).sort((a,b)=>b[1]-a[1]).slice(0,5).map(([k,v])=>k+' '+v).join(', ');
  $('#dSes').innerHTML=`<div class="grid2"><div class="tw" style="max-height:340px;overflow:auto"><table class="t"><thead><tr><th>Início</th><th class="n">Tempo ativo</th><th>Local</th><th>Aparelho</th><th>Recursos</th></tr></thead><tbody>${r.sessoes.map(s=>`<tr><td>${dth(s.inicio)}</td><td class="n">${hm(s.segundos)}</td><td>${esc([s.cidade,s.uf].filter(Boolean).join(' – ')||'—')}</td><td>${esc([s.dispositivo,s.sistema,s.navegador].filter(Boolean).join(' · '))}</td><td style="font-size:12px">${esc(ev(s))}</td></tr>`).join('')||'<tr><td colspan="5" class="vazio">Sem sessões registradas.</td></tr>'}</tbody></table></div>
  <div class="tw" style="max-height:340px;overflow:auto"><table class="t"><thead><tr><th>Projeto</th><th>Criado</th><th>Atualizado</th><th class="n">Tamanho</th></tr></thead><tbody>${r.projetos.map(p=>`<tr><td>${esc(p.nome)}</td><td>${dt(p.criado)}</td><td>${dth(p.atualizado)}</td><td class="n">${fmt((p.tamanho||0)/1024)} kB</td></tr>`).join('')||'<tr><td colspan="4" class="vazio">Nenhum projeto na nuvem.</td></tr>'}</tbody></table></div></div>`;}
 catch(e){$('#dSes').textContent='Não foi possível carregar: '+e.message;}}

/* ---------- ATENÇÃO ---------- */
function atencaoN(){let n=0;if(ERR)n+=grupoErros().filter(g=>Date.now()-new Date(g.ult)<7*DIA).length;if(PAG)n+=pagProblemas().length;if(OBS)n+=grupoObs().filter(g=>g.tipo!=='pendente').length;return n;}
function grupoErros(){const g={};for(const e of ERR||[]){const k=e.msg;const o=g[k]=g[k]||{msg:k,n:0,us:new Set(),ult:e.quando,pri:e.quando,build:e.build,tela:e.tela,pilha:e.pilha};o.n++;if(e.user_id)o.us.add(e.user_id);if(e.quando>o.ult)o.ult=e.quando;if(e.quando<o.pri)o.pri=e.quando;}return Object.values(g).sort((a,b)=>b.ult.localeCompare(a.ult));}
function pagProblemas(){if(!PAG)return [];const agora=Date.now();const out=[];
 for(const p of PAG.pagamentos){if(p.status==='rejected')out.push({q:p.criado,ref:p.ref,o:`Pagamento recusado (${p.metodo||p.tipo}) — ${p.detalhe||''}`,v:p.valor});
  else if(p.status==='pending'&&p.expira&&new Date(p.expira)<agora)out.push({q:p.criado,ref:p.ref,o:`Pix gerado e não pago (expirou ${dth(p.expira)})`,v:p.valor});
  else if(['refunded','charged_back','cancelled'].includes(p.status))out.push({q:p.criado,ref:p.ref,o:`Pagamento ${p.status==='refunded'?'estornado':p.status==='charged_back'?'contestado (chargeback)':'cancelado'}`,v:p.valor});}
 for(const a of PAG.assinaturas||[])if(['cancelled','paused'].includes(a.status))out.push({q:a.alterado||a.criado,ref:a.ref,o:`Assinatura ${a.status==='cancelled'?'cancelada':'pausada'} (${a.freq===12?'anual':'mensal'})`,v:a.valor});
 if(DADOS)for(const u of DADOS.U)if(u.plano==='pro'&&u.validade){const d=(new Date(u.validade)-agora)/DIA;if(d<7)out.push({q:u.validade,ref:u.id,o:`Pro vence em ${fmt(Math.max(0,d),0)} dia(s) (${dt(u.validade)}) — ${u.mp==='pix'?'Pix não renova sozinho':'confira a renovação'}`,v:null});}
 return out.sort((a,b)=>String(b.q).localeCompare(String(a.q)));}
function grupoObs(){const g={};for(const o of OBS||[]){const k=o.tipo+'|'+(o.norm||o.chave);const x=g[k]=g[k]||{tipo:o.tipo,norm:o.norm||o.chave,regra:o.regra,descr:o.descr,un:o.un,n:0,us:new Set(),uf:{},comps:{},ult:o.quando};x.n++;x.us.add(o.user_id);if(o.uf)x.uf[o.uf]=(x.uf[o.uf]||0)+1;if(o.regra)x.regra=o.regra;
  if(o.tipo==='troca'&&Array.isArray(o.comps)){const c=o.comps.map(c=>c.cod+(c.f&&c.f!==1?'×'+c.f:'')).join('+');x.comps[c]=(x.comps[c]||0)+1;}if(o.tipo==='manual'&&o.comps&&o.comps.p){(x.precos=x.precos||[]).push(+o.comps.p);}if(o.quando>x.ult)x.ult=o.quando;}
 return Object.values(g).sort((a,b)=>b.us.size-a.us.size||b.n-a.n);}
async function telaAten(){carregando('Carregando itens de atenção…');
 try{await dados();}catch(e){return falha(e);}
 const res=await Promise.allSettled([ERR?Promise.resolve():api('erros').then(r=>{ERR=r.erros;}),OBS?Promise.resolve():api('obs').then(r=>{OBS=r.obs;}),PAG?Promise.resolve():api('pagamentos').then(r=>{PAG=r;})]);
 const fal=res.filter(r=>r.status==='rejected').map(r=>r.reason.message);const nome=ref=>{const u=DADOS.byId[ref];return u?esc(u.nome||u.email)+'<br><span class="m" style="font-size:12px">'+esc(u.email)+'</span>':esc(ref||'—');};
 const pg=pagProblemas(),er=grupoErros(),ob=grupoObs();const TIPO={troca:'Trocaram o vínculo',sem:'Marcaram “sem equivalente”',incl:'Marcaram “já incluído”',manual:'Digitaram preço',pendente:'Ficou sem preço'};
 $('#corpo').innerHTML=`${fal.length?`<div class="box av">Alguns dados não carregaram: ${fal.map(esc).join(' · ')}</div>`:''}
 <h2>Pagamentos e assinaturas (60 dias)</h2>${pg.length?`<div class="tw"><table class="t"><thead><tr><th>Quando</th><th>Usuário</th><th>Ocorrência</th><th class="n">Valor</th></tr></thead><tbody>${pg.map(p=>`<tr${DADOS.byId[p.ref]?` class="cl" data-u="${p.ref}"`:''}><td>${dth(p.q)}</td><td>${nome(p.ref)}</td><td>${esc(p.o)}</td><td class="n">${p.v!=null?brl(p.v):''}</td></tr>`).join('')}</tbody></table></div>`:'<div class="box ok">Nenhum pagamento com problema.</div>'}
 <h2>Erros do programa</h2>${er.length?`<div class="tw"><table class="t"><thead><tr><th>Último</th><th>Mensagem</th><th class="n">Vezes</th><th class="n">Usuários</th><th>Tela</th><th>Versão</th></tr></thead><tbody>${er.slice(0,80).map((g,i)=>`<tr class="cl" data-err="${i}"><td>${dth(g.ult)}</td><td><b>${esc(g.msg.slice(0,160))}</b><div id="pl${i}" hidden><pre class="pl">${esc(g.pilha||'')}</pre><div class="m" style="font-size:12px">primeira vez: ${dth(g.pri)}</div></div></td><td class="n">${g.n}</td><td class="n">${g.us.size}</td><td>${esc(g.tela||'')}</td><td class="mono">${esc(g.build||'')}</td></tr>`).join('')}</tbody></table></div>`:'<div class="box ok">Nenhum erro registrado.</div>'}
 <h2>Orçamento SINAPI — o que os usuários estão corrigindo</h2>
 <p class="m" style="font-size:13.5px">Agrupado por tipo de linha do quantitativo. Trocas feitas por vários usuários são boas candidatas a virar o vínculo padrão.</p>
 ${ob.length?`<div class="tw"><table class="t"><thead><tr><th>Ocorrência</th><th>Linha do quantitativo</th><th class="n">Usuários</th><th>Detalhe</th><th>Estados</th><th></th></tr></thead><tbody>${ob.slice(0,200).map((g,i)=>`<tr><td>${esc(TIPO[g.tipo]||g.tipo)}</td><td><b>${esc(g.descr||'')}</b> <span class="m">(${esc(g.un||'')})</span><br><span class="mono m">${esc(g.norm)}${g.regra?' · regra '+esc(g.regra):''}</span></td><td class="n">${g.us.size}</td>
  <td style="font-size:12.5px">${g.tipo==='troca'?Object.entries(g.comps).sort((a,b)=>b[1]-a[1]).map(([c,n])=>`${esc(c)} (${n})`).join('<br>'):g.tipo==='manual'&&g.precos?'preço digitado: mediana '+brl(g.precos.sort((a,b)=>a-b)[g.precos.length>>1]):''}</td><td style="font-size:12px">${esc(Object.entries(g.uf).sort((a,b)=>b[1]-a[1]).map(([u,n])=>u+' '+n).join(', '))}</td>
  <td style="white-space:nowrap">${g.regra?`<button class="btn xs ln" data-ovin="${i}">Abrir vínculo</button> `:''}<button class="btn xs ln" data-otrat="${i}">Tratado</button></td></tr>`).join('')}</tbody></table></div>`:'<div class="box ok">Nenhuma observação dos usuários ainda.</div>'}`;
 ligaLinhas();$$('tr[data-err]').forEach(tr=>tr.onclick=()=>{const d=$('#pl'+tr.dataset.err);d.hidden=!d.hidden;});
 $$('[data-ovin]').forEach(b=>b.onclick=()=>{const g=ob[+b.dataset.ovin];VIN.f=g.regra;VIN.abre=g.regra;const top=Object.entries(g.comps).sort((a,b)=>b[1]-a[1])[0];VIN.sugestao=g.tipo==='troca'&&top?top[0]:null;VIN.sugSem=g.tipo==='sem';TAB='vinc';history.replaceState(null,'','#vinc');render();});
 $$('[data-otrat]').forEach(b=>b.onclick=async()=>{const g=ob[+b.dataset.otrat];if(!confirm('Marcar como tratado? As observações deste item serão apagadas da lista.'))return;try{await api('obs_apagar',{norm:g.norm,tipo:g.tipo});OBS=null;telaAten();}catch(e){alert(e.message);}});}

/* ---------- VÍNCULOS SINAPI (padrão global, versionado) ---------- */
const VIN={carregado:false,mapa:[],glob:{regras:{},extras:[]},cat:null,ufd:null,uf:'MG',mes:null,f:'',st:'todos',abre:null,sugestao:null,sugSem:false,busca:null};
async function vinCarrega(){if(VIN.carregado)return;const idx=await indice();VIN.mes=idx.atual;
 const [m,g]=await Promise.all([fetch('sinapi_mapa.json?t='+Date.now()).then(r=>r.ok?r.json():[]),fetch(pubURL('vinculos.json')+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}))]);
 VIN.mapa=m;VIN.glob=Object.assign({regras:{},extras:[]},g);
 if(VIN.mes){const v='?v='+((idx.meses[VIN.mes]||{}).v||1);VIN.cat=await (await fetch(pubURL(VIN.mes+'/catalogo.json'+v))).json();await vinUF(VIN.uf);VIN.lista=Object.entries(VIN.cat.c).map(([cod,v])=>({cod,desc:v[0],un:v[1],n:norm(v[0])}));}
 VIN.carregado=true;}
async function vinUF(uf){VIN.uf=uf;const idx=await indice();const v='?v='+((idx.meses[VIN.mes]||{}).v||1);VIN.ufd=await (await fetch(pubURL(VIN.mes+'/'+uf+'.json'+v))).json();}
function vinAtual(r){const vs=(VIN.glob.regras||{})[r.id]||[];const v=vs.length?vs[vs.length-1]:null;return v&&!v.fabrica?Object.assign({},r,{comps:v.comps,sem:v.sem,incl:v.incl,obs:v.obs,alterado:v.desde}):r;}
function preco(cod){if(!VIN.ufd)return null;cod=String(cod);if(cod[0]==='I'){const v=VIN.ufd.i[cod.slice(1)];return v?v[0]:null;}const v=VIN.ufd.c[cod];return v?v[0]:null;}
function descCod(cod){cod=String(cod);if(!VIN.cat)return '';const c=cod[0]==='I'?VIN.cat.i[cod.slice(1)]:VIN.cat.c[cod];return c?c[0]+' ('+c[1]+')':'(código não existe neste mês)';}
async function telaVinc(){carregando('Carregando vínculos…');try{await vinCarrega();}catch(e){return falha(e);}
 if(!VIN.mes){$('#corpo').innerHTML='<div class="box av">Publique um mês do SINAPI (aba Base SINAPI) para editar os vínculos.</div>';return;}
 if(!VIN.mapa.length){$('#corpo').innerHTML='<div class="box er">Não encontrei o arquivo de vínculos padrão (sinapi_mapa.json) no site.</div>';return;}
 const q=norm(VIN.f);const L=VIN.mapa.map(vinAtual).filter(r=>{const st=r.incl?'incl':r.sem?'sem':'ok';
  return (VIN.st==='todos'||VIN.st===st||(VIN.st==='alt'&&r.alterado)||(VIN.st==='uso'&&r.n>0))&&(!q||norm(r.id+' '+(r.ex||[]).join(' ')+' '+r.key+' '+(r.desc||'')+' '+(r.obs||'')+' '+(r.comps||[]).map(c=>c.cod).join(' ')).includes(q)||(VIN.abre===r.id));});
 const tot={ok:0,sem:0,incl:0,alt:0};VIN.mapa.map(vinAtual).forEach(r=>{tot[r.incl?'incl':r.sem?'sem':'ok']++;if(r.alterado)tot.alt++;});
 $('#corpo').innerHTML=`<p class="m" style="font-size:13.5px">Estes são os vínculos que o PlantaCalc sugere para cada tipo de linha do quantitativo. Uma alteração aqui vale para <b>orçamentos novos</b> e para os que forem <b>atualizados de mês</b>; os já feitos continuam com o vínculo que tinham. Cada alteração fica no histórico.</p>
 <div class="bar"><div style="flex:1;min-width:220px"><label>Buscar (descrição, código SINAPI, regra)</label><input class="i" id="vq" style="width:100%" value="${esc(VIN.f)}"></div>
 <div><label>Mostrar</label><select id="vst">${[['todos','Todos ('+VIN.mapa.length+')'],['uso','Usados nos projetos-modelo'],['ok','Com composição ('+tot.ok+')'],['sem','Sem equivalente ('+tot.sem+')'],['incl','Incluídos em outro ('+tot.incl+')'],['alt','Alterados por você ('+tot.alt+')']].map(([v,n])=>`<option value="${v}"${VIN.st===v?' selected':''}>${n}</option>`).join('')}</select></div>
 <div><label>Preços de</label><select id="vuf">${UFS.map(u=>`<option${u===VIN.uf?' selected':''}>${u}</option>`).join('')}</select></div><div><label>&nbsp;</label><span class="m" style="font-size:13px">SINAPI ${mesNome(VIN.mes)}, sem desoneração</span></div></div>
 <div class="tw"><table class="t"><thead><tr><th>Linha do quantitativo</th><th>Vínculo padrão</th><th class="n">Custo ${VIN.uf}</th><th></th></tr></thead><tbody>
 ${L.slice(0,300).map(r=>{const tot=r.comps?r.comps.reduce((a,c)=>{const p=preco(c.cod);return a==null||p==null?null:a+p*(c.f||1);},0):null;
  return `<tr><td style="max-width:380px"><b>${esc((r.ex||[])[0]||r.id)}</b> <span class="m">(${esc(r.un||'qualquer un.')})</span>${(r.ex||[]).length>1?`<div class="m" style="font-size:12px">também: ${esc(r.ex.slice(1,3).join(' · '))}</div>`:''}<div class="mono m" style="font-size:11.5px">${esc(r.id)} · ${esc(r.key)}${r.desc?' · /'+esc(r.desc)+'/':''}</div></td>
  <td style="font-size:13px">${r.incl?'<span class="bdg b-fre">incluído em outro item</span> '+esc(typeof r.incl==='string'?r.incl:''):r.sem?'<span class="bdg b-av">sem equivalente — usuário digita</span>':(r.comps||[]).map(c=>`<span class="mono">${esc(c.cod)}</span>${(c.f||1)!==1?' × '+fmt(c.f,4):''}${c.fdesc==='area'?' × área da descrição':''} — ${esc(descCod(c.cod).slice(0,140))}`).join('<br>')}
  <div class="m" style="font-size:12px;margin-top:3px">${esc(r.obs||'')}${r.alterado?' · <b>alterado em '+dth(r.alterado)+'</b>':''}</div>${VIN.abre===r.id?vinEditor(r):''}</td>
  <td class="n">${tot==null?'—':brl(tot)}</td><td><button class="btn xs ln" data-vab="${esc(r.id)}">${VIN.abre===r.id?'Fechar':'Alterar'}</button></td></tr>`;}).join('')}
 </tbody></table></div>${L.length>300?`<p class="m">Mostrando 300 de ${L.length}. Refine a busca.</p>`:''}`;
 const vq=$('#vq');let tm;vq.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{VIN.f=vq.value;telaVinc().then(()=>{const e=$('#vq');e.focus();e.setSelectionRange(e.value.length,e.value.length);});},300);};
 $('#vst').onchange=e=>{VIN.st=e.target.value;telaVinc();};$('#vuf').onchange=async e=>{await vinUF(e.target.value);telaVinc();};
 $$('[data-vab]').forEach(b=>b.onclick=()=>{VIN.abre=VIN.abre===b.dataset.vab?null:b.dataset.vab;VIN.ed=null;VIN.sugestao=null;VIN.sugSem=false;telaVinc();});
 if(VIN.abre)vinLigaEditor(VIN.mapa.find(r=>r.id===VIN.abre));}
function vinEditor(r){if(!VIN.ed||VIN.ed.id!==r.id){let comps=(r.comps||[]).map(c=>Object.assign({},c));
  if(VIN.sugestao)comps=VIN.sugestao.split('+').map(s=>{const [cod,f]=s.split('×');return {cod,f:+f||1};});
  VIN.ed={id:r.id,comps,modo:VIN.sugSem?'sem':r.incl?'incl':r.sem?'sem':'comps',incl:typeof r.incl==='string'?r.incl:'',obs:VIN.sugestao?'Ajustado a partir das trocas feitas pelos usuários.':r.obs||''};}
 const E=VIN.ed;const hist=(VIN.glob.regras||{})[r.id]||[];const res=VIN.busca||[];
 return `<div class="ed"><div class="bar" style="margin:0"><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="vm" value="comps"${E.modo==='comps'?' checked':''}> Composição(ões) SINAPI</label><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="vm" value="sem"${E.modo==='sem'?' checked':''}> Sem equivalente</label><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="radio" name="vm" value="incl"${E.modo==='incl'?' checked':''}> Incluído em outro item</label></div>
 ${E.modo==='comps'?`${E.comps.map((c,i)=>`<div class="cmp"><span class="mono">${esc(c.cod)}</span> ×<input class="i" data-cf="${i}" value="${String(c.f||1).replace('.',',')}"> ${c.fdesc==='area'?'× área':''}<span style="flex:1;font-size:12px">${esc(descCod(c.cod).slice(0,110))} — ${preco(c.cod)==null?'sem custo':brl(preco(c.cod))}</span><button class="btn xs rd" data-crm="${i}">tirar</button></div>`).join('')}
  <div style="margin-top:6px"><input class="i" id="vbq" style="width:100%" placeholder="Procurar composição para acrescentar (palavras ou código)"></div><div class="res" id="vbr"${res.length?'':' hidden'}>${res.map(x=>`<div data-cadd="${x.cod}"><b>${x.cod}</b> · ${esc(x.desc.slice(0,150))} <span class="m">(${esc(x.un)}) — ${x.p==null?'sem custo':brl(x.p)}</span></div>`).join('')}</div>`:''}
 ${E.modo==='incl'?`<input class="i" id="vinc" style="width:100%;margin-top:6px" placeholder="Em qual item está incluído (texto que o usuário vê)" value="${esc(E.incl)}">`:''}
 <input class="i" id="vobs" style="width:100%;margin-top:6px" placeholder="Observação que o usuário vê" value="${esc(E.obs)}">
 <div class="bar" style="margin:8px 0 0"><button class="btn xs pri" id="vsal">Salvar como padrão</button>${hist.length?'<button class="btn xs ln" id="vfab">Voltar ao padrão de fábrica</button>':''}<span id="vmsg" class="m" style="font-size:13px"></span></div>
 ${hist.length?`<div class="m" style="font-size:12px;margin-top:6px"><b>Histórico:</b> ${hist.slice().reverse().map(h=>`${dth(h.desde)} — ${h.fabrica?'padrão de fábrica':h.incl?'incluído':h.sem?'sem equivalente':(h.comps||[]).map(c=>c.cod+((c.f||1)!==1?'×'+c.f:'')).join('+')}`).join(' · ')}</div>`:''}</div>`;}
function vinLigaEditor(r){if(!r||!VIN.ed)return;const E=VIN.ed;
 $$('input[name=vm]').forEach(x=>x.onchange=()=>{E.modo=x.value;telaVinc();});
 $$('[data-cf]').forEach(x=>x.onchange=()=>{const v=parseFloat(x.value.replace(/\./g,'').replace(',','.'));if(v>0)E.comps[+x.dataset.cf].f=v;});
 $$('[data-crm]').forEach(x=>x.onclick=()=>{E.comps.splice(+x.dataset.crm,1);telaVinc();});
 const vo=$('#vobs');if(vo)vo.oninput=()=>{E.obs=vo.value;};const vi=$('#vinc');if(vi)vi.oninput=()=>{E.incl=vi.value;};
 const bq=$('#vbq');if(bq){let tm;bq.oninput=()=>{clearTimeout(tm);tm=setTimeout(()=>{const q=norm(bq.value).trim();const ws=q.split(/\s+/).filter(Boolean);const out=[];
  if(/^\d{3,7}$/.test(q)&&VIN.cat.c[q])out.push({cod:q,desc:VIN.cat.c[q][0],un:VIN.cat.c[q][1]});for(const x of VIN.lista){if(out.length>=40||!ws.length)break;if(x.cod!==q&&ws.every(w=>x.n.includes(w)))out.push(x);}
  VIN.busca=out.map(x=>Object.assign({},x,{p:preco(x.cod)}));const br=$('#vbr');br.hidden=!out.length;br.innerHTML=VIN.busca.map(x=>`<div data-cadd="${x.cod}"><b>${x.cod}</b> · ${esc(x.desc.slice(0,150))} <span class="m">(${esc(x.un)}) — ${x.p==null?'sem custo':brl(x.p)}</span></div>`).join('');ligaAdd();},250);};}
 const ligaAdd=()=>$$('[data-cadd]').forEach(x=>x.onclick=()=>{E.comps.push({cod:x.dataset.cadd,f:1});VIN.busca=null;telaVinc();});ligaAdd();
 const grava=async(ver)=>{const m=$('#vmsg');m.textContent='Salvando…';try{
   const g=await fetch(pubURL('vinculos.json')+'?t='+Date.now(),{cache:'no-store'}).then(r=>r.ok?r.json():{}).catch(()=>({}));const G=Object.assign({regras:{},extras:[]},g);
   G.regras[r.id]=(G.regras[r.id]||[]).concat([Object.assign({desde:new Date().toISOString(),por:user.email},ver)]);G.v=Date.now();
   await enviar('vinculos.json',G,'60');VIN.glob=G;VIN.ed=null;VIN.abre=null;VIN.sugestao=null;VIN.sugSem=false;telaVinc();}catch(e){m.textContent='Não foi possível salvar: '+e.message;}};
 $('#vsal').onclick=()=>{if(E.modo==='comps'&&!E.comps.length){$('#vmsg').textContent='Acrescente ao menos uma composição.';return;}
  grava(E.modo==='comps'?{comps:E.comps.map(c=>Object.assign({cod:String(c.cod),f:+c.f||1},c.fdesc?{fdesc:c.fdesc}:{})),obs:E.obs}:E.modo==='sem'?{sem:true,obs:E.obs}:{incl:E.incl||'Já incluído em outra composição deste orçamento.',obs:E.obs});};
 const fb=$('#vfab');if(fb)fb.onclick=()=>{if(confirm('Voltar este item ao vínculo de fábrica do PlantaCalc (para orçamentos novos)?'))grava({fabrica:true});};}

/* ---------- BASE SINAPI (envio mensal do ZIP) ---------- */
let R=null,confirmarSubst=false;
async function telaBase(){const I=await indice();const ms=Object.keys(I.meses||{}).sort().reverse();
 $('#corpo').innerHTML='<p class="m">Envie o arquivo ZIP do SINAPI em PDF (o mesmo que a CAIXA publica todo mês). O PlantaCalc lê os relatórios aqui mesmo no navegador, mostra um resumo por estado para você conferir e só publica depois da sua confirmação.</p>'+
 '<label class="drop" id="dz"><input type="file" id="fz" accept=".zip,.pdf" multiple hidden><b>Escolher o ZIP do SINAPI</b>ou arraste o arquivo para cá — também aceita os PDFs soltos</label>'+
 '<div id="prog" hidden><div class="m" id="st"></div><div class="barra"><i id="br"></i></div></div><div id="res"></div>'+
 '<h2>Meses publicados</h2>'+(ms.length?'<ul>'+ms.map(k=>{const m=I.meses[k];return '<li><b>'+mesNome(k)+'</b>'+(k===I.atual?' <span class="bdg b-pro">mês atual</span>':'')+' — '+m.ufs.length+' estados, publicado em '+new Date(m.publicado).toLocaleString('pt-BR')+'</li>';}).join('')+'</ul>':'<p class="m">Nenhum mês publicado ainda.</p>');
 const dz=$('#dz'),fz=$('#fz');fz.onchange=()=>fz.files.length&&ler([...fz.files]);
 dz.ondragover=e=>{e.preventDefault();dz.classList.add('on');};dz.ondragleave=()=>dz.classList.remove('on');dz.ondrop=e=>{e.preventDefault();dz.classList.remove('on');if(e.dataTransfer.files.length)ler([...e.dataTransfer.files]);};}
function prog(t,f){$('#prog').hidden=false;$('#st').textContent=t;if(f!=null)$('#br').style.width=Math.round(f*100)+'%';}
async function ler(files){$('#res').innerHTML='';$('#dz').hidden=true;
 try{let pdfs=[];
  for(const f of files){if(/\.zip$/i.test(f.name)){prog('Abrindo '+f.name+'…',0);const z=await JSZip.loadAsync(f);for(const n of Object.keys(z.files))if(/\.pdf$/i.test(n)&&!z.files[n].dir)pdfs.push({nome:n.split('/').pop(),get:()=>z.files[n].async('uint8array')});}
   else if(/\.pdf$/i.test(f.name))pdfs.push({nome:f.name,get:async()=>new Uint8Array(await f.arrayBuffer())});}
  if(!pdfs.length)throw new Error('Nenhum PDF encontrado no arquivo.');
  pdfs.sort((a,b)=>(/Analitico/i.test(b.nome)?1:0)-(/Analitico/i.test(a.nome)?1:0)||a.nome.localeCompare(b.nome));
  const rel=[];const t0=Date.now();
  for(let k=0;k<pdfs.length;k++){const p=pdfs[k];prog('Lendo '+(k+1)+' de '+pdfs.length+': '+p.nome,k/pdfs.length);
   const r=await P.lerRelatorio(pdfjs,await p.get(),(pg,tot)=>prog('Lendo '+(k+1)+' de '+pdfs.length+': '+p.nome+' — página '+pg+' de '+tot,(k+pg/tot)/pdfs.length));r.nome=p.nome;rel.push(r);await new Promise(o=>setTimeout(o,0));}
  prog('Leitura concluída em '+Math.round((Date.now()-t0)/1000)+' s. Conferindo…',1);R=montar(rel);resumo();
 }catch(e){$('#res').innerHTML='<div class="box er">'+esc(e.message||e)+'</div><button class="btn sec sm" id="bV">Escolher outro arquivo</button>';$('#bV').onclick=telaBase;}}
function montar(rel){const erros=[],avisos=[];const an=rel.find(r=>r.meta.tipo==='analitico');const comp={},ins={};const desconhecidos=[];
 for(const r of rel){if(r.meta.tipo==='composicoes'&&r.meta.uf)comp[r.meta.uf]=r;else if(r.meta.tipo==='insumos'&&r.meta.uf)ins[r.meta.uf]=r;else if(r.meta.tipo!=='analitico')desconhecidos.push(r.nome);}
 const meses=[...new Set(rel.map(r=>r.meta.mes).filter(Boolean))];
 if(meses.length!==1)erros.push(meses.length?'Os arquivos são de meses diferentes: '+meses.join(', ')+'.':'Não foi possível identificar o mês de referência.');
 const mes=meses[0];const chave=mesChave(mes);
 if(!an)erros.push('Falta o Relatório Analítico de Composições (sem ele não há composição analítica nem horas de mão de obra).');
 if(desconhecidos.length)avisos.push('Arquivos ignorados (não são relatórios SINAPI reconhecidos): '+desconhecidos.join(', ')+'.');
 const ufs=UFS.filter(u=>comp[u]&&ins[u]);const so=UFS.filter(u=>(comp[u]||ins[u])&&!(comp[u]&&ins[u]));if(so.length)erros.push('Estados com só um dos dois relatórios (composições e insumos): '+so.join(', ')+'.');
 const faltam=UFS.filter(u=>!comp[u]&&!ins[u]);if(faltam.length)avisos.push('Estados ausentes neste envio: '+faltam.join(', ')+'.');
 if(!comp.SP||!ins.SP)erros.push('Falta São Paulo — ele é a referência quando um estado não tem preço.');
 for(const r of rel)if(r.falhas&&r.falhas.length)avisos.push(r.nome+': '+r.falhas.length+' linha(s) não reconhecida(s), ex.: “'+r.falhas[0].linha.slice(0,90)+'” (pág. '+r.falhas[0].pag+').');
 const cat={mes,c:{},i:{},a:{}};const base=comp.SP||Object.values(comp)[0],bi=ins.SP||Object.values(ins)[0];
 if(base)base.itens.forEach(c=>cat.c[c.cod]=[c.desc,c.un,c.grupo]);if(bi)bi.itens.forEach(i=>cat.i[i.cod]=[i.desc,i.un]);
 if(an)an.itens.forEach(a=>{cat.a[a.cod]=a.itens.map(i=>[i.t,i.cod,i.coef]);if(!cat.c[a.cod])cat.c[a.cod]=[a.desc,a.un,a.grupo];});
 for(const u of ufs){const n=comp[u].itens.length;if(base&&n!==base.itens.length)avisos.push(u+': '+n+' composições (SP tem '+base.itens.length+').');}
 const sp={c:{},i:{}};if(comp.SP)comp.SP.itens.forEach(c=>sp.c[c.cod]=c);if(ins.SP)ins.SP.itens.forEach(i=>sp.i[i.cod]=i);
 const arq={};const linhas=[];
 for(const u of ufs){const M=comp[u].meta,o={uf:u,mes,localidade:M.localidade||'',emissao:M.emissao||'',encargos:M.encargos,c:{},i:{}};let cSP=0,iSP=0,cNada=0,iNada=0;
  for(const c of comp[u].itens){let v=[c.sem,c.com,c.asSem,c.asCom];if(c.sem==null&&c.com==null){const s=sp.c[c.cod];if(s&&(s.sem!=null||s.com!=null)){v=[s.sem,s.com,100,100,1];cSP++;}else{cNada++;continue;}}o.c[c.cod]=v;}
  for(const i of ins[u].itens){let v=[i.sem,i.com];if(i.sem==null&&i.com==null){const s=sp.i[i.cod];if(s&&(s.sem!=null||s.com!=null)){v=[s.sem,s.com,1];iSP++;}else{iNada++;continue;}}o.i[i.cod]=v;}
  arq[u]=o;linhas.push({u,loc:M.localidade,nc:comp[u].itens.length,cSP,cAS:comp[u].itens.filter(c=>c.asSem).length,cNada,ni:ins[u].itens.length,iSP,enc:M.encargos,ok:conferir(cat,o)});}
 return {mes,chave,cat,arq,ufs,linhas,erros,avisos,an:an?{n:an.itens.length,itens:an.itens.reduce((s,c)=>s+c.itens.length,0)}:null};}
function conferir(cat,o){let n=0,ok=0;const cods=Object.keys(cat.a);
 for(let k=0;k<cods.length&&n<400;k+=7){const cod=cods[k];const ref=o.c[cod];if(!ref||ref[0]==null||ref[4])continue;let t=0,f=false;
  for(const [tp,c,coef] of cat.a[cod]){const p=tp==='C'?o.c[c]:o.i[c];if(!p||p[0]==null||coef==null){f=true;break;}t+=coef*p[0];}if(f)continue;n++;if(Math.abs(t-ref[0])<=Math.max(0.02,ref[0]*0.01))ok++;}
 return n?ok/n:null;}
function resumo(){const r=R;const pc=v=>v==null?'—':(v*100).toFixed(1).replace('.',',')+'%';const enc=e=>e&&e.semH!=null?String(e.semH).replace('.',',')+'% / '+String(e.semM).replace('.',',')+'%':'—';
 const conf=r.linhas.length?Math.min(...r.linhas.map(l=>l.ok==null?1:l.ok)):0;const ruim=r.linhas.filter(l=>l.ok!=null&&l.ok<0.97);
 if(ruim.length)r.erros.push('A conferência pelo analítico ficou abaixo de 97% em: '+ruim.map(l=>l.u+' ('+pc(l.ok)+')').join(', ')+'. Algo pode ter sido lido errado.');
 $('#res').innerHTML='<h2>Resumo — referência '+esc(r.mes||'?')+'</h2>'+(r.erros.length?'<div class="box er"><b>Não dá para publicar:</b><br>'+r.erros.map(esc).join('<br>')+'</div>':'<div class="box ok">Tudo lido e conferido: '+r.ufs.length+' estados'+(r.an?', analítico com '+fmt(r.an.n)+' composições e '+fmt(r.an.itens)+' itens':'')+'. A conferência refaz o custo de uma amostra de composições pelo analítico e compara com o custo publicado pela CAIXA (pior estado: '+pc(conf)+').</div>')+
  (r.avisos.length?'<div class="box av">'+r.avisos.map(esc).join('<br>')+'</div>':'')+
  '<div class="tw"><table class="t"><thead><tr><th>UF</th><th>Localidade</th><th class="n">Composições</th><th class="n">com %AS</th><th class="n">preço de SP</th><th class="n">sem custo</th><th class="n">Insumos</th><th class="n">preço de SP</th><th>Encargos (H / M) sem deson.</th><th class="n">Conferência</th></tr></thead><tbody>'+
  r.linhas.map(l=>'<tr><td><b>'+l.u+'</b></td><td>'+esc(l.loc)+'</td><td class="n">'+fmt(l.nc)+'</td><td class="n">'+fmt(l.cAS)+'</td><td class="n">'+fmt(l.cSP)+'</td><td class="n">'+fmt(l.cNada)+'</td><td class="n">'+fmt(l.ni)+'</td><td class="n">'+fmt(l.iSP)+'</td><td>'+enc(l.enc)+'</td><td class="n">'+pc(l.ok)+'</td></tr>').join('')+'</tbody></table></div>'+
  '<p class="m" style="font-size:13px">“com %AS”: a própria CAIXA completou parte do custo com preços de São Paulo. “preço de SP”: o estado não tem custo e o PlantaCalc usa o de São Paulo (fica marcado no orçamento). “sem custo”: nem São Paulo tem — o usuário digita o preço.</p>'+
  '<div class="bar">'+(r.erros.length?'':'<button class="btn pri sm" id="bPub">Publicar '+esc(r.mes)+' para os usuários</button>')+'<button class="btn sec sm" id="bV">Cancelar</button></div><div id="pubst"></div>';
 $('#bV').onclick=()=>{R=null;telaBase();};const bp=$('#bPub');if(bp)bp.onclick=publicar;}
async function publicar(){const r=R;const bp=$('#bPub'),st=$('#pubst');const I=await indice();
 if(I.meses&&I.meses[r.chave]&&!confirmarSubst){st.innerHTML='<div class="box av">O mês '+esc(r.mes)+' já está publicado. Publicar de novo substitui os dados desse mês (os orçamentos já feitos continuam com os valores que tinham). <button class="btn xs ln" id="bSub">Substituir</button></div>';$('#bSub').onclick=()=>{confirmarSubst=true;publicar();};return;}
 bp.disabled=true;bp.textContent='Publicando…';
 try{const pasta=r.chave+'/';const tot=r.ufs.length+2;let k=0;const passo=t=>{k++;st.innerHTML='<div class="m">'+esc(t)+'</div><div class="barra"><i style="width:'+Math.round(k/tot*100)+'%"></i></div>';};
  passo('Enviando catálogo e composição analítica…');await enviar(pasta+'catalogo.json',r.cat);
  for(const u of r.ufs){passo('Enviando preços de '+u+'…');await enviar(pasta+u+'.json',r.arq[u]);}
  const meses=Object.assign({},I.meses||{});meses[r.chave]={mes:r.mes,ufs:r.ufs,publicado:new Date().toISOString(),emissao:(r.arq.SP||{}).emissao||'',v:Date.now()};const atual=Object.keys(meses).sort().pop();
  passo('Atualizando o índice de meses…');await enviar('index.json',{atual,meses},'60');
  st.innerHTML='<div class="box ok"><b>Publicado.</b> '+esc(r.mes)+' já está disponível no PlantaCalc'+(atual===r.chave?' como mês atual':'')+'. Orçamentos feitos em meses anteriores continuam no mês deles e mostram a opção “Atualizar para o mês atual”.</div>';
  bp.remove();$('#bV').textContent='Concluir';confirmarSubst=false;VIN.carregado=false;
 }catch(e){bp.disabled=false;bp.textContent='Tentar publicar de novo';st.innerHTML='<div class="box er">Não foi possível publicar: '+esc(e.message||e)+'</div>';}}

inicio();
