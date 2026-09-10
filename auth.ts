import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import { authConfig } from './auth.config';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const LoginSchema = z.object({
    email: z.string().email(),
    password: z.string().min(1),
});

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const parsedCredentials = LoginSchema.safeParse(credentials);

        if (parsedCredentials.success) {
          const { email, password } = parsedCredentials.data;
          
          const user = await prisma.usuario.findUnique({ where: { email } });
          
          if (!user) return null;

          // --- NOVA VERIFICAÇÃO: USUÁRIO INATIVO ---
          if (!user.ativo) {
             return null // Bloqueia o login de usuários inativos
          }
          // -----------------------------------------

          const passwordsMatch = await bcrypt.compare(password, user.senha);
          if (passwordsMatch) return user;
        }
        
        return null;
      },
    }),
  ],
});