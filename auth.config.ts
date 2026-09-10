import type { NextAuthConfig } from 'next-auth';

export const authConfig = {
  pages: {
    signIn: '/login',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      
      // Verifica se está na página de Login
      const isOnLogin = nextUrl.pathname.startsWith('/login');
      
      // Se estiver logado e tentar acessar o login, manda pra Home
      if (isOnLogin && isLoggedIn) {
        return Response.redirect(new URL('/', nextUrl));
      }

      // Se NÃO estiver logado e NÃO estiver no login (ou seja, está no dashboard), bloqueia
      if (!isLoggedIn && !isOnLogin) {
        return false; // Vai redirecionar para /login automaticamente
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id
        // Você pode passar o cargo também se quiser usar no client
        // token.role = user.role 
      }
      return token
    },
    async session({ session, token }) {
        if (token.sub && session.user) {
            session.user.id = token.sub;
        }
        return session;
    }
  },
  providers: [],
} satisfies NextAuthConfig;