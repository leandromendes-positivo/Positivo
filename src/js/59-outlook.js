/* Microsoft Graph: cria apenas rascunhos. Não pede Mail.Send nem envia mensagens.
   OAuth isolado da sessão do painel; tokens somente em memória, nunca no banco. */
const OutlookCobranca = (() => {
  let conexao = null, versao = 0, conectando = false, expirar;
  function exigirSessao() {
    if (Acesso.modo !== 'firebase' || !Acesso.usuario?.uid || !Acesso.perfil?.ativo ||
        Acesso.auth?.currentUser?.uid !== Acesso.usuario.uid) {
      throw new Error('Entre no painel com seu acesso autorizado para conectar o Outlook.');
    }
    return Acesso.usuario.uid;
  }
  function desconectar() { conexao = null; clearTimeout(expirar); versao++; }
  function conta() {
    if (conexao && (conexao.uid !== Acesso.usuario?.uid || !Acesso.perfil?.ativo ||
        Acesso.auth?.currentUser?.uid !== conexao.uid || Date.now() >= conexao.ate)) desconectar();
    return conexao?.email || '';
  }
  async function graph(caminho, token, opcoes = {}) {
    // Nunca seguir redirects com a credencial. Nunca enviar cookies do navegador.
    const resposta = await fetch(`https://graph.microsoft.com/v1.0${caminho}`, {
      ...opcoes, credentials: 'omit', redirect: 'error', cache: 'no-store',
      signal: AbortSignal.timeout(30000),
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    });
    if (resposta.status === 401) { desconectar(); throw new Error('A autorização do Outlook expirou. Conecte sua conta novamente.'); }
    if (resposta.status === 403) throw new Error('A Microsoft não autorizou o acesso à caixa de e-mail. Conecte novamente e autorize a permissão; sua empresa pode exigir aprovação da TI.');
    if (!resposta.ok) throw new Error(opcoes.method === 'POST'
      ? 'Não foi possível confirmar a criação. Confira a pasta Rascunhos no Outlook antes de tentar novamente.'
      : 'Não foi possível consultar sua caixa do Outlook. Verifique se esta conta possui uma caixa de e-mail Microsoft ativa.');
    return resposta.json();
  }
  async function conectar() {
    const uid = exigirSessao();
    if (conectando) throw new Error('A conexão com o Outlook já está em andamento.');
    const cfg = configFirebase();
    if (!cfg || !window.firebase?.auth) throw new Error('O provedor Microsoft precisa estar configurado no Firebase deste painel.');
    desconectar();
    const tentativa = versao;
    conectando = true;
    let app;
    try {
      // Não troca o login principal, não vincula provedores e não grava usuários autorizados.
      app = firebase.initializeApp(cfg, `outlook-${crypto.randomUUID()}`);
      const auth = app.auth();
      await auth.setPersistence(firebase.auth.Auth.Persistence.NONE);
      const provedor = new firebase.auth.OAuthProvider('microsoft.com');
      provedor.setCustomParameters({ tenant: 'common', prompt: 'select_account' });
      provedor.addScope('User.Read');
      provedor.addScope('Mail.ReadWrite');
      let credencial;
      try { credencial = (await auth.signInWithPopup(provedor)).credential; }
      catch (e) {
        // A Microsoft já autenticou a conta, mas o Firebase pode conhecer o mesmo
        // endereço pelo Google. Usar só o token OAuth evita vincular essas identidades.
        if (e.code !== 'auth/account-exists-with-different-credential' || !e.credential?.accessToken) throw e;
        credencial = e.credential;
      }
      if (!credencial?.accessToken) throw new Error('A Microsoft não retornou autorização para criar rascunhos.');
      const usuario = await graph('/me?$select=mail,userPrincipalName', credencial.accessToken);
      const email = usuario.mail || usuario.userPrincipalName;
      if (!emailValido(email)) throw new Error('Não foi possível identificar sua caixa do Outlook.');
      if (tentativa !== versao || exigirSessao() !== uid) throw new Error('A sessão mudou. Conecte o Outlook novamente.');
      conexao = { uid, email, token: credencial.accessToken, ate: Date.now() + 45 * 60000 };
      expirar = setTimeout(desconectar, 45 * 60000);
      return email;
    } catch (e) {
      const mensagens = {
        'auth/popup-blocked': 'Permita a janela de autenticação da Microsoft neste navegador e tente novamente.',
        'auth/popup-closed-by-user': 'A conexão com o Outlook foi cancelada. Nenhum rascunho foi criado.',
        'auth/cancelled-popup-request': 'A conexão foi interrompida. Tente novamente.',
        'auth/operation-not-allowed': 'O administrador precisa habilitar o provedor Microsoft no Firebase. A opção de rascunho .eml continua disponível.',
        'auth/unauthorized-domain': 'O administrador precisa autorizar o domínio deste painel no Firebase.',
      };
      if (e.code) throw new Error(mensagens[e.code] || 'Não foi possível conectar o Outlook. Verifique a configuração do provedor Microsoft e as permissões da sua empresa.');
      if (e.name === 'TimeoutError' || e instanceof TypeError) throw new Error('Não foi possível conectar à Microsoft. Confira sua conexão e tente novamente.');
      throw e;
    } finally {
      // A sessão auxiliar nem sequer permanece autenticada após obter o token Microsoft.
      if (app) { await app.auth().signOut().catch(() => {}); await app.delete().catch(() => {}); }
      conectando = false;
    }
  }
  function linkSeguro(link) {
    let url;
    try { url = new URL(link); } catch (_) { throw new Error('O Outlook retornou um endereço inválido. Abra sua pasta Rascunhos diretamente.'); }
    if (url.protocol !== 'https:' || url.username || url.password || url.port ||
        !['outlook.office.com', 'outlook.office365.com', 'outlook.live.com'].includes(url.hostname)) {
      throw new Error('O Outlook retornou um endereço inesperado. Abra sua pasta Rascunhos diretamente.');
    }
    return url.href;
  }
  async function criar(d) {
    validarEmailCobranca(d);
    const uid = exigirSessao();
    if (!conta()) throw new Error('Conecte sua própria conta Outlook antes de criar o rascunho.');
    const atual = conexao, tentativa = versao;
    let mensagem;
    try {
      mensagem = await graph('/me/messages', atual.token, {
        method: 'POST', body: JSON.stringify({
          subject: d.assunto,
          body: { contentType: 'HTML', content: htmlEmailCobranca(d) },
          toRecipients: [{ emailAddress: { address: d.destinatario } }],
        }),
      });
    } catch (e) {
      // Um timeout não prova que o servidor deixou de criar: nunca repetir o POST sozinho.
      if (e.name === 'TimeoutError' || e instanceof TypeError) throw new Error('Não foi possível confirmar a criação. Confira a pasta Rascunhos no Outlook antes de tentar novamente.');
      throw e;
    }
    if (tentativa !== versao || exigirSessao() !== uid) throw new Error('A sessão mudou. Confira a pasta Rascunhos na conta Outlook utilizada.');
    if (!mensagem.id || mensagem.isDraft !== true || !mensagem.webLink) throw new Error('Confira sua pasta Rascunhos: a Microsoft não retornou um link de rascunho válido.');
    return { url: linkSeguro(mensagem.webLink), conta: atual.email };
  }
  return { conectar, desconectar, conta, criar };
})();
