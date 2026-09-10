import { createUploadthing, type FileRouter } from "uploadthing/next";
import { auth } from "@/auth";

const f = createUploadthing();

export const ourFileRouter = {
  // Simplificamos para aceitar QUALQUER arquivo até 8MB
  anexoUploader: f({ 
      blob: { maxFileSize: "8MB", maxFileCount: 4 } 
    })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.email) throw new Error("Não autorizado");
      return { userEmail: session.user.email };
    })
    .onUploadComplete(async () => {
      // Upload concluído
    }),

    recursoArquivo: f({ blob: { maxFileSize: "32MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.email) throw new Error("Não autorizado");
      return { userEmail: session.user.email };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url, name: file.name };
    }),

    comentarioImage: f({ image: { maxFileSize: "4MB", maxFileCount: 1 } })
    .middleware(async () => {
      const session = await auth();
      if (!session?.user?.email) throw new Error("Unauthorized");
      return { userEmail: session.user.email };
    })
    .onUploadComplete(async ({ file }) => {
      return { url: file.url };
    }),
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;