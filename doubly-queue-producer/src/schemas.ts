import { z } from "zod";

export const LinkSchema = z.object({
  originalUrl: z.string(),
  linkId: z.number()
});

export type Link = z.infer<typeof LinkSchema>;
