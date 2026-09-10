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
} satisfies FileRouter;

export type OurFileRouter = typeof ourFileRouter;