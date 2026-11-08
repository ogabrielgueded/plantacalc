/* =====================================================================
   PlantaCalc — CONFIGURAÇÃO DO SITE
   Este é o único arquivo que você precisa editar depois de criar as contas.
   Troque os valores entre aspas pelos seus (veja COMO-PUBLICAR.html).
   ===================================================================== */
window.PC_CFG = {
  nome: 'PlantaCalc',
  site: 'https://plantacalc.com.br',          // endereço final do site (sem barra no fim)
  contato: 'contato@gabrielguedes.com',        // e-mail mostrado no site e nos termos

  // Preços do plano Pro (mostrados no site). Os preços cobrados ficam na função "assinatura" do Supabase
  // (segredos PRECO_MENSAL e PRECO_ANUAL) — mantenha os dois iguais.
  preco: { mensal: 29.90, anual: 299.00 },

  // Supabase → Project Settings → API: "Project URL" e a chave "anon public"
  supabaseUrl: '',
  supabaseKey: '',

  // Google AdSense: o seu "ID do editor" (começa com ca-pub-) e os IDs de 3 blocos de anúncio "Display"
  // Enquanto estiver vazio, o site mostra um convite ao plano Pro no lugar do anúncio.
  adsense: '',
  slots: { inicio: '', resultados: '', pranchas: '' },

  // Dados de quem vende (aparecem nos Termos de uso e na Política de privacidade)
  responsavel: '[Seu nome completo ou razão social]',
  documento: '[CPF ou CNPJ]',
  cidade: '[Cidade – UF]'
};
